//! Reading a pet page: JSON-LD, meta tags, the title and in-page sprite addresses, with the small text helpers that go with them.
use super::*;

pub(super) fn decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let named = [
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&#39;", "'"),
            ("&#x27;", "'"),
        ];
        if let Some((entity, ch)) = named.iter().find(|(e, _)| tail.starts_with(e)) {
            out.push_str(ch);
            rest = &tail[entity.len()..];
            continue;
        }
        if let Some(end) = tail
            .find(';')
            .filter(|&e| e > 2 && tail.starts_with("&#") && tail[2..e].bytes().all(|b| b.is_ascii_digit()))
            && let Some(c) = tail[2..end].parse::<u32>().ok().and_then(char::from_u32)
        {
            out.push(c);
            rest = &tail[end + 1..];
            continue;
        }
        out.push('&');
        rest = &tail[1..];
    }
    out.push_str(rest);
    out
}
pub(super) fn clean(s: &str, max: usize) -> String {
    catalog::tidy(&decode(s), max)
}
pub(super) fn slugify(s: &str) -> String {
    let mut out = String::new();
    for c in s.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            out.push(c);
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-')
        .chars()
        .take(48)
        .collect::<String>()
        .trim_end_matches('-')
        .to_string()
}

pub(super) fn json_ld(html: &str) -> Vec<Value> {
    let lower = html.to_ascii_lowercase();
    let mut found = Vec::new();
    let mut offset = 0;
    while let Some(start) = lower[offset..].find("<script").map(|i| i + offset) {
        let Some(open_end) = lower[start..].find('>').map(|i| i + start) else {
            break;
        };
        let Some(close) = lower[open_end..].find("</script>").map(|i| i + open_end) else {
            break;
        };
        let tag = &lower[start..open_end];
        if tag.contains("application/ld+json")
            && let Ok(v) = serde_json::from_str::<Value>(html[open_end + 1..close].trim())
        {
            fn walk(v: &Value, out: &mut Vec<Value>) {
                match v {
                    Value::Array(items) => items.iter().for_each(|i| walk(i, out)),
                    Value::Object(map) => {
                        out.push(v.clone());
                        if let Some(g) = map.get("@graph") {
                            walk(g, out);
                        }
                    }
                    _ => {}
                }
            }
            walk(&v, &mut found);
        }
        offset = close + "</script>".len();
    }
    found
        .into_iter()
        .filter(|v| v.get("name").is_some_and(|n| n.is_string()))
        .collect()
}

pub(super) fn meta(html: &str, key: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let mut offset = 0;
    while let Some(start) = lower[offset..].find("<meta").map(|i| i + offset) {
        let end = lower[start..].find('>').map(|i| i + start)?;
        let tag = &lower[start..end];
        let key_at = ["name=\"", "name='", "property=\"", "property='"]
            .iter()
            .find_map(|attr| {
                tag.find(&format!("{attr}{key}"))
                    .filter(|&i| matches!(tag.as_bytes().get(i + attr.len() + key.len()), Some(b'"' | b'\'')))
                    .map(|i| i + attr.len() + key.len())
            });
        if let Some(from) = key_at
            && let Some(c) = tag[from..].find("content=").map(|i| i + from + "content=".len())
        {
            let quote = html.as_bytes().get(start + c).copied();
            if matches!(quote, Some(b'"' | b'\'')) {
                let value_start = start + c + 1;
                let value_end = html[value_start..end]
                    .find(quote.unwrap() as char)
                    .map(|i| i + value_start)?;
                return Some(html[value_start..value_end].to_string());
            }
        }
        offset = end + 1;
    }
    None
}

pub(super) fn title(html: &str) -> String {
    let raw = meta(html, "og:title")
        .or_else(|| {
            let lower = html.to_ascii_lowercase();
            let start = lower.find("<title")?;
            let open_end = lower[start..].find('>')? + start + 1;
            let close = lower[open_end..].find("</title>")? + open_end;
            Some(html[open_end..close].to_string())
        })
        .unwrap_or_default();
    let cut = [" · ", " | ", " – ", " - "]
        .iter()
        .filter_map(|sep| raw.find(sep))
        .min()
        .unwrap_or(raw.len());
    raw[..cut].to_string()
}

/// URLs inside quotes or parentheses that end in .webp/.png (optionally with a query) and look like sprites.
pub(super) fn in_page_sprites(html: &str) -> Vec<String> {
    let delim = |c: char| matches!(c, '"' | '\'' | '(' | ')') || c.is_whitespace();
    let mut out = Vec::new();
    let mut chars = html.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if !matches!(c, '"' | '\'' | '(') {
            continue;
        }
        let start = i + c.len_utf8();
        let end = html[start..].find(delim).map(|e| e + start).unwrap_or(html.len());
        let closes = html[end..]
            .chars()
            .next()
            .is_some_and(|d| matches!(d, '"' | '\'' | ')'));
        let token = &html[start..end];
        if closes && !token.is_empty() {
            let lower = token.to_ascii_lowercase();
            let hit = [".webp", ".png"]
                .iter()
                .flat_map(|ext| lower.match_indices(ext).map(move |(p, _)| p + ext.len()))
                .filter(|&p| p == lower.len() || lower[p..].starts_with('?'))
                .min();
            if let Some(p) = hit {
                if lower[..p].contains("sprite") {
                    out.push(token[..p].to_string());
                }
                while chars.peek().is_some_and(|&(j, _)| j <= end) {
                    chars.next();
                }
            }
        }
    }
    out
}

pub(super) fn first_image(v: Option<&Value>) -> Option<String> {
    match v? {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => first_image(items.first()),
        Value::Object(map) => map
            .get("url")
            .or_else(|| map.get("contentUrl"))
            .and_then(|u| u.as_str())
            .map(str::to_string),
        _ => None,
    }
}
