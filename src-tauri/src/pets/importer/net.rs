//! The network side of importing: fetching over https only, never to a private address, and within a size limit.
use super::*;
use std::sync::atomic::{AtomicBool, Ordering};
use ureq::config::Config;
use ureq::http::Uri;
use ureq::unversioned::resolver::{DefaultResolver, ResolvedSocketAddrs, Resolver};
use ureq::unversioned::transport::{DefaultConnector, NextTimeout};

/// Pages and sprites are read up to these sizes.
pub(super) const PAGE_LIMIT: usize = 3 * 1024 * 1024;
pub(super) const SPRITE_LIMIT: usize = catalog::SPRITE_LIMIT;

pub struct Fetched {
    pub status: u16,
    pub location: Option<String>,
    pub body: Vec<u8>,
    pub too_big: bool,
}
pub type Fetch<'a> = &'a dyn Fn(&str, usize) -> Result<Fetched, String>;

/// `fetch`, refusing its answer once `cancel` is set: the import stops there and saves nothing.
pub fn unless_cancelled<'a>(
    cancel: &'a AtomicBool,
    fetch: Fetch<'a>,
) -> impl Fn(&str, usize) -> Result<Fetched, String> + 'a {
    move |url, limit| {
        let fetched = fetch(url, limit);
        if cancel.load(Ordering::SeqCst) {
            return Err(i18n::t("chat.cancelled"));
        }
        fetched
    }
}

/// Name resolution that refuses private addresses at the connection itself, so a name that
/// answers with a public address first and a private one later (DNS rebinding) cannot get a
/// request into the local network.
#[derive(Debug, Default)]
struct PublicOnly(DefaultResolver);
impl Resolver for PublicOnly {
    fn resolve(&self, uri: &Uri, config: &Config, timeout: NextTimeout) -> Result<ResolvedSocketAddrs, ureq::Error> {
        let addrs = self.0.resolve(uri, config, timeout)?;
        if addrs.iter().any(|a| private_ip(a.ip())) {
            return Err(ureq::Error::Io(std::io::Error::other(PRIVATE)));
        }
        Ok(addrs)
    }
}
const PRIVATE: &str = "private address";

/// Real network: no automatic redirects (each hop is re-checked), bounded body.
pub fn http_fetch(url: &str, limit: usize) -> Result<Fetched, String> {
    // max_redirects_will_error(false): a redirect comes back as a response instead of an error.
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(20)))
        .max_redirects(0)
        .max_redirects_will_error(false)
        .user_agent("PlayPets")
        .build();
    let agent = ureq::Agent::with_parts(config, DefaultConnector::default(), PublicOnly::default());
    let resp = match agent.get(url).call() {
        Ok(r) => r,
        Err(ureq::Error::StatusCode(status)) => {
            return Ok(Fetched {
                status,
                location: None,
                body: Vec::new(),
                too_big: false,
            });
        }
        Err(ureq::Error::Io(e)) if e.to_string().contains(PRIVATE) => {
            return Err(i18n::t("import.private_address"));
        }
        Err(_) => return Err(i18n::t("import.page_offline")),
    };
    let status = resp.status().as_u16();
    let header = |name: &str| {
        resp.headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string)
    };
    if (300..400).contains(&status) {
        return Ok(Fetched {
            status,
            location: header("location"),
            body: Vec::new(),
            too_big: false,
        });
    }
    if header("content-length")
        .and_then(|v| v.parse::<usize>().ok())
        .is_some_and(|n| n > limit)
    {
        return Ok(Fetched {
            status,
            location: None,
            body: Vec::new(),
            too_big: true,
        });
    }
    let mut body = Vec::new();
    resp.into_body()
        .into_reader()
        .take(limit as u64 + 1)
        .read_to_end(&mut body)
        .map_err(|_| i18n::t("import.page_failed"))?;
    let too_big = body.len() > limit;
    Ok(Fetched {
        status,
        location: None,
        body,
        too_big,
    })
}

pub(super) fn private_v4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 168)
        || (a == 100 && (64..=127).contains(&b))
}
pub(super) fn private_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return private_v4(v4);
    }
    let first = ip.segments()[0];
    let nat64 = first == 0x64 && ip.segments()[1] == 0xff9b;
    ip.is_loopback()
        || ip.is_unspecified()
        || nat64
        || first & 0xfe00 == 0xfc00
        || first & 0xffc0 == 0xfe80
        || first & 0xff00 == 0xff00
}
pub(super) fn private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => private_v4(v4),
        IpAddr::V6(v6) => private_v6(v6),
    }
}
pub(super) fn private_name(domain: &str) -> bool {
    let d = domain.trim_end_matches('.').to_ascii_lowercase();
    d == "localhost" || d.ends_with(".localhost")
}

pub fn check_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|_| i18n::t("import.bad_address"))?;
    if url.scheme() != "https" {
        return Err(i18n::t("import.https_only"));
    }
    let blocked = match url.host() {
        Some(Host::Domain(d)) => private_name(d),
        Some(Host::Ipv4(ip)) => private_v4(ip),
        Some(Host::Ipv6(ip)) => private_v6(ip),
        None => return Err(i18n::t("import.bad_address")),
    };
    if blocked {
        return Err(i18n::t("import.private_address"));
    }
    Ok(url)
}

pub(super) fn download(url: Url, fetch: Fetch, limit: usize) -> Result<(Vec<u8>, Url), String> {
    let mut current = url;
    for _ in 0..5 {
        let got = fetch(current.as_str(), limit)?;
        if (300..400).contains(&got.status)
            && let Some(location) = got.location
        {
            let next = current.join(&location).map_err(|_| i18n::t("import.bad_address"))?;
            current = check_url(next.as_str())?;
            continue;
        }
        if !(200..300).contains(&got.status) {
            return Err(i18n::tr("import.page_status", &[("code", &got.status.to_string())]));
        }
        if got.too_big || got.body.len() > limit {
            return Err(if limit == SPRITE_LIMIT {
                i18n::t("pet.sprite_too_big")
            } else {
                i18n::t("import.page_too_big")
            });
        }
        return Ok((got.body, current));
    }
    Err(i18n::t("import.too_many_redirects"))
}

pub(super) fn get_json(url: &str, fetch: Fetch) -> Result<Value, String> {
    let (body, _) = download(check_url(url)?, fetch, PAGE_LIMIT)?;
    serde_json::from_slice(&body).map_err(|_| i18n::t("import.json_unreadable"))
}
