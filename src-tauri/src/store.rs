// Atomic JSON files in the data folder, with corrupt-file rescue.
use crate::i18n;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct Store {
    pub dir: PathBuf,
}

impl Store {
    pub fn read(&self, name: &str, fallback: Value) -> Result<Value, String> {
        let path = self.dir.join(name);
        match fs::read_to_string(&path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(fallback),
            Err(e) => Err(i18n::detail_for("store.read_failed", name, e)),
            Ok(text) => serde_json::from_str(&text).map_err(|_| {
                self.keep_copy(name, "corrupt");
                i18n::tr("store.unreadable", &[("name", name)])
            }),
        }
    }

    /// Puts a timestamped copy of a file beside it (`state.json.corrupt-…`), so nothing a person
    /// might want back is overwritten.
    pub fn keep_copy(&self, name: &str, tag: &str) {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let _ = fs::copy(self.dir.join(name), self.dir.join(format!("{name}.{tag}-{ts}")));
    }

    pub fn write(&self, name: &str, value: &Value) -> Result<(), String> {
        self.write_with(name, value, false)
    }

    /// Like `write`, for a file only this user may read (the bridge token): the file is made
    /// 0600 before it takes its name, and the data folder 0700, where the system has such modes.
    pub fn write_private(&self, name: &str, value: &Value) -> Result<(), String> {
        self.write_with(name, value, true)
    }

    fn write_with(&self, name: &str, value: &Value, private: bool) -> Result<(), String> {
        let failed = |e: &dyn std::fmt::Display| i18n::detail_for("store.write_failed", name, e);
        fs::create_dir_all(&self.dir).map_err(|e| failed(&e))?;
        let tmp = self.dir.join(format!("{name}.tmp"));
        let text = serde_json::to_string_pretty(value).map_err(|e| failed(&e))?;
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        if private {
            use std::os::unix::fs::OpenOptionsExt;
            use std::os::unix::fs::PermissionsExt;
            options.mode(0o600);
            let _ = fs::set_permissions(&self.dir, fs::Permissions::from_mode(0o700));
        }
        #[cfg(not(unix))]
        let _ = private;
        {
            use std::io::Write;
            let mut file = options.open(&tmp).map_err(|e| failed(&e))?;
            file.write_all(text.as_bytes()).map_err(|e| failed(&e))?;
            // On disk before it takes the name: a power cut after the rename must not leave an
            // empty state.json where the last good one was.
            file.sync_all().map_err(|e| failed(&e))?;
        }
        fs::rename(&tmp, self.dir.join(name)).map_err(|e| failed(&e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn store_round_trips_and_rescues_corrupt_files() {
        let dir = std::env::temp_dir().join(format!("playpets-store-{}", uuid::Uuid::new_v4()));
        let store = Store { dir: dir.clone() };
        store.write("state.json", &json!({"pets": [1, 2]})).unwrap();
        assert_eq!(store.read("state.json", json!({})).unwrap()["pets"][1], 2);
        assert_eq!(store.read("missing.json", json!({"d": true})).unwrap()["d"], true);
        fs::write(dir.join("state.json"), "{broken").unwrap();
        let err = store.read("state.json", json!({})).unwrap_err();
        assert!(err.contains("copy") && err.contains("state.json"), "{err}");
        assert!(
            fs::read_dir(&dir)
                .unwrap()
                .flatten()
                .any(|e| e.file_name().to_string_lossy().contains("corrupt"))
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
