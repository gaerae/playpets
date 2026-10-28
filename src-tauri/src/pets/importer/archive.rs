// Reads a pet ZIP: the files the creator kit packs (pet.json and its sheets), or a pet folder
// someone compressed, with the folder itself at the top. Only stored and deflated entries of a
// plain archive are read, each one checked against its size and checksum before it is kept;
// names that could leave the folder are refused, never cleaned up.
use crate::i18n;
use flate2::read::DeflateDecoder;
use std::io::Read;

/// The largest ZIP read, how many entries it may hold (folders and a zipping tool's own files
/// count too), and how much its files may unpack to in all.
pub const ARCHIVE_LIMIT: u64 = 128 * 1024 * 1024;
const MAX_ENTRIES: usize = 256;
const UNPACKED_LIMIT: u64 = 256 * 1024 * 1024;

pub(super) const END_SIGNATURE: u32 = 0x0605_4b50;
pub(super) const CENTRAL_SIGNATURE: u32 = 0x0201_4b50;
pub(super) const LOCAL_SIGNATURE: u32 = 0x0403_4b50;
/// The end record is 22 bytes, followed by a comment of at most 65535.
const END_SEARCH: usize = 22 + 65535;

fn u16_at(b: &[u8], at: usize) -> Option<u16> {
    b.get(at..at + 2).map(|s| u16::from_le_bytes([s[0], s[1]]))
}
fn u32_at(b: &[u8], at: usize) -> Option<u32> {
    b.get(at..at + 4).map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
}

fn not_a_pet() -> String {
    i18n::t("import.zip_unreadable")
}

/// A name the folder can hold as it is: relative, without `..`, `.` or a drive.
fn safe_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('/')
        && !name.contains([':', '\0'])
        && name
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

/// A name every system can write: Windows refuses its device names, a few characters and a name
/// ending in a dot or a space. What a Mac leaves (a folder's `Icon\r`) is such a file, never one
/// a pet names.
fn portable(name: &str) -> bool {
    const DEVICES: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1",
        "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    name.split('/').all(|part| {
        let stem = part.split('.').next().unwrap_or("").trim_end();
        !part.ends_with(['.', ' '])
            && !part.contains(|c: char| c.is_control() || "<>\"|?*".contains(c))
            && !DEVICES.iter().any(|d| d.eq_ignore_ascii_case(stem))
    })
}

/// What a zipping tool adds beside the files: macOS's resource forks and Finder's notes.
fn clutter(name: &str) -> bool {
    name.starts_with("__MACOSX/") || name.rsplit('/').next().is_some_and(|f| f == ".DS_Store")
}

/// The files of the archive, by name, folders left out.
pub fn read_entries(zip: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String> {
    let start = zip.len().saturating_sub(END_SEARCH);
    let end = (start..zip.len().saturating_sub(21))
        .rev()
        .find(|&at| u32_at(zip, at) == Some(END_SIGNATURE))
        .ok_or_else(not_a_pet)?;
    let count = u16_at(zip, end + 10).ok_or_else(not_a_pet)? as usize;
    let directory = u32_at(zip, end + 16).ok_or_else(not_a_pet)? as usize;
    // 0xFFFF and 0xFFFFFFFF mean a ZIP64 archive, which no pet needs.
    if count == 0xFFFF || directory == 0xFFFF_FFFF || u16_at(zip, end + 4) != Some(0) {
        return Err(not_a_pet());
    }
    if count > MAX_ENTRIES {
        return Err(i18n::t("import.zip_too_big"));
    }
    let mut entries = Vec::new();
    let mut unpacked = 0u64;
    let mut at = directory;
    for _ in 0..count {
        if u32_at(zip, at) != Some(CENTRAL_SIGNATURE) {
            return Err(not_a_pet());
        }
        let field = |offset: usize| u16_at(zip, at + offset).ok_or_else(not_a_pet);
        let flags = field(8)?;
        let method = field(10)?;
        let crc = u32_at(zip, at + 16).ok_or_else(not_a_pet)?;
        let packed = u32_at(zip, at + 20).ok_or_else(not_a_pet)? as usize;
        let size = u32_at(zip, at + 24).ok_or_else(not_a_pet)? as u64;
        let (name_len, extra_len, comment_len) = (field(28)? as usize, field(30)? as usize, field(32)? as usize);
        let local = u32_at(zip, at + 42).ok_or_else(not_a_pet)? as usize;
        let name = zip.get(at + 46..at + 46 + name_len).ok_or_else(not_a_pet)?;
        // Windows tools may write names in the system's own code page and `\` between folders;
        // the pet's files are named in ASCII by pet.json, and the top folder's name is dropped.
        let name = String::from_utf8_lossy(name).replace('\\', "/");
        at += 46 + name_len + extra_len + comment_len;
        if name.ends_with('/') || clutter(&name) {
            continue;
        }
        // Bit 0 is encryption; sizes this large mean ZIP64 again.
        if flags & 1 != 0 || packed == 0xFFFF_FFFF || size == 0xFFFF_FFFF || !safe_name(&name) {
            return Err(not_a_pet());
        }
        if !portable(&name) {
            continue;
        }
        unpacked += size;
        if unpacked > UNPACKED_LIMIT {
            return Err(i18n::t("import.zip_too_big"));
        }
        if u32_at(zip, local) != Some(LOCAL_SIGNATURE) {
            return Err(not_a_pet());
        }
        let data_at = local
            + 30
            + u16_at(zip, local + 26).ok_or_else(not_a_pet)? as usize
            + u16_at(zip, local + 28).ok_or_else(not_a_pet)? as usize;
        let raw = zip
            .get(data_at..data_at.checked_add(packed).ok_or_else(not_a_pet)?)
            .ok_or_else(not_a_pet)?;
        let bytes = match method {
            0 => raw.to_vec(),
            8 => {
                // One byte past the stated size shows an entry that lies about it.
                let mut out = Vec::new();
                DeflateDecoder::new(raw)
                    .take(size + 1)
                    .read_to_end(&mut out)
                    .map_err(|_| not_a_pet())?;
                out
            }
            _ => return Err(not_a_pet()),
        };
        let mut check = flate2::Crc::new();
        check.update(&bytes);
        if bytes.len() as u64 != size || check.sum() != crc {
            return Err(not_a_pet());
        }
        if entries
            .iter()
            .any(|(n, _): &(String, Vec<u8>)| n.eq_ignore_ascii_case(&name))
        {
            return Err(not_a_pet());
        }
        entries.push((name, bytes));
    }
    Ok(entries)
}

/// The pet's own files, named from the pet folder: those beside a pet.json at the top, or inside
/// the one folder the archive holds when that folder has the pet.json.
pub fn pet_files(entries: Vec<(String, Vec<u8>)>) -> Result<Vec<(String, Vec<u8>)>, String> {
    if entries.iter().any(|(n, _)| n == "pet.json") {
        return Ok(entries);
    }
    let top = entries
        .first()
        .and_then(|(n, _)| n.split_once('/'))
        .map(|(t, _)| format!("{t}/"));
    let Some(top) = top.filter(|t| entries.iter().all(|(n, _)| n.starts_with(t.as_str()))) else {
        return Err(i18n::t("import.zip_no_pet"));
    };
    if !entries.iter().any(|(n, _)| n[top.len()..] == *"pet.json") {
        return Err(i18n::t("import.zip_no_pet"));
    }
    Ok(entries
        .into_iter()
        .map(|(n, b)| (n[top.len()..].to_string(), b))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pets::importer::tests::zip;

    #[test]
    fn stored_and_deflated_files_come_out_as_they_went_in() {
        let sheet = vec![7u8; 5000];
        let archive = zip(&[("pet.json", b"{}", false), ("spritesheet.png", &sheet, true)]);
        let entries = read_entries(&archive).unwrap();
        assert_eq!(entries[0], ("pet.json".to_string(), b"{}".to_vec()));
        assert_eq!(entries[1], ("spritesheet.png".to_string(), sheet));
    }

    #[test]
    fn names_that_could_leave_the_folder_are_refused() {
        for name in [
            "../pet.json",
            "/etc/pet.json",
            "a/../../pet.json",
            r"..\pet.json",
            r"a\..\..\pet.json",
            "C:pet.json",
            "a//b",
            "./pet.json",
        ] {
            assert!(read_entries(&zip(&[(name, b"x", false)])).is_err(), "{name}");
        }
        assert!(read_entries(&zip(&[("Pet.json", b"x", false), ("pet.json", b"y", false)])).is_err());
    }

    #[test]
    fn windows_tools_names_are_read_as_they_meant() {
        // PowerShell 5.1's Compress-Archive writes `\` between folders; Explorer and 7-Zip on a
        // Korean Windows write a folder named 보바 in CP949, which only the dropped top folder holds.
        let mut archive = zip(&[(r"boba\pet.json", b"{}", false), ("XXXX/spritesheet.png", b"", false)]);
        for at in (0..archive.len() - 4)
            .filter(|&at| &archive[at..at + 4] == b"XXXX")
            .collect::<Vec<_>>()
        {
            archive[at..at + 4].copy_from_slice(&[0xba, 0xb8, 0xb9, 0xd9]);
        }
        let entries = read_entries(&archive).unwrap();
        assert_eq!(entries[0].0, "boba/pet.json");
        assert!(entries[1].0.ends_with("/spritesheet.png"));
        let files = pet_files(
            read_entries(&zip(&[
                (r"boba\pet.json", b"{}", false),
                (r"boba\rows\a.png", b"", false),
            ]))
            .unwrap(),
        );
        let names: Vec<String> = files.unwrap().into_iter().map(|(n, _)| n).collect();
        assert_eq!(names, ["pet.json", "rows/a.png"]);
    }

    #[test]
    fn names_windows_cannot_hold_are_left_out() {
        let archive = zip(&[
            ("pet.json", b"{}", false),
            ("CON", b"x", false),
            ("rows/aux.txt", b"x", false),
            ("a|b.png", b"x", false),
            ("Icon\r", b"x", false),
            ("note.", b"x", false),
            ("a/.. /b", b"x", false),
            ("ok.png", b"x", false),
        ]);
        let names: Vec<String> = read_entries(&archive).unwrap().into_iter().map(|(n, _)| n).collect();
        assert_eq!(names, ["pet.json", "ok.png"]);
    }

    #[test]
    fn a_damaged_or_oversized_archive_is_refused() {
        let mut archive = zip(&[("pet.json", b"{\"id\":1}", false)]);
        assert!(read_entries(&archive[..archive.len() - 3]).is_err(), "cut short");
        let data = archive.iter().position(|&b| b == b'{').unwrap();
        archive[data] = b'[';
        assert!(read_entries(&archive).is_err(), "the checksum no longer matches");
        assert!(read_entries(b"not a zip at all").is_err());
        assert!(read_entries(&[]).is_err());
        let many: Vec<(String, Vec<u8>)> = (0..=MAX_ENTRIES).map(|n| (format!("f{n}"), vec![])).collect();
        let many: Vec<(&str, &[u8], bool)> = many.iter().map(|(n, b)| (n.as_str(), b.as_slice(), false)).collect();
        assert!(read_entries(&zip(&many)).is_err(), "too many files");
    }

    #[test]
    fn a_compressed_pet_folder_and_zipping_clutter_are_read_as_the_pet() {
        let archive = zip(&[
            ("boba/", b"", false),
            ("boba/pet.json", b"{}", true),
            ("boba/spritesheet.webp", b"RIFF", false),
            ("__MACOSX/boba/._pet.json", b"fork", false),
            ("boba/.DS_Store", b"finder", false),
        ]);
        let files = pet_files(read_entries(&archive).unwrap()).unwrap();
        let names: Vec<&str> = files.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names, ["pet.json", "spritesheet.webp"]);
        let flat = pet_files(read_entries(&zip(&[("pet.json", b"{}", false), ("rows/a.png", b"", false)])).unwrap());
        assert_eq!(flat.unwrap().len(), 2, "a pet.json at the top keeps every path");
        for missing in [
            zip(&[("spritesheet.png", b"", false)]),
            zip(&[("a/pet.json", b"{}", false), ("b/spritesheet.png", b"", false)]),
            zip(&[("a/b/pet.json", b"{}", false)]),
        ] {
            assert!(pet_files(read_entries(&missing).unwrap()).is_err());
        }
    }
}
