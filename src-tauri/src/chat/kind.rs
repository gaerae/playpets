//! The kinds of AI a friend can be connected to, and what differs between them: two
//! subscription CLIs spoken to through their binaries, and four HTTP servers with their own
//! request and reply shapes. Adding a kind is a variant here, a form in src/panel/connection.js
//! and an option in index.html; everything else reads this table.
use super::http::OLLAMA_DEFAULT;
use serde_json::{Value, json};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Claude,
    Codex,
    Ollama,
    OpenAi,
    Xai,
    Compatible,
}

impl Kind {
    pub const ALL: [Kind; 6] = [
        Kind::Claude,
        Kind::Codex,
        Kind::Ollama,
        Kind::OpenAi,
        Kind::Xai,
        Kind::Compatible,
    ];

    /// The id the page and the state file use.
    pub fn parse(id: &str) -> Option<Kind> {
        Kind::ALL.into_iter().find(|k| k.id() == id)
    }
    pub fn id(self) -> &'static str {
        match self {
            Kind::Claude => "claude",
            Kind::Codex => "codex",
            Kind::Ollama => "ollama",
            Kind::OpenAi => "openai",
            Kind::Xai => "xai",
            Kind::Compatible => "compatible",
        }
    }
    /// The name a connection shows when the person gave it none. A compatible server has no
    /// name of its own; the caller words that in the app's language.
    pub fn label(self) -> Option<&'static str> {
        match self {
            Kind::Claude => Some("Claude Code"),
            Kind::Codex => Some("Codex CLI"),
            Kind::Ollama => Some("Ollama"),
            Kind::OpenAi => Some("OpenAI"),
            Kind::Xai => Some("Grok"),
            Kind::Compatible => None,
        }
    }
    /// Spoken to through a command on this computer rather than over HTTP.
    pub fn is_cli(self) -> bool {
        matches!(self, Kind::Claude | Kind::Codex)
    }
    /// Refuses to talk without an API key.
    pub fn needs_key(self) -> bool {
        matches!(self, Kind::OpenAi | Kind::Xai)
    }
    /// A server whose address is not the person's to choose.
    pub fn fixed_endpoint(self) -> Option<&'static str> {
        match self {
            Kind::OpenAi => Some("https://api.openai.com/v1"),
            Kind::Xai => Some("https://api.x.ai/v1"),
            _ => None,
        }
    }
    /// Where the server usually listens, when the person left the address empty.
    pub fn default_endpoint(self) -> Option<&'static str> {
        match self {
            Kind::Ollama => Some(OLLAMA_DEFAULT),
            _ => None,
        }
    }
    /// Models offered without asking a server: the CLIs take short aliases.
    pub fn preset_models(self) -> Option<&'static [&'static str]> {
        match self {
            Kind::Claude => Some(&["sonnet", "opus", "haiku"]),
            Kind::Codex => Some(&["gpt-5-codex", "gpt-5"]),
            _ => None,
        }
    }
    /// The chat request for an HTTP kind: its URL and body. xAI answers OpenAI's Responses API
    /// and calls its chat completions legacy.
    pub fn chat_request(self, endpoint: &str, model: &str, history: Vec<Value>) -> (String, Value) {
        match self {
            Kind::OpenAi | Kind::Xai => (
                format!("{endpoint}/responses"),
                json!({"model": model, "input": history, "store": false, "max_output_tokens": 1200}),
            ),
            Kind::Ollama => (
                format!("{endpoint}/api/chat"),
                json!({"model": model, "messages": history, "stream": false}),
            ),
            _ => (
                format!("{endpoint}/chat/completions"),
                json!({"model": model, "messages": history, "stream": false, "max_tokens": 1200}),
            ),
        }
    }
    /// The answer's words in a chat reply, or an empty string when the reply has none.
    pub fn answer_text(self, data: &Value) -> String {
        match self {
            Kind::OpenAi | Kind::Xai => data
                .get("output")
                .and_then(|o| o.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("message"))
                        .flat_map(|b| b.get("content").and_then(|c| c.as_array()).cloned().unwrap_or_default())
                        .filter(|c| c.get("type").and_then(|t| t.as_str()) == Some("output_text"))
                        .filter_map(|c| c.get("text").and_then(|t| t.as_str()).map(str::to_string))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default(),
            Kind::Ollama => data
                .pointer("/message/content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            _ => data
                .pointer("/choices/0/message/content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        }
    }
    /// How to list a server's models: the URL, the key of the array in the reply, and the key
    /// of a model's name in each entry.
    pub fn models_request(self, endpoint: &str) -> (String, &'static str, &'static str) {
        match self {
            Kind::Ollama => (format!("{endpoint}/api/tags"), "models", "name"),
            _ => (format!("{endpoint}/models"), "data", "id"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_has_an_id_that_parses_back_and_the_table_is_consistent() {
        for kind in Kind::ALL {
            assert_eq!(Kind::parse(kind.id()), Some(kind));
            if kind.is_cli() {
                assert!(kind.preset_models().is_some(), "{kind:?} offers aliases");
                assert!(!kind.needs_key());
            }
        }
        assert_eq!(Kind::parse("gpt"), None);
        // xAI's own API: a key, its fixed address, and the Responses API it recommends over the
        // legacy chat completions, in OpenAI's shape and kept off xAI's servers like OpenAI's.
        assert_eq!(Kind::parse("xai"), Some(Kind::Xai));
        assert_eq!(Kind::Xai.label(), Some("Grok"));
        assert!(Kind::Xai.needs_key() && !Kind::Xai.is_cli());
        assert_eq!(Kind::Xai.fixed_endpoint(), Some("https://api.x.ai/v1"));
        let (url, body) = Kind::Xai.chat_request("https://api.x.ai/v1", "grok-4", vec![]);
        assert_eq!(url, "https://api.x.ai/v1/responses");
        assert_eq!(
            (body["store"].clone(), body["max_output_tokens"].clone()),
            (json!(false), json!(1200))
        );
        assert_eq!(
            Kind::Xai.models_request("https://api.x.ai/v1"),
            ("https://api.x.ai/v1/models".to_string(), "data", "id")
        );
        assert_eq!(Kind::OpenAi.fixed_endpoint(), Some("https://api.openai.com/v1"));
        assert_eq!(Kind::Ollama.default_endpoint(), Some(OLLAMA_DEFAULT));
        let (url, body) = Kind::Compatible.chat_request("https://x/v1", "m", vec![]);
        assert_eq!(url, "https://x/v1/chat/completions");
        assert_eq!(body["max_tokens"], 1200);
        assert_eq!(
            Kind::Ollama.models_request("http://127.0.0.1:11434").0,
            "http://127.0.0.1:11434/api/tags"
        );
    }
}
