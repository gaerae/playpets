// HTTP AI providers (OpenAI, OpenAI-compatible, Ollama): config validation,
// chat, model lists and local Ollama detection. What differs per kind is in kind.rs.
use super::kind::Kind;
use crate::i18n;
use serde_json::{Value, json};
use std::io::Read;
use std::time::Duration;

/// The longest answer kept from any AI, in characters.
pub const ANSWER_LIMIT: usize = 24000;

#[derive(Clone, Debug)]
pub struct Config {
    pub kind: Kind,
    pub model: String,
    pub endpoint: String,
    pub api_key: String,
}

/// Where Ollama listens unless told otherwise.
pub const OLLAMA_DEFAULT: &str = "http://127.0.0.1:11434";

pub fn validate_config(raw: &Value) -> Result<Config, String> {
    let kind = Kind::parse(raw.get("type").and_then(|v| v.as_str()).unwrap_or(""))
        .ok_or_else(|| i18n::t("ai.kind_missing"))?;
    if kind.is_cli() {
        let model = raw
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .chars()
            .take(200)
            .collect();
        return Ok(Config {
            kind,
            model,
            endpoint: String::new(),
            api_key: String::new(),
        });
    }
    let model = raw.get("model").and_then(|v| v.as_str()).map(str::trim).unwrap_or("");
    if model.is_empty() || model.len() > 200 {
        return Err(i18n::t("ai.model_missing"));
    }
    let endpoint = match kind.fixed_endpoint() {
        Some(fixed) => fixed.to_string(),
        None => {
            let e = raw.get("endpoint").and_then(|v| v.as_str()).unwrap_or("");
            if e.is_empty() {
                kind.default_endpoint().unwrap_or("").to_string()
            } else {
                e.to_string()
            }
        }
    };
    let url = url_parse(&endpoint).ok_or_else(|| i18n::t("ai.endpoint_invalid"))?;
    if !url.user.is_empty() || url.query || url.fragment {
        return Err(i18n::t("ai.endpoint_extras"));
    }
    let local = ["127.0.0.1", "localhost", "[::1]"].contains(&url.host.as_str());
    if url.scheme != "https" && !(url.scheme == "http" && local) {
        return Err(i18n::t("ai.https_required"));
    }
    let api_key = raw
        .get("apiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    Ok(Config {
        kind,
        model: model.into(),
        endpoint: url.href.trim_end_matches('/').to_string(),
        api_key,
    })
}

/// Only what validation needs. Saved endpoints are compared by this href, so how it is
/// normalized must stay as it is.
struct MiniUrl {
    scheme: String,
    user: String,
    host: String,
    query: bool,
    fragment: bool,
    href: String,
}
fn url_parse(s: &str) -> Option<MiniUrl> {
    let (scheme, rest) = s.split_once("://")?;
    if scheme.is_empty() || rest.is_empty() {
        return None;
    }
    let fragment = rest.contains('#');
    let no_frag = rest.split('#').next().unwrap_or("");
    let query = no_frag.contains('?');
    let no_q = no_frag.split('?').next().unwrap_or("");
    let authority = no_q.split('/').next().unwrap_or("");
    let (user, hostport) = match authority.rsplit_once('@') {
        Some((u, h)) => (u.to_string(), h),
        None => (String::new(), authority),
    };
    let host = if hostport.starts_with('[') {
        format!("{}]", hostport.split(']').next()?).to_lowercase()
    } else {
        hostport.split(':').next()?.to_lowercase()
    };
    if host.is_empty() {
        return None;
    }
    // Normalized like a WHATWG href: scheme://host[:port]/path, scheme and host in lower case.
    let path = &no_q[authority.len()..];
    let href = format!(
        "{}://{}{}",
        scheme.to_lowercase(),
        hostport.to_lowercase(),
        if path.is_empty() { "/" } else { path }
    );
    Some(MiniUrl {
        scheme: scheme.to_lowercase(),
        user,
        host,
        query,
        fragment,
        href,
    })
}

fn agent(timeout: Duration) -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .max_redirects(0)
        .build()
        .into()
}

fn read_bounded(resp: ureq::http::Response<ureq::Body>) -> Result<Value, String> {
    let mut buf = Vec::new();
    let mut reader = resp.into_body().into_reader().take(2 * 1024 * 1024 + 1);
    reader.read_to_end(&mut buf).map_err(|_| i18n::t("ai.unreachable"))?;
    if buf.len() > 2 * 1024 * 1024 {
        return Err(i18n::t("ai.answer_too_long"));
    }
    serde_json::from_slice(&buf).map_err(|_| i18n::t("ai.answer_unreadable"))
}

pub fn chat(config: &Config, messages: &[Value]) -> Result<String, String> {
    if config.kind.needs_key() && config.api_key.is_empty() {
        return Err(i18n::t("ai.key_missing"));
    }
    let history: Vec<Value> = messages
        .iter()
        .rev()
        .take(24)
        .rev()
        .map(|m| {
            let role = match m.get("role").and_then(|v| v.as_str()) {
                Some("assistant") => "assistant",
                Some("system") => "system",
                _ => "user",
            };
            let content: String = m
                .get("content")
                .map(|v| v.as_str().map(str::to_string).unwrap_or_else(|| v.to_string()))
                .unwrap_or_default()
                .chars()
                .take(12000)
                .collect();
            json!({"role": role, "content": content})
        })
        .collect();
    let (url, body) = config.kind.chat_request(&config.endpoint, &config.model, history);
    let mut req = agent(Duration::from_secs(90))
        .post(&url)
        .header("Content-Type", "application/json");
    if !config.api_key.is_empty() {
        req = req.header("Authorization", &format!("Bearer {}", config.api_key));
    }
    let resp = match req.send(body.to_string()) {
        Ok(r) => r,
        Err(ureq::Error::StatusCode(code)) => {
            return Err(i18n::tr("ai.server_error", &[("code", &code.to_string())]));
        }
        Err(_) => {
            return Err(i18n::t("ai.unreachable"));
        }
    };
    let data = read_bounded(resp)?;
    parse_answer(config.kind, &data).map(|text| text.chars().take(ANSWER_LIMIT).collect())
}

/// The answer's words, from the shape each kind of server replies in.
pub fn parse_answer(kind: Kind, data: &Value) -> Result<String, String> {
    if !data.is_object() {
        return Err(i18n::t("ai.answer_unreadable"));
    }
    let text = kind.answer_text(data);
    if text.trim().is_empty() {
        return Err(i18n::t("ai.answer_empty"));
    }
    Ok(text)
}

pub fn list_models(raw: &Value, api_key: &str) -> Result<Vec<String>, String> {
    if let Some(presets) =
        Kind::parse(raw.get("type").and_then(|v| v.as_str()).unwrap_or("")).and_then(Kind::preset_models)
    {
        return Ok(presets.iter().map(|s| s.to_string()).collect());
    }
    let mut with_model = raw.clone();
    if with_model
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().is_empty())
        .unwrap_or(true)
    {
        with_model["model"] = json!("placeholder");
    }
    let config = validate_config(&with_model)?;
    if config.kind.needs_key() && api_key.is_empty() {
        return Err(i18n::t("ai.models_need_key"));
    }
    let (url, array_key, name_key) = config.kind.models_request(&config.endpoint);
    let mut req = agent(Duration::from_secs(8)).get(&url);
    if !api_key.is_empty() {
        req = req.header("Authorization", &format!("Bearer {api_key}"));
    }
    let mut resp = match req.call() {
        Ok(r) => r,
        Err(ureq::Error::StatusCode(code)) => {
            return Err(i18n::tr("ai.models_failed", &[("code", &code.to_string())]));
        }
        Err(_) => {
            return Err(i18n::t("ai.models_unreachable"));
        }
    };
    let data: Value = resp
        .body_mut()
        .read_json()
        .map_err(|_| i18n::t("ai.models_unreadable"))?;
    let arr = data
        .get(array_key)
        .and_then(|v| v.as_array())
        .ok_or_else(|| i18n::t("ai.models_unreadable"))?;
    let mut seen = std::collections::HashSet::new();
    Ok(arr
        .iter()
        .filter_map(|e| e.get(name_key).and_then(|v| v.as_str()).map(str::to_string))
        .filter(|s| !s.is_empty() && seen.insert(s.clone()))
        .take(150)
        .collect())
}

pub fn detect_ollama(endpoint: &str) -> Vec<String> {
    let Ok(mut resp) = agent(Duration::from_millis(1500))
        .get(&format!("{endpoint}/api/tags"))
        .call()
    else {
        return Vec::new();
    };
    let Ok(data) = resp.body_mut().read_json::<Value>() else {
        return Vec::new();
    };
    data.get("models")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|m| m.get("name").and_then(|v| v.as_str()).map(str::to_string))
                .take(50)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn each_kind_of_server_is_read_in_its_own_shape_and_an_empty_answer_is_an_error() {
        let openai = json!({"output": [
            {"type": "reasoning"},
            {"type": "message", "content": [{"type": "output_text", "text": "Hi"}, {"type": "output_text", "text": "there"}]}
        ]});
        assert_eq!(parse_answer(Kind::OpenAi, &openai).unwrap(), "Hi\nthere");
        let ollama = json!({"message": {"role": "assistant", "content": "안녕!"}});
        assert_eq!(parse_answer(Kind::Ollama, &ollama).unwrap(), "안녕!");
        let compatible = json!({"choices": [{"message": {"content": "Hello"}}]});
        assert_eq!(parse_answer(Kind::Compatible, &compatible).unwrap(), "Hello");
        assert!(parse_answer(Kind::Ollama, &json!({"message": {"content": "  "}})).is_err());
        assert!(parse_answer(Kind::OpenAi, &json!([1, 2])).is_err());
    }

    #[test]
    fn cli_types_need_no_key_or_endpoint_and_http_types_enforce_rules() {
        let c = validate_config(&json!({"type": "claude", "model": "  "})).unwrap();
        assert_eq!(
            (c.kind, c.model.as_str(), c.endpoint.as_str(), c.api_key.as_str()),
            (Kind::Claude, "", "", "")
        );
        assert!(
            validate_config(&json!({"type": "compatible", "endpoint": "http://example.com/v1", "model": "m"}))
                .unwrap_err()
                .contains("HTTPS")
        );
        assert!(
            validate_config(&json!({"type": "compatible", "endpoint": "https://u:p@example.com/v1", "model": "m"}))
                .unwrap_err()
                .contains("password")
        );
        let ok = validate_config(&json!({"type": "compatible", "endpoint": "http://127.0.0.1:1234/v1/", "model": "m"}))
            .unwrap();
        assert_eq!(ok.endpoint, "http://127.0.0.1:1234/v1");
        let ollama = validate_config(&json!({"type": "ollama", "model": "llama"})).unwrap();
        assert_eq!(ollama.endpoint, OLLAMA_DEFAULT);
    }

    #[test]
    fn model_presets_stay_alias_only() {
        assert_eq!(
            list_models(&json!({"type": "claude"}), "").unwrap(),
            vec!["sonnet", "opus", "haiku"]
        );
        assert!(
            list_models(&json!({"type": "openai", "model": "x"}), "")
                .unwrap_err()
                .contains("API key")
        );
    }
}
