//! Every sentence the app shows a person, in the languages it speaks. A key names the situation
//! (`error.pet_missing`), each language's file (ko.rs, en.rs, ja.rs, zh_hans.rs) gives the sentence, and
//! `{name}`-style holes are filled by `tr`. Adding a language is a new file and one row in `ALL`
//! (docs/how-to/add-a-language.md). Terminals and coding agents are spoken to in English by agent/cli.rs,
//! which is not translated; what they report is carried as `@codes` and worded here, so a status
//! reads in the language of the app that shows it.
mod en;
mod ja;
mod ko;
mod zh_hans;

use std::sync::atomic::{AtomicU8, Ordering};

/// What a language brings: its code, its name in English (for the pet's prompt) and its sentences.
/// Each language file declares its own.
pub(crate) struct Spec {
    code: &'static str,
    english_name: &'static str,
    table: &'static [(&'static str, &'static str)],
}
/// The languages, in the order the settings tab lists them. Adding one is its file and a row here.
static ALL: [&Spec; 4] = [&ko::SPEC, &en::SPEC, &ja::SPEC, &zh_hans::SPEC];
/// The language the app falls back to; where it sits in `ALL` (CURRENT starts there).
const FALLBACK: usize = 1;

/// One of the languages in `ALL`, by position.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Lang(u8);
impl Default for Lang {
    fn default() -> Lang {
        Lang(FALLBACK as u8)
    }
}
static CURRENT: AtomicU8 = AtomicU8::new(FALLBACK as u8);

impl Lang {
    fn spec(self) -> &'static Spec {
        ALL[self.0 as usize]
    }
    /// Every language, in the order they are listed.
    pub fn all() -> impl Iterator<Item = Lang> {
        (0..ALL.len() as u8).map(Lang)
    }
    pub fn code(self) -> &'static str {
        self.spec().code
    }
    /// The language's own name in English, for the pet's prompt.
    pub fn english_name(self) -> &'static str {
        self.spec().english_name
    }
    /// The language's sentences, as (key, sentence).
    pub fn table(self) -> &'static [(&'static str, &'static str)] {
        self.spec().table
    }
    /// "ko", "ko-KR", "ja_JP.UTF-8", "en-US" → the language; anything else is None. A tag with a
    /// script or region is tried whole first ("zh-hant"), so a language that comes in more than
    /// one script can be listed under its full code, then by its language part alone.
    pub fn parse(tag: &str) -> Option<Lang> {
        candidates(tag)
            .into_iter()
            .find_map(|code| Lang::all().find(|l| l.code() == code))
    }
}

/// The codes a locale tag may be listed under, most specific first: "zh_Hant_TW.UTF-8" →
/// ["zh-hant-tw", "zh-hant", "zh"].
fn candidates(tag: &str) -> Vec<String> {
    let tag = tag.trim().to_ascii_lowercase();
    let tag = tag.split(['.', '@']).next().unwrap_or("");
    let mut parts: Vec<&str> = tag
        .split(['-', '_'])
        .filter(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric()))
        .collect();
    // Chinese comes in two scripts, and systems often say only the region: zh-CN, zh-SG and
    // bare zh are the simplified one; zh-TW, zh-HK and zh-MO the traditional one.
    if parts.first() == Some(&"zh") && !matches!(parts.get(1), Some(&"hans") | Some(&"hant")) {
        let script = match parts.get(1) {
            Some(&"tw") | Some(&"hk") | Some(&"mo") => Some("hant"),
            Some(&"cn") | Some(&"sg") | Some(&"my") | None => Some("hans"),
            _ => None,
        };
        if let Some(script) = script {
            parts.insert(1, script);
        }
    }
    (1..=parts.len()).rev().map(|n| parts[..n].join("-")).collect()
}

pub fn set(lang: Lang) {
    CURRENT.store(lang.0, Ordering::Relaxed);
}
pub fn current() -> Lang {
    Lang(CURRENT.load(Ordering::Relaxed))
}
/// The language to start in: `PLAYPETS_LANG` first (a test, or a person who wants to force
/// it), then the one saved in state.json, then the system's, then English.
pub fn pick_language(saved: Option<&str>, env: Option<&str>, system: Option<&str>) -> Lang {
    env.and_then(Lang::parse)
        .or_else(|| saved.and_then(Lang::parse))
        .or_else(|| system.and_then(Lang::parse))
        .unwrap_or_default()
}
/// `PLAYPETS_LANG`, when set.
pub fn forced() -> Option<String> {
    std::env::var("PLAYPETS_LANG").ok()
}

/// The sentence for `key` in the current language; the key itself when there is none, so a
/// missing entry is visible rather than silent.
pub fn t(key: &str) -> String {
    t_in(current(), key)
}
pub fn t_in(lang: Lang, key: &str) -> String {
    lang.table()
        .iter()
        .find(|row| row.0 == key)
        .map(|row| row.1.to_string())
        .unwrap_or_else(|| key.to_string())
}
/// `tr("x", &[("name", "Frieren")])` fills `{name}`.
pub fn tr(key: &str, args: &[(&str, &str)]) -> String {
    tr_in(current(), key, args)
}
/// Holes are filled in one pass over the sentence, so a value that itself contains `{hole}`
/// (a raw error message, say) is kept as it is rather than filled again.
pub fn tr_in(lang: Lang, key: &str, args: &[(&str, &str)]) -> String {
    let template = t_in(lang, key);
    let mut out = String::with_capacity(template.len());
    let mut rest = template.as_str();
    while let Some(start) = rest.find('{') {
        out.push_str(&rest[..start]);
        let hole = &rest[start..];
        let Some(end) = hole.find('}') else {
            rest = hole;
            break;
        };
        match args.iter().find(|(k, _)| *k == &hole[1..end]) {
            Some((_, v)) => out.push_str(v),
            None => out.push_str(&hole[..=end]),
        }
        rest = &hole[end + 1..];
    }
    out.push_str(rest);
    out
}
/// A sentence of ours with the system's own words after it: `{detail}` takes the raw error, so
/// a person reads what failed in their language and a report still carries the original.
pub fn detail(key: &str, error: impl std::fmt::Display) -> String {
    tr(key, &[("detail", &error.to_string())])
}
pub fn detail_for(key: &str, name: &str, error: impl std::fmt::Display) -> String {
    tr(key, &[("name", name), ("detail", &error.to_string())])
}

/// A status a coding agent reported, as agent/cli.rs codes it (`@tool Bash`), in words; any other
/// message (a `say`, an MCP status) is a person's or an agent's own words and passes through.
pub fn agent_message(message: &str) -> String {
    agent_message_in(current(), message)
}
pub fn agent_message_in(lang: Lang, message: &str) -> String {
    let Some(code) = message.strip_prefix('@') else {
        return message.to_string();
    };
    let (key, arg) = code.split_once(' ').unwrap_or((code, ""));
    tr_in(lang, &format!("agent.{key}"), &[("name", arg)])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lang(code: &str) -> Lang {
        Lang::parse(code).unwrap()
    }

    #[test]
    fn language_tags_of_every_shape_are_understood() {
        assert_eq!(Lang::parse("ko-KR"), Some(lang("ko")));
        assert_eq!(Lang::parse("ja_JP.UTF-8"), Some(lang("ja")));
        assert_eq!(Lang::parse(" en"), Some(lang("en")));
        assert_eq!(Lang::parse("fr-FR"), None);
        assert_eq!(Lang::parse(""), None);
        assert_eq!(Lang::parse("zh-Hant-TW"), None, "no traditional Chinese yet");
        assert_eq!(Lang::parse("zh-CN").map(Lang::code), Some("zh-hans"));
        assert_eq!(Lang::parse("zh").map(Lang::code), Some("zh-hans"));
        assert_eq!(Lang::parse("zh_Hans_CN.UTF-8").map(Lang::code), Some("zh-hans"));
        assert_eq!(candidates("zh_Hant_TW.UTF-8"), ["zh-hant-tw", "zh-hant", "zh"]);
        assert_eq!(candidates("zh-TW"), ["zh-hant-tw", "zh-hant", "zh"]);
        assert_eq!(candidates(" en "), ["en"]);
        assert_eq!(candidates("??"), Vec::<String>::new());
        assert_eq!(Lang::default().code(), "en", "the fallback is English");
        assert_eq!(ALL[FALLBACK].code, "en");
        let codes: Vec<&str> = Lang::all().map(Lang::code).collect();
        assert_eq!(codes, ["ko", "en", "ja", "zh-hans"]);
    }

    #[test]
    fn holes_are_filled_once_and_unknown_holes_stay() {
        let en = lang("en");
        assert_eq!(
            tr_in(en, "chat.from_friend", &[("name", "{detail}"), ("detail", "x")]),
            "{detail}: x",
            "a value is never filled again"
        );
        assert_eq!(tr_in(en, "chat.from_friend", &[("name", "A")]), "A: {detail}");
        assert_eq!(
            detail_for("store.write_failed", "state.json", "disk full"),
            "Couldn't save the state.json file. disk full"
        );
    }

    // ko.rs is the reference: every language names the same keys in the same order (so the files
    // stay side by side), none is empty, and the holes match.
    #[test]
    fn every_language_says_every_key_and_holes_match() {
        let holes = |s: &str| {
            let mut h: Vec<String> = Vec::new();
            let mut rest = s;
            while let Some(i) = rest.find('{') {
                let end = rest[i..].find('}').map(|e| i + e).unwrap();
                h.push(rest[i..=end].to_string());
                rest = &rest[end + 1..];
            }
            h.sort();
            h
        };
        let base = lang("ko").table();
        let mut seen = std::collections::HashSet::new();
        for (key, _) in base {
            assert!(seen.insert(key), "{key} is listed twice");
        }
        for lang in Lang::all() {
            let table = lang.table();
            let keys: Vec<&str> = table.iter().map(|r| r.0).collect();
            let base_keys: Vec<&str> = base.iter().map(|r| r.0).collect();
            assert_eq!(keys, base_keys, "{} names the same keys, in ko's order", lang.code());
            for ((key, a), (_, b)) in base.iter().zip(table) {
                assert!(!b.trim().is_empty(), "{key} is empty in {}", lang.code());
                assert_eq!(holes(a), holes(b), "{key}: holes differ (ko/{})", lang.code());
            }
        }
        assert_eq!(Lang::parse("JA").map(|l| l.english_name()), Some("Japanese"));
    }

    #[test]
    fn the_environment_outranks_the_saved_language_which_outranks_the_system() {
        assert_eq!(pick_language(Some("ja"), Some("ko"), Some("en-US")), lang("ko"));
        assert_eq!(pick_language(Some("ja"), None, Some("en-US")), lang("ja"));
        assert_eq!(pick_language(None, None, Some("ko-KR")), lang("ko"));
        assert_eq!(pick_language(Some("xx"), Some("yy"), Some("zz")), lang("en"));
        assert_eq!(pick_language(None, None, None), lang("en"));
    }

    #[test]
    fn agent_codes_are_worded_in_the_current_language_and_words_pass_through() {
        assert_eq!(agent_message_in(lang("en"), "@tool Bash"), "Using Bash");
        assert_eq!(agent_message_in(lang("en"), "@done"), "Finished the task");
        assert_eq!(agent_message_in(lang("ja"), "tests passed"), "tests passed");
        assert_eq!(
            agent_message_in(lang("ko"), "@failed 2"),
            "작업이 오류로 끝났어요 (코드 2)"
        );
        assert_eq!(t("no.such.key"), "no.such.key", "a missing key shows itself");
    }

    /// The sentences themselves (i18n/ko.rs and the others) are not modules to check.
    fn is_language_file(path: &std::path::Path) -> bool {
        path.parent().is_some_and(|p| p.ends_with("i18n")) && path.file_stem().is_some_and(|s| s != "mod")
    }

    /// Every module under src/, as (path, text before its tests). Walked rather than listed, so a
    /// new or moved module is checked too; the language files themselves are left out.
    fn sources() -> Vec<(String, String)> {
        fn walk(dir: &std::path::Path, out: &mut Vec<(String, String)>) {
            for entry in std::fs::read_dir(dir).unwrap().flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, out);
                } else if path.extension().is_some_and(|e| e == "rs") && !is_language_file(&path) {
                    let text = std::fs::read_to_string(&path).unwrap();
                    // Only the test module is left out; anything test-only before it would
                    // hide the lines after it, so it has to live inside the module.
                    let body = text.split("#[cfg(test)]\nmod tests").next().unwrap().to_string();
                    assert!(
                        !body.contains("#[cfg(test)]"),
                        "{}: keep test-only code inside `mod tests`",
                        path.display()
                    );
                    out.push((path.display().to_string(), body));
                }
            }
        }
        let mut out = Vec::new();
        walk(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src"), &mut out);
        assert!(out.len() > 10, "the walk found the modules");
        out
    }

    // Every sentence a person sees lives in the table: the modules themselves carry no Korean
    // outside their tests (agent/cli.rs speaks English to agents and terminals).
    #[test]
    fn modules_keep_no_korean_of_their_own() {
        // Comments included: contributors read the notes in every language.
        let hangul = |c: char| ('\u{ac00}'..='\u{d7a3}').contains(&c);
        for (name, body) in sources() {
            for (n, line) in body.lines().enumerate() {
                assert!(
                    !line.chars().any(hangul),
                    "{name}:{} has Korean outside the table: {line}",
                    n + 1
                );
            }
        }
    }

    // Every key the modules ask for is in the table (a typo would otherwise show as the key).
    #[test]
    fn every_key_asked_for_is_in_the_table() {
        for (name, body) in sources() {
            // Examples in comments are not requests for a key.
            let src: String = body
                .lines()
                .filter(|l| !l.trim_start().starts_with("//"))
                .collect::<Vec<_>>()
                .join("\n");
            for marker in ["t(\"", "tr(\"", "detail(\"", "detail_for(\""] {
                for (at, _) in src.match_indices(marker) {
                    let before = src[..at].chars().last().unwrap_or(' ');
                    if before.is_alphanumeric() || before == '_' {
                        continue;
                    }
                    let rest = &src[at + marker.len()..];
                    let key = rest.split('"').next().unwrap();
                    assert!(
                        lang("ko").table().iter().any(|r| r.0 == key),
                        "{name}: no entry for key {key}"
                    );
                }
            }
        }
    }
}
