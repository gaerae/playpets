// Atomic JSON files in the data folder, with corrupt-file rescue.
use crate::i18n;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct Store {
    pub dir: PathBuf,
}

impl Store {
    pub fn read(&self, name: &str, fallback: Value) -> Result<Value, String> {
        let path = self.dir.join(name);
        match fs::read_to_string(&path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(fallback),
            // Only a copy makes it safe for the start to go on: the next save replaces this file.
            Err(e) => Err(if self.keep_copy(name, "corrupt") {
                i18n::tr("store.unreadable", &[("name", name)])
            } else {
                i18n::detail_for("store.read_failed", name, &e)
            }),
            Ok(text) => serde_json::from_str(&text).map_err(|_| {
                self.keep_copy(name, "corrupt");
                i18n::tr("store.unreadable", &[("name", name)])
            }),
        }
    }

    /// Puts a timestamped copy of a file beside it (`state.json.corrupt-…`), so nothing a person
    /// might want back is overwritten. Says whether the copy was made.
    pub fn keep_copy(&self, name: &str, tag: &str) -> bool {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        fs::copy(self.dir.join(name), self.dir.join(format!("{name}.{tag}-{ts}"))).is_ok()
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
        let failed = |e: std::io::Error| i18n::detail_for("store.write_failed", name, &e);
        fs::create_dir_all(&self.dir).map_err(failed)?;
        #[cfg(unix)]
        if private {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&self.dir, fs::Permissions::from_mode(0o700));
        }
        let tmp = self.dir.join(format!("{name}.tmp"));
        let text = serde_json::to_string_pretty(value).map_err(|e| failed(e.into()))?;
        write_synced(&tmp, text.as_bytes(), private).map_err(failed)?;
        fs::rename(&tmp, self.dir.join(name)).map_err(failed)
    }
}

/// Writes a file and waits until it is on disk, for a file about to be renamed over another: a
/// power cut after the rename must not leave an empty file where the last good one was. A private
/// file is made 0600 before anything is in it, where the system has such modes.
pub fn write_synced(path: &Path, bytes: &[u8], private: bool) -> std::io::Result<()> {
    use std::io::Write;
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    if private {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    #[cfg(not(unix))]
    let _ = private;
    let mut file = options.open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_synced_write_replaces_the_file_and_can_be_private() {
        let dir = std::env::temp_dir().join(format!("playpets-synced-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("settings.json");
        fs::write(&file, "old and longer").unwrap();
        write_synced(&file, b"new", false).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let secret = dir.join("bridge.json");
            write_synced(&secret, b"{}", true).unwrap();
            assert_eq!(fs::metadata(&secret).unwrap().permissions().mode() & 0o777, 0o600);
        }
        let _ = fs::remove_dir_all(&dir);
    }

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

    #[test]
    fn a_file_that_cannot_be_read_as_text_is_copied_before_anything_replaces_it() {
        let dir = std::env::temp_dir().join(format!("playpets-store-{}", uuid::Uuid::new_v4()));
        let store = Store { dir: dir.clone() };
        store.write("state.json", &json!({})).unwrap();
        fs::write(dir.join("state.json"), [0xff, 0xfe, b'{']).unwrap();
        let err = store.read("state.json", json!({})).unwrap_err();
        assert!(err.contains("copy") && err.contains("state.json"), "{err}");
        let copy = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .find(|e| e.file_name().to_string_lossy().contains("corrupt"))
            .expect("a copy beside the file");
        assert_eq!(fs::read(copy.path()).unwrap(), [0xff, 0xfe, b'{']);
        let _ = fs::remove_dir_all(&dir);
    }
}
