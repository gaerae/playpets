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

    /// Writes `name` as `put` does, for a file only this user may read (the bridge token): the file is made
    /// 0600 before it takes its name, and the data folder 0700, where the system has such modes.
    pub fn write_private(&self, name: &str, value: &Value) -> Result<(), String> {
        self.put(name, value, true)
            .map_err(|e| i18n::detail_for("store.write_failed", name, &e))
    }

    /// Writes `name` beside its last good copy and puts it in place, giving the error as the system
    /// gave it (the state's save tells a full disk from a file held open, app.rs Unsaved).
    pub fn put(&self, name: &str, value: &Value, private: bool) -> std::io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        #[cfg(unix)]
        if private {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&self.dir, fs::Permissions::from_mode(0o700));
        }
        let tmp = self.dir.join(format!("{name}.tmp"));
        let text = serde_json::to_string_pretty(value).map_err(std::io::Error::other)?;
        let mut tries = 0;
        retried(|| {
            tries += 1;
            write_synced(&tmp, text.as_bytes(), private)
        })
        .inspect_err(|e| self.note_failure(name, "write", e, tries, unix_secs()))?;
        let mut tries = 0;
        retried(|| {
            tries += 1;
            fs::rename(&tmp, self.dir.join(name))
        })
        .inspect_err(|e| self.note_failure(name, "rename", e, tries, unix_secs()))
    }

    /// Adds a line to the save log in the data folder for a write of `name` that failed at `step`
    /// after `tries`, at `secs` (Unix time): the system's error, its kind and code, and no path (a
    /// path names the person). A log past SAVE_LOG_MAX starts over, the old one kept beside it.
    pub fn note_failure(&self, name: &str, step: &str, error: &std::io::Error, tries: usize, secs: u64) {
        use std::io::Write;
        let log = self.dir.join(SAVE_LOG);
        if fs::metadata(&log).is_ok_and(|m| m.len() > SAVE_LOG_MAX) {
            let _ = fs::rename(&log, self.dir.join(format!("{SAVE_LOG}.old")));
        }
        let code = error
            .raw_os_error()
            .map(|c| format!(" (os error {c})"))
            .unwrap_or_default();
        let line = format!(
            "{} {name} {step}: {:?}{code} after {tries} tries: {error}\n",
            utc_stamp(secs),
            error.kind()
        );
        if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&log) {
            let _ = file.write_all(line.as_bytes());
        }
    }
}

/// The data folder's log of writes that failed (Store::note_failure), and how large it grows.
pub const SAVE_LOG: &str = "save-errors.log";
const SAVE_LOG_MAX: u64 = 64 * 1024;

fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// `secs` (Unix time) as a UTC date and time, 2026-11-27T08:41:03Z.
fn utc_stamp(secs: u64) -> String {
    let (days, rest) = ((secs / 86_400) as i64, secs % 86_400);
    // Days to a civil date (Howard Hinnant's days_from_civil, inverted).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rest / 3_600,
        rest / 60 % 60,
        rest % 60
    )
}

/// How many more times a write is tried after it fails, and how long it waits before each.
const RETRIES: usize = 5;
const RETRY_WAIT: std::time::Duration = std::time::Duration::from_millis(80);

/// Runs `op`, trying again a few times while it fails for a reason that passes: on Windows another
/// program (an antivirus scan, the search indexer, a sync client) may hold the file open for a
/// moment, and replacing it is refused meanwhile. A full or read-only disk does not pass.
fn retried<T>(mut op: impl FnMut() -> std::io::Result<T>) -> std::io::Result<T> {
    use std::io::ErrorKind::{NotFound, QuotaExceeded, ReadOnlyFilesystem, StorageFull};
    let mut left = RETRIES;
    loop {
        match op() {
            Err(e) if left > 0 && !matches!(e.kind(), StorageFull | QuotaExceeded | ReadOnlyFilesystem | NotFound) => {
                left -= 1;
                std::thread::sleep(RETRY_WAIT);
            }
            done => return done,
        }
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

    // A write that fails leaves a line in the data folder's save log (when, which file, which step,
    // the system's error and its code), so a failure that keeps coming can be traced. The log stays
    // small.
    #[test]
    fn a_failed_write_leaves_a_line_in_the_save_log() {
        let dir = std::env::temp_dir().join(format!("playpets-log-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let store = Store { dir: dir.clone() };
        let denied = std::io::Error::from_raw_os_error(13);
        store.note_failure("state.json", "rename", &denied, 6, 1_795_000_000);
        let log = fs::read_to_string(dir.join(SAVE_LOG)).unwrap();
        assert_eq!(log.lines().count(), 1);
        let line = log.lines().next().unwrap();
        assert!(line.starts_with("2026-11-18T11:06:40Z state.json rename"), "{line}");
        assert!(
            line.contains("PermissionDenied") && line.contains("os error 13") && line.contains("6 tries"),
            "{line}"
        );
        assert!(
            !line.contains(dir.to_string_lossy().as_ref()),
            "no paths: they name the person"
        );
        // Kept small: a log past its limit starts over, its last part kept beside it.
        fs::write(dir.join(SAVE_LOG), "x".repeat(SAVE_LOG_MAX as usize + 1)).unwrap();
        store.note_failure("state.json", "write", &denied, 6, 1_795_000_000);
        assert_eq!(fs::read_to_string(dir.join(SAVE_LOG)).unwrap().lines().count(), 1);
        assert!(dir.join(format!("{SAVE_LOG}.old")).exists());
        fs::remove_dir_all(&dir).ok();
    }

    // Windows refuses to replace a file another program has open a moment (an antivirus scan, the
    // search indexer, a sync client): the write tries again before it counts as failed.
    #[test]
    fn a_file_held_a_moment_by_another_program_is_tried_again() {
        let mut tries = 0;
        let denied = || std::io::Error::from(std::io::ErrorKind::PermissionDenied);
        let held_twice = retried(|| {
            tries += 1;
            if tries < 3 { Err(denied()) } else { Ok(()) }
        });
        assert!(held_twice.is_ok());
        assert_eq!(tries, 3);
        let mut tries = 0;
        let held_on = retried(|| {
            tries += 1;
            Err::<(), _>(denied())
        });
        assert_eq!(held_on.unwrap_err().kind(), std::io::ErrorKind::PermissionDenied);
        assert_eq!(tries, RETRIES + 1, "not forever");
        // A full disk stays full: no point waiting for it.
        let mut tries = 0;
        let full = retried(|| {
            tries += 1;
            Err::<(), _>(std::io::Error::from(std::io::ErrorKind::StorageFull))
        });
        assert!(full.is_err());
        assert_eq!(tries, 1);
    }

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
        store.put("state.json", &json!({"pets": [1, 2]}), false).unwrap();
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
        store.put("state.json", &json!({}), false).unwrap();
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
