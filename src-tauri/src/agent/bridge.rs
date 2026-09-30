// The 127.0.0.1 agent bridge (bearer token, no browser origins) that the
// CLI mode in agent/cli.rs — hooks, MCP, status commands — talks to.
use serde_json::{Value, json};
use std::io::Read;
use std::sync::Arc;
use tiny_http::{Header, Method, Response, Server};

pub const STATES: [&str; 5] = ["idle", "working", "waiting", "done", "error"];
pub const REACTIONS: [&str; 3] = ["wave", "jump", "pet"];

#[derive(Clone, Debug, PartialEq)]
pub enum AgentEvent {
    Status {
        pet_id: String,
        state: String,
        message: String,
    },
    Say {
        pet_id: String,
        message: String,
    },
    React {
        pet_id: String,
        action: String,
    },
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Instance id first, then case-insensitive name; an empty reference means the first pet.
pub fn resolve_pet(pets: &Value, reference: Option<&str>) -> Option<String> {
    let list = pets.as_array()?;
    let id_of = |p: &Value| p.get("id").and_then(|v| v.as_str()).map(str::to_string);
    let key = reference.map(str::trim).unwrap_or("");
    if key.is_empty() {
        return list.first().and_then(id_of);
    }
    list.iter()
        .find(|p| p.get("id").and_then(|v| v.as_str()) == Some(key))
        .or_else(|| {
            list.iter().find(|p| {
                p.get("name")
                    .and_then(|v| v.as_str())
                    .map(|n| n.to_lowercase() == key.to_lowercase())
                    .unwrap_or(false)
            })
        })
        .and_then(id_of)
}

fn clip(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

/// Validates a route body; returns the event with an empty pet id to be filled in.
fn parse(route: &str, body: &Value) -> Option<AgentEvent> {
    match route {
        "/events" => {
            let state = body.get("state").and_then(|v| v.as_str())?;
            if !STATES.contains(&state) {
                return None;
            }
            let message = match body.get("message") {
                None => "",
                Some(v) => v.as_str()?,
            };
            Some(AgentEvent::Status {
                pet_id: String::new(),
                state: state.into(),
                message: clip(message, 240),
            })
        }
        "/say" => {
            let message = body
                .get("message")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|m| !m.is_empty())?;
            Some(AgentEvent::Say {
                pet_id: String::new(),
                message: clip(message, 240),
            })
        }
        "/react" => {
            let action = body
                .get("action")
                .and_then(|v| v.as_str())
                .filter(|a| REACTIONS.contains(a))?;
            Some(AgentEvent::React {
                pet_id: String::new(),
                action: action.into(),
            })
        }
        _ => None,
    }
}

fn with_pet(event: AgentEvent, id: String) -> AgentEvent {
    match event {
        AgentEvent::Status { state, message, .. } => AgentEvent::Status {
            pet_id: id,
            state,
            message,
        },
        AgentEvent::Say { message, .. } => AgentEvent::Say { pet_id: id, message },
        AgentEvent::React { action, .. } => AgentEvent::React { pet_id: id, action },
    }
}

pub struct Bridge {
    pub port: u16,
}

pub fn start(
    token: String,
    list_pets: Arc<dyn Fn() -> Value + Send + Sync>,
    on_event: Arc<dyn Fn(AgentEvent) + Send + Sync>,
) -> Result<Bridge, String> {
    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().map(|a| a.port()).ok_or("no port")?;
    let secret = format!("Bearer {token}");
    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let reply = |status: u16, body: Value| {
                let mut resp = Response::from_string(body.to_string()).with_status_code(status);
                resp.add_header(Header::from_bytes("Content-Type", "application/json").unwrap());
                resp.add_header(Header::from_bytes("Cache-Control", "no-store").unwrap());
                resp
            };
            let origin = request
                .headers()
                .iter()
                .any(|h| h.field.as_str().as_str().eq_ignore_ascii_case("origin"));
            if origin {
                let _ = request.respond(reply(403, json!({"error": "Browser origins are not allowed"})));
                continue;
            }
            let auth = request
                .headers()
                .iter()
                .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case("authorization"))
                .map(|h| h.value.as_str().to_string())
                .unwrap_or_default();
            if !constant_time_eq(auth.as_bytes(), secret.as_bytes()) {
                let _ = request.respond(reply(401, json!({"error": "Unauthorized"})));
                continue;
            }
            let url = request.url().to_string();
            if *request.method() == Method::Get && url == "/pets" {
                let _ = request.respond(reply(200, list_pets()));
                continue;
            }
            if *request.method() != Method::Post || !["/events", "/say", "/react"].contains(&url.as_str()) {
                let _ = request.respond(reply(404, json!({"error": "Not found"})));
                continue;
            }
            let mut body = Vec::new();
            let mut limited = request.as_reader().take(8193);
            if limited.read_to_end(&mut body).is_err() || body.len() > 8192 {
                let _ = request.respond(reply(413, json!({"error": "Event too large"})));
                continue;
            }
            let parsed = serde_json::from_slice::<Value>(&body).ok().filter(|v| v.is_object());
            let Some((body, event)) = parsed.and_then(|b| parse(&url, &b).map(|e| (b, e))) else {
                let _ = request.respond(reply(400, json!({"error": "Invalid event"})));
                continue;
            };
            let reference = body
                .get("pet")
                .filter(|v| !v.is_null())
                .or_else(|| body.get("petId"))
                .and_then(|v| v.as_str());
            let Some(pet_id) = resolve_pet(&list_pets(), reference) else {
                let _ = request.respond(reply(404, json!({"error": "Unknown pet"})));
                continue;
            };
            on_event(with_pet(event, pet_id.clone()));
            let _ = request.respond(reply(200, json!({"ok": true, "petId": pet_id})));
        }
    });
    Ok(Bridge { port })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[test]
    fn resolves_pets_by_id_name_or_default() {
        let pets = json!([{"id": "p1", "name": "Mangu"}, {"id": "p2", "name": "Frieren"}]);
        assert_eq!(resolve_pet(&pets, Some("p2")).as_deref(), Some("p2"));
        assert_eq!(resolve_pet(&pets, Some("frieren")).as_deref(), Some("p2"));
        assert_eq!(resolve_pet(&pets, None).as_deref(), Some("p1"));
        assert_eq!(resolve_pet(&pets, Some("  ")).as_deref(), Some("p1"));
        assert_eq!(resolve_pet(&pets, Some("nobody")), None);
        assert_eq!(resolve_pet(&json!([]), None), None);
    }

    #[test]
    fn bridge_routes_status_say_and_react_with_token_and_validation() {
        let events: Arc<Mutex<Vec<AgentEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let ev = events.clone();
        let bridge = start(
            "test-secret".into(),
            Arc::new(|| json!([{"id": "a", "name": "Mangu"}, {"id": "b", "name": "Frieren"}])),
            Arc::new(move |e| ev.lock().unwrap().push(e)),
        )
        .unwrap();
        let base = format!("http://127.0.0.1:{}", bridge.port);
        let agent: ureq::Agent = ureq::Agent::config_builder().build().into();
        let code = |r: Result<ureq::http::Response<ureq::Body>, ureq::Error>| match r {
            Ok(x) => x.status().as_u16(),
            Err(ureq::Error::StatusCode(c)) => c,
            Err(e) => panic!("{e}"),
        };
        let post = |route: &str, body: &str| {
            code(
                agent
                    .post(&format!("{base}{route}"))
                    .header("Authorization", "Bearer test-secret")
                    .send(body.to_string()),
            )
        };
        assert_eq!(code(agent.get(&format!("{base}/pets")).call()), 401);
        assert_eq!(
            code(
                agent
                    .get(&format!("{base}/pets"))
                    .header("Authorization", "Bearer test-secret")
                    .header("Origin", "https://evil.test")
                    .call()
            ),
            403
        );
        assert_eq!(
            post("/events", r#"{"petId":"a","state":"working","message":"coding"}"#),
            200
        );
        assert_eq!(post("/events", r#"{"state":"done"}"#), 200);
        assert_eq!(post("/say", r#"{"pet":"frieren","message":" 테스트 통과! "}"#), 200);
        assert_eq!(post("/react", r#"{"action":"wave"}"#), 200);
        assert_eq!(post("/events", r#"{"petId":"missing","state":"done"}"#), 404);
        assert_eq!(post("/events", "{"), 400);
        assert_eq!(post("/say", r#"{"message":""}"#), 400);
        assert_eq!(post("/react", r#"{"action":"explode"}"#), 400);
        assert_eq!(post("/nope", "{}"), 404);
        assert_eq!(post("/events", r#"{"pet":null,"petId":"b","state":"idle"}"#), 200);
        assert_eq!(
            events.lock().unwrap().pop(),
            Some(AgentEvent::Status {
                pet_id: "b".into(),
                state: "idle".into(),
                message: String::new()
            })
        );
        assert_eq!(
            *events.lock().unwrap(),
            vec![
                AgentEvent::Status {
                    pet_id: "a".into(),
                    state: "working".into(),
                    message: "coding".into()
                },
                AgentEvent::Status {
                    pet_id: "a".into(),
                    state: "done".into(),
                    message: String::new()
                },
                AgentEvent::Say {
                    pet_id: "b".into(),
                    message: "테스트 통과!".into()
                },
                AgentEvent::React {
                    pet_id: "a".into(),
                    action: "wave".into()
                },
            ]
        );
    }
}
