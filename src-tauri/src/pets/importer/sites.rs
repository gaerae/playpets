//! The community sites: one record per site says where it lives (`hosts`) and how its pet pages
//! become a Source (`route`). Everything else an address can be is decided here too: a pet
//! folder on GitHub, a self-hosted codex-pet-share instance, or a plain page.
use super::*;

/// How a site's pet page turns into the files to fetch.
pub(super) enum Route {
    /// Petdex: its install API names the sprite and a pet.json.
    Petdex,
    /// A registry serving codex-pet-share JSON at `{api}{slug}`, with pages at `{page}{slug}`.
    Registry { api: &'static str, page: &'static str },
    /// Pets kept as raw files in a GitHub repository, `{base}/{id}` holding pet.json.
    RawFolder { base: &'static str, license: &'static str },
    /// Pet folders on GitHub, any repository.
    GitHub,
}

pub struct Community {
    /// Prefix of the folders pets from this site are saved in.
    pub id: &'static str,
    pub name: &'static str,
    pub url: &'static str,
    /// Hosts (without `www.`) whose pet pages belong to this site; empty for a GitHub repository.
    pub hosts: &'static [&'static str],
    pub hint: fn() -> String,
    pub importable: bool,
    pub(super) route: Route,
}
// Curated on 2026-09-29, largest first. Sites with fewer than a dozen pets or no per-pet
// pages were left out; anything hosted on GitHub imports through the generic GitHub path.
pub const COMMUNITIES: [Community; 5] = [
    Community {
        id: "openpets",
        name: "OpenPets Registry",
        url: "https://openpets.sh/",
        hosts: &["openpets.sh"],
        hint: || i18n::t("import.hint_openpets"),
        importable: true,
        route: Route::Registry {
            api: "https://openpets.sh/api/pets/",
            page: "https://openpets.sh/pets/",
        },
    },
    Community {
        id: "petdex",
        name: "Petdex",
        url: "https://petdex.dev/",
        hosts: &["petdex.dev", "petdex.crafter.run"],
        hint: || i18n::t("import.hint_petdex"),
        importable: true,
        route: Route::Petdex,
    },
    Community {
        id: "github",
        name: "Codex PokéPets",
        url: "https://github.com/dnnyngyen/codex-pokepets",
        hosts: &[],
        hint: || i18n::t("import.hint_pokepets"),
        importable: true,
        route: Route::GitHub,
    },
    Community {
        id: "codexpet",
        name: "Awesome Codex Pet",
        url: "https://codexpet.top/",
        hosts: &["codexpet.top"],
        hint: || i18n::t("import.hint_awesome"),
        importable: true,
        // Pets live in the legeling/awesome-codex-pet repo as pets/{id}.
        route: Route::RawFolder {
            base: "https://raw.githubusercontent.com/legeling/awesome-codex-pet/main/pets",
            license: "CC BY-NC 4.0",
        },
    },
    Community {
        id: "codex-pets",
        name: "Codex Pets",
        url: "https://codex-pets.net/",
        hosts: &["codex-pets.net"],
        hint: || i18n::t("import.hint_codexpets"),
        importable: true,
        route: Route::Registry {
            api: "https://codex-pets.net/api/pets/",
            page: "https://codex-pets.net/share/",
        },
    },
];
pub fn communities_json() -> Value {
    json!(
        COMMUNITIES
            .iter()
            .map(|c| json!({"name": c.name, "url": c.url, "hint": (c.hint)(), "importable": c.importable}))
            .collect::<Vec<_>>()
    )
}

/// Only the community sites the app itself lists are ever opened: https, the same host, and on
/// a shared host such as github.com the listed address itself (a repository), not the whole site.
pub fn openable(raw: &str) -> Option<Url> {
    let target = Url::parse(raw).ok()?;
    if target.scheme() != "https" {
        return None;
    }
    let shared_host = |host: &str| host == "github.com" || host.ends_with(".github.io");
    // github.com/owner/repo may be followed by a path, never by more name (…/repo-evil).
    let at_listed = |listed: &str| {
        let base = listed.trim_end_matches('/');
        target
            .as_str()
            .strip_prefix(base)
            .is_some_and(|rest| rest.is_empty() || rest.starts_with(['/', '?', '#']))
    };
    let listed = COMMUNITIES.iter().any(|c| {
        Url::parse(c.url).is_ok_and(|u| {
            u.host_str() == target.host_str() && (!u.host_str().is_some_and(shared_host) || at_listed(c.url))
        })
    });
    listed.then_some(target)
}

pub(super) fn bare_host(url: &Url) -> &str {
    let host = url.host_str().unwrap_or("");
    host.strip_prefix("www.").unwrap_or(host)
}
/// The community a page address belongs to, by host.
pub(super) fn community_for(url: &Url) -> Option<&'static Community> {
    let host = bare_host(url);
    COMMUNITIES.iter().find(|c| c.hosts.contains(&host))
}
/// A short name for a site the app does not list: the host without `www.` and its last label
/// (`spriteyard.com` → `spriteyard`, `pets.example.org` → `pets-example`).
pub(super) fn site_slug(url: &Url) -> String {
    let host = bare_host(url);
    let name = host.rsplit_once('.').map(|(head, _)| head).unwrap_or(host);
    slugify(name)
}
/// The path segment right after `segment`: the id in /pets/{id}.
pub(super) fn after(url: &Url, segment: &str) -> String {
    let parts: Vec<&str> = url
        .path_segments()
        .map(|s| s.filter(|p| !p.is_empty()).collect())
        .unwrap_or_default();
    parts
        .iter()
        .position(|p| *p == segment)
        .and_then(|i| parts.get(i + 1))
        .map(|s| s.to_string())
        .unwrap_or_default()
}

/// A pet folder on GitHub: owner, repo, branch and the folder path (no trailing pet.json).
pub(super) struct GitHubFolder {
    pub(super) owner: String,
    pub(super) repo: String,
    pub(super) branch: String,
    pub(super) path: String,
}

pub(super) fn github_folder(url: &Url) -> Result<Option<GitHubFolder>, String> {
    let host = url.host_str().unwrap_or("");
    let parts: Vec<String> = url
        .path_segments()
        .map(|s| s.filter(|p| !p.is_empty()).map(str::to_string).collect())
        .unwrap_or_default();
    let (skip, on_github) = match host {
        "github.com" => (1, true),
        "raw.githubusercontent.com" => (0, true),
        _ => (0, false),
    };
    if !on_github {
        return Ok(None);
    }
    // github.com/{owner}/{repo}/tree/{branch}/{path...} · raw.githubusercontent.com/{owner}/{repo}/{branch}/{path...}
    if parts.len() >= 4 + skip && (skip == 0 || parts[2] == "tree" || parts[2] == "blob") {
        let mut path: Vec<String> = parts[3 + skip..].to_vec();
        if path
            .last()
            .is_some_and(|f| f.ends_with(".json") || f.ends_with(".webp") || f.ends_with(".png"))
        {
            path.pop();
        }
        if !path.is_empty() {
            return Ok(Some(GitHubFolder {
                owner: parts[0].clone(),
                repo: parts[1].clone(),
                branch: parts[2 + skip].clone(),
                path: path.join("/"),
            }));
        }
    }
    Err(i18n::t("import.github_folder"))
}

/// codex-pet-share style URLs: /share/{id} or #/pets/{id}; the pet id, if the URL has one.
pub(super) fn share_id(url: &Url) -> String {
    let hash = url.fragment().unwrap_or("").trim_start_matches('/');
    let from_hash = hash
        .strip_prefix("pets/")
        .map(|h| h.split(['?', '/']).next().unwrap_or("").to_string())
        .unwrap_or_default();
    let share = after(url, "share");
    if share.is_empty() { from_hash } else { share }
}

/// Which site an address belongs to and the pet's slug there; together they name its folder.
pub(super) fn identify(url: &Url) -> Result<(String, String), String> {
    if bare_host(url) == "openpets.dev" {
        return Err(i18n::t("import.openpets_app"));
    }
    if let Some(g) = github_folder(url)? {
        let last = g.path.rsplit('/').next().unwrap_or("").to_string();
        return Ok(("github".into(), slugify(&format!("{}-{}-{}", g.owner, g.repo, last))));
    }
    if let Some(c) = community_for(url) {
        let slug = match c.route {
            Route::Registry { page, .. } if page.ends_with("/share/") => share_id(url),
            _ => after(url, "pets"),
        };
        return Ok((c.id.into(), slugify(&slug)));
    }
    let share = share_id(url);
    if !share.is_empty() {
        return Ok((site_slug(url), slugify(&share)));
    }
    let last = url
        .path_segments()
        .and_then(|mut s| s.rfind(|p| !p.is_empty()))
        .unwrap_or("")
        .to_string();
    Ok((site_slug(url), slugify(&last)))
}

pub(super) struct Source {
    pub(super) name: String,
    pub(super) page_url: String,
    pub(super) display_name: String,
    pub(super) description: String,
    pub(super) creator: String,
    pub(super) license: String,
    pub(super) candidates: Vec<String>,
    /// Hosts files may come from: the page's own site and, for a listed community, its hosts.
    pub(super) hosts: Vec<String>,
}

/// Whether `candidate` is on one of `hosts` or a subdomain of one: files are only taken from
/// the site the address named, never from wherever a page or an API points.
pub(super) fn on_site(candidate: &Url, hosts: &[String]) -> bool {
    let host = bare_host(candidate);
    hosts
        .iter()
        .any(|h| host == h || host.strip_suffix(h).is_some_and(|rest| rest.ends_with('.')))
}

fn site_hosts(url: &Url, community: Option<&Community>) -> Vec<String> {
    let mut hosts = vec![bare_host(url).to_string()];
    for h in community.map(|c| c.hosts).unwrap_or(&[]) {
        if !hosts.iter().any(|x| x == h) {
            hosts.push(h.to_string());
        }
    }
    hosts
}

pub(super) fn str_at<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("")
}

/// codex-pet-share JSON (`{pet: {...}}`) as served by codex-pets.net, openpets.sh and any
/// self-hosted instance; the sprite URL may be relative to the API origin.
pub(super) fn share_source(
    api_url: &str,
    name: &str,
    page_url: String,
    hosts: Vec<String>,
    fetch: Fetch,
) -> Result<Source, String> {
    let base = check_url(api_url)?;
    let pet = get_json(api_url, fetch)?.get("pet").cloned().unwrap_or(Value::Null);
    let sprite = str_at(&pet, "spritesheetUrl");
    if sprite.is_empty() {
        return Err(i18n::tr("import.not_found_on", &[("name", name)]));
    }
    let sprite = base
        .join(sprite)
        .map_err(|_| i18n::t("import.bad_address"))?
        .to_string();
    let creator = Some(str_at(&pet, "ownerName"))
        .filter(|s| !s.is_empty())
        .unwrap_or(str_at(&pet, "ownerHandle"));
    Ok(Source {
        name: name.into(),
        page_url,
        display_name: str_at(&pet, "displayName").into(),
        description: str_at(&pet, "description").into(),
        creator: creator.into(),
        license: String::new(),
        candidates: vec![sprite],
        hosts,
    })
}

/// A pet folder served as raw files: pet.json names the sprite next to it.
pub(super) fn raw_folder_source(
    raw_base: &str,
    name: &str,
    page_url: String,
    creator: String,
    license: String,
    fetch: Fetch,
) -> Result<Source, String> {
    let manifest = get_json(&format!("{raw_base}/pet.json"), fetch)?;
    let sprite_file = Some(str_at(&manifest, "spritesheetPath"))
        .filter(|s| !s.is_empty() && !s.contains("..") && !s.starts_with('/'))
        .unwrap_or("spritesheet.webp");
    Ok(Source {
        name: name.into(),
        page_url,
        display_name: str_at(&manifest, "displayName").into(),
        description: str_at(&manifest, "description").into(),
        creator,
        license,
        candidates: vec![format!("{raw_base}/{sprite_file}")],
        hosts: vec!["raw.githubusercontent.com".into()],
    })
}

fn petdex_source(slug: &str, hosts: Vec<String>, fetch: Fetch) -> Result<Source, String> {
    let pet = get_json(&format!("https://petdex.dev/api/install-pet/{slug}"), fetch)?
        .get("pet")
        .cloned()
        .unwrap_or(Value::Null);
    if str_at(&pet, "spritesheetUrl").is_empty() {
        return Err(i18n::tr("import.not_found_on", &[("name", "Petdex")]));
    }
    // The pet.json the API points to adds the description, when it is on Petdex's own hosts.
    let description = Some(str_at(&pet, "petJsonUrl"))
        .filter(|u| check_url(u).is_ok_and(|url| on_site(&url, &hosts)))
        .and_then(|u| get_json(u, fetch).ok())
        .map(|m| str_at(&m, "description").to_string())
        .unwrap_or_default();
    Ok(Source {
        name: "Petdex".into(),
        page_url: format!("https://petdex.dev/pets/{slug}"),
        display_name: str_at(&pet, "displayName").into(),
        description,
        creator: String::new(),
        license: String::new(),
        candidates: vec![str_at(&pet, "spritesheetUrl").into()],
        hosts,
    })
}

/// A page the app does not know: its JSON-LD or a sprite named in the page.
fn page_source(url: &Url, hosts: Vec<String>, fetch: Fetch) -> Result<Source, String> {
    let (body, page) = download(url.clone(), fetch, PAGE_LIMIT)?;
    let html = String::from_utf8_lossy(&body).into_owned();
    let ld = json_ld(&html).into_iter().next().unwrap_or(Value::Null);
    let mut candidates: Vec<String> = Vec::new();
    for raw in first_image(ld.get("image")).into_iter().chain(in_page_sprites(&html)) {
        if let Ok(abs) = page.join(&decode(&raw)) {
            let s = abs.to_string();
            if !candidates.contains(&s) {
                candidates.push(s);
            }
        }
    }
    let creator = match ld.get("creator") {
        Some(Value::String(s)) => s.clone(),
        Some(v) => str_at(v, "name").into(),
        None => String::new(),
    };
    let display = Some(str_at(&ld, "name").to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| title(&html));
    let description = Some(str_at(&ld, "description").to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| meta(&html, "description"))
        .unwrap_or_default();
    Ok(Source {
        name: bare_host(url).into(),
        page_url: page.to_string(),
        display_name: display,
        description,
        creator,
        license: String::new(),
        candidates,
        hosts,
    })
}

pub(super) fn resolve_source(url: &Url, site: &str, slug: &str, fetch: Fetch) -> Result<Source, String> {
    if site == "github" {
        let g = github_folder(url)?.ok_or_else(|| i18n::t("import.not_github"))?;
        let raw = format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}",
            g.owner, g.repo, g.branch, g.path
        );
        let page = format!("https://github.com/{}/{}/tree/{}/{}", g.owner, g.repo, g.branch, g.path);
        return raw_folder_source(&raw, "GitHub", page, g.owner.clone(), String::new(), fetch);
    }
    let community = community_for(url);
    let hosts = site_hosts(url, community);
    match community.map(|c| (&c.route, c)) {
        Some((Route::Petdex, _)) => petdex_source(slug, hosts, fetch),
        Some((Route::Registry { api, page }, c)) => {
            share_source(&format!("{api}{slug}"), c.name, format!("{page}{slug}"), hosts, fetch)
        }
        Some((Route::RawFolder { base, license }, c)) => {
            // Ids look like {name}--{author}, so the page's own id (not the folder slug, which
            // collapses the "--") names the raw files.
            let id = after(url, "pets");
            if id.is_empty()
                || !id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
            {
                return Err(i18n::t("import.need_detail_page"));
            }
            let author = id
                .rsplit("--")
                .next()
                .filter(|_| id.contains("--"))
                .unwrap_or("")
                .to_string();
            raw_folder_source(
                &format!("{base}/{id}"),
                c.name,
                format!("{}pets/{id}", c.url),
                author,
                license.to_string(),
                fetch,
            )
        }
        Some((Route::GitHub, _)) | None => {
            let share = share_id(url);
            if !share.is_empty() {
                let origin = url.origin().ascii_serialization();
                return share_source(
                    &format!("{origin}/api/pets/{share}"),
                    bare_host(url),
                    format!("{origin}/share/{share}"),
                    hosts,
                    fetch,
                );
            }
            page_source(url, hosts, fetch)
        }
    }
}
