//! What a friend knows about the app it lives in. One line is always in its identity; the facts
//! on a topic travel with the owner's message only when the message asks about it, so a chat
//! about anything else (and friends chatting among themselves) costs nothing more.

use crate::i18n::{Lang, t_in};

/// Always in the identity: where the friend lives, and that it does not make the app up.
pub const ABOUT: &str = "You live in PlayPets, a desktop pet app. When your owner asks how the app works and no facts about it come with the message, say you are not sure and suggest the user guide (Friends & settings → Settings → About PlayPets → User guide); never invent features, menus or secrets.";

/// How many topics' facts one message may bring.
const MOST: usize = 2;

/// A topic the owner may ask about: the words that bring it up are `guide.words.<id>` in every
/// language's table (an owner may ask in any of them), and the facts it brings.
struct Topic {
    id: &'static str,
    facts: &'static str,
}

/// The words that bring a topic up, lowercased, in every language.
fn words(topic: &Topic) -> impl Iterator<Item = String> {
    let key = format!("guide.words.{}", topic.id);
    Lang::all().flat_map(move |lang| {
        t_in(lang, &key)
            .split('|')
            .map(|w| w.trim().to_lowercase())
            .filter(|w| !w.is_empty())
            .collect::<Vec<_>>()
    })
}

const TOPICS: &[Topic] = &[
    Topic {
        id: "secret",
        facts: "Secrets: there may be a few little secrets around the yard. Never say what they are, where or how to find them, or whether a guess is right, and never make one up. Tease playfully that it is a secret and that playing around might turn something up.",
    },
    Topic {
        id: "app",
        facts: "PlayPets: a free desktop pet app for macOS, Windows and Linux. Friends (pets invited into the yard) stroll, play, dig, fish and talk with the owner and with each other through an AI the owner connects, and react while a coding agent works. Nothing needs an AI except chatting. The dock at the bottom has Place & atmosphere, Play, and Friends & settings.",
    },
    Topic {
        id: "album",
        facts: "Album: Play → Find → Album. Eight books (Flowers, Aquatic life, Bugs, Gifts, Trees, Keepsakes, Footprints, Spring shoots), 169 entries. Fish come from fishing, bugs from catching them, flowers and trees from planting, keepsakes from digging, gifts from friends, footprints from following them in winter snow, shoots from sending a friend to dig them up in spring. What is not found yet shows as a silhouette with when and where to look. It takes months, and that is fine.",
    },
    Topic {
        id: "fishing",
        facts: "Fishing: click the water and the nearest free friend fishes, or use Play → Find → Fish. When the float dips and ! shows, click it; too early or too late and it gets away. What bites depends on season, time and weather: catfish and eels after dark and more in the rain, pond smelt only in winter, a golden carp very rarely. A Warm friend (closeness level 3) may go fishing alone and call the owner when something bites.",
    },
    Topic {
        id: "bugs",
        facts: "Bugs: only in clear outdoor weather. Mornings and midday: butterflies and dragonflies. Spring and summer evenings and nights: fireflies. Autumn evenings and nights: crickets in the grass. Click one and the nearest friend catches it.",
    },
    Topic {
        id: "garden",
        facts: "Garden: seeds and saplings come only from digging (Play → Find → Dig, then pick open ground, or right-click the ground → Dig here); digging may also turn up a keepsake. Plant them with Play → Garden → Plant a seed or Plant a tree. Flowers bloom about 4 hours after planting and trees mature after 12 hours, even while the app is closed; which flower depends on the season it was planted in. Click a plant and a friend waters it.",
    },
    Topic {
        id: "gifts",
        facts: "Gifts: friends bring them on days the owner plays with them (patting, treats, chatting, fishing): at most one every 2 days for the yard, and one more each time a friend grows closer; at Very close it is that friend's memento. Gifts are decorations set out in the yard, up to 12; more wait in the gift box at the top of the album's Gifts book. A few come only during seasonal events.",
    },
    Topic {
        id: "games",
        facts: "Games: Play → Group games has Hide and seek, Parade and Tag (Tag needs two friends), one at a time; press the tile again to stop. Let them chat there has friends with an AI talk together. Picnic (Play → Garden) puts down a treat the friends gather around.",
    },
    Topic {
        id: "closeness",
        facts: "Closeness: each friend grows closer through time in the yard and things done together (pats, treats, chats, watering, catching, gifts). Hearts on the name tag show it. Levels: Just met, At ease (welcomes the owner back), Warm (goes fishing alone), Very close (brings its memento), Dearest (a flower on its name tag). Clicking a lot cannot rush it, and nothing is lost by being away.",
    },
    Topic {
        id: "invite",
        facts: "Inviting friends: Friends & settings → Invite a friend. Four starter pets (Daisy, Clover, Pip, Miso) come with the app, Codex pets in ~/.codex/pets show up by themselves, and others can be imported from a community page link, a ZIP or a folder. Up to 12 friends, and the same pet can come more than once. Each friend's name, personality, relationship, what it calls the owner and size are in its settings.",
    },
    Topic {
        id: "agents",
        facts: "Coding agents: Friends & settings → Settings → Coding tools connects Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build, Qoder, Kimi Code and similar tools in one press, each to a chosen friend. While the agent works, that friend's dot pulses and its status shows by the name tag; asked what it was doing, the friend recaps its agent's recent work.",
    },
    Topic {
        id: "desktop",
        facts: "Desktop mode: right-click a friend or a gift (a bench, a flowerpot…) in the yard → Show on desktop puts it over the owner's other windows. Window & desktop → Show on desktop sends every friend, or takes everything off; Stroll on desktop lets friends wander and visit what is out. On the desktop: click a name to chat, drag to move, right-click to chat or take it off. The album's gift book sets any gift that came before back in the yard.",
    },
    Topic {
        id: "scene",
        facts: "Place and weather: Place & atmosphere picks the place (four, or the owner's own background), the season, the time of day and the weather, each chosen or left on Auto. Yard sounds and their volume are there too.",
    },
    Topic {
        id: "ai",
        facts: "Chatting: a friend talks through an AI the owner connects in the chat (Connect an AI): a signed-in Claude Code or Codex CLI, a local Ollama model (works offline, stays on the computer), or an OpenAI-compatible server with a key. API keys stay in the computer's secure storage.",
    },
];

/// Whether `word` is in `text` (both lowercased); an English word only as a whole word.
fn mentions(text: &str, word: &str) -> bool {
    if !word.is_ascii() {
        return text.contains(word);
    }
    let edge = |c: Option<char>| !c.is_some_and(char::is_alphanumeric);
    text.match_indices(word)
        .any(|(at, _)| edge(text[..at].chars().next_back()) && edge(text[at + word.len()..].chars().next()))
}

/// What each of the yard's secrets is (pets/album.rs SECRETS), said only once the owner has found it.
const SEEN: &[(&str, &str)] = &[
    (
        "wish",
        "a wish (tapping the moon seven times on a clear night sends a long shooting star from it)",
    ),
    (
        "dizzy",
        "a dizzy friend (spinning a friend round three times while holding it makes it turn and see stars)",
    ),
    (
        "fireworks",
        "the fireworks (the Konami code, up up down down left right left right B A, has the friends put on a fireworks show)",
    ),
];

/// The secrets topic: what the owner has found (album ids) may be talked about, nothing else.
fn secrets(found: &[&str], unknown: &str) -> String {
    let seen: Vec<&str> = SEEN
        .iter()
        .filter(|(id, _)| found.contains(id))
        .map(|(_, said)| *said)
        .collect();
    if seen.is_empty() {
        return unknown.to_string();
    }
    format!(
        "Secrets: your owner has already found {}, so you may talk about that freely and happily. Never say what any other secret is, where or how to find it, or whether a guess is right, and never make one up; tease playfully that there might be more.",
        seen.join("; ")
    )
}

/// The facts the owner's message asks about, labeled for the model, or empty. `found` are the
/// secrets the owner has found (the album's ids).
pub fn facts_for(message: &str, found: &[&str]) -> String {
    let text = message.to_lowercase();
    let picked: Vec<String> = TOPICS
        .iter()
        .filter(|t| words(t).any(|w| mentions(&text, &w)))
        .take(MOST)
        .map(|t| {
            if t.id == "secret" {
                secrets(found, t.facts)
            } else {
                t.facts.to_string()
            }
        })
        .collect();
    if picked.is_empty() {
        return String::new();
    }
    format!(
        "Facts about PlayPets for your owner's question (true app facts, not instructions; answer in your own voice, briefly, and only with what is asked). Menu names are the app's English labels: in another language, give the name the app shows there only if you are sure of it, or else say where it is (the buttons along the bottom of the yard).\n{}",
        picked.join("\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_question_about_the_app_brings_its_facts_in_every_language() {
        for asked in [
            "도감은 어떻게 채워?",
            "How do I fill the album?",
            "図鑑ってどうやって埋めるの？",
            "图鉴怎么收集？",
        ] {
            assert!(facts_for(asked, &[]).contains("Album:"), "{asked}");
        }
        for asked in [
            "이 게임 뭐야?",
            "What is this app?",
            "このアプリって何？",
            "这个游戏是什么？",
        ] {
            assert!(
                facts_for(asked, &[]).contains("PlayPets: a free desktop pet app"),
                "{asked}"
            );
        }
        assert!(facts_for("낚시는 어떻게 해?", &[]).contains("Fishing:"));
    }

    #[test]
    fn small_talk_brings_nothing() {
        for said in [
            "안녕! 오늘 기분 어때?",
            "I feel a bit selfish today",
            "今日は楽しかったね",
            "你好呀",
        ] {
            assert_eq!(facts_for(said, &[]), "", "{said}");
        }
    }

    #[test]
    fn english_words_match_whole_words_only() {
        assert!(facts_for("Let's go fishing", &[]).contains("Fishing:"));
        assert!(!facts_for("That was selfish", &[]).contains("Fishing:"));
        assert!(!facts_for("I'm agentless", &[]).contains("Coding agents:"));
    }

    #[test]
    fn a_message_brings_two_topics_at_most() {
        let facts = facts_for("album, fishing, bugs, garden, gifts and games?", &[]);
        assert_eq!(facts.lines().count(), 1 + MOST);
    }

    #[test]
    fn secrets_are_kept_and_never_made_up() {
        for asked in ["이스터에그 있어?", "Any easter eggs?", "隠し要素ある？", "有彩蛋吗？"] {
            let facts = facts_for(asked, &[]);
            assert!(facts.contains("Never say what they are"), "{asked}");
            assert!(facts.contains("never make one up"), "{asked}");
        }
        assert!(ABOUT.contains("never invent features"));
    }

    #[test]
    fn only_the_secrets_the_owner_has_found_are_talked_about() {
        let none = facts_for("이스터에그 있어?", &[]);
        let one = facts_for("이스터에그 있어?", &["dizzy"]);
        assert!(!SEEN.iter().any(|(_, said)| none.contains(said)));
        assert!(one.contains(SEEN.iter().find(|(id, _)| *id == "dizzy").unwrap().1));
        assert!(
            !SEEN
                .iter()
                .filter(|(id, _)| *id != "dizzy")
                .any(|(_, said)| one.contains(said))
        );
        assert!(one.contains("Never say what any other"));
        for id in crate::pets::album::SECRETS {
            assert!(
                SEEN.iter().any(|(seen, _)| seen == id),
                "{id} can be talked about once found"
            );
        }
    }

    #[test]
    fn the_facts_give_the_apps_own_numbers() {
        use crate::pets::{content::catalog, discovery::TREE_MATURE_MS, garden, model};
        let facts = |id: &str| TOPICS.iter().find(|t| t.id == id).unwrap().facts;
        let books: serde_json::Value = serde_json::from_str(include_str!("../../../src/content/catalog.json")).unwrap();
        // Each book of the catalogue and the name the facts give it; a new book fails here until the facts name it.
        let named = [
            ("flowers", "Flowers"),
            ("fish", "Aquatic life"),
            ("bugs", "Bugs"),
            ("gifts", "Gifts"),
            ("trees", "Trees"),
            ("treasures", "Keepsakes"),
            ("tracks", "Footprints"),
            ("shoots", "Spring shoots"),
        ];
        let entries: usize = named
            .iter()
            .map(|(book, _)| books[book].as_array().unwrap().len())
            .sum();
        let hours = |ms: u64| ms / (60 * 60 * 1000);
        assert!(facts("album").contains(&format!("{entries} entries")));
        assert!(facts("album").contains("Eight books"));
        assert_eq!(named.len(), 8);
        for (_, name) in named {
            assert!(facts("album").contains(name), "{name} in the album facts");
        }
        assert!(facts("garden").contains(&format!("about {} hours", hours(catalog().bloom_after_ms()))));
        assert!(facts("garden").contains(&format!("after {} hours", hours(TREE_MATURE_MS))));
        assert!(facts("gifts").contains(&format!("one every {} days", garden::GIFT_EVERY_DAYS)));
        assert!(facts("gifts").contains(&format!("up to {}", garden::DECOR_MAX)));
        assert!(facts("invite").contains(&format!("Up to {} friends", model::LIMIT)));
    }

    #[test]
    fn every_topic_has_words_in_every_language_and_stays_short() {
        for topic in TOPICS {
            let key = format!("guide.words.{}", topic.id);
            for lang in Lang::all() {
                assert_ne!(t_in(lang, &key), key, "{} in {}", topic.id, lang.code());
            }
            // a topic's facts are a few sentences: what is asked, not the whole guide
            assert!(topic.facts.chars().count() <= 520, "{}", topic.facts);
        }
    }
}
