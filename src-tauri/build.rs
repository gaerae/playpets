use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};

fn main() {
    builtin_stamp();
    tauri_build::build()
}

/// A fingerprint of the bundled pet art (pets/builtin.rs), so a start can tell its unpacked copy is
/// current without reading ~100 MB back. Names, sizes and modification times are enough: any
/// edit or checkout changes them, and a false change costs only one full compare.
fn builtin_stamp() {
    let root = Path::new("../assets/pets");
    println!("cargo:rerun-if-changed={}", root.display());
    let mut files = Vec::new();
    walk(root, &mut files);
    files.sort();
    let mut hasher = DefaultHasher::new();
    for file in files {
        let meta = fs::metadata(&file).expect("bundled pet file");
        file.strip_prefix(root).unwrap().hash(&mut hasher);
        meta.len().hash(&mut hasher);
        meta.modified().ok().hash(&mut hasher);
    }
    println!("cargo:rustc-env=PLAYPETS_BUILTIN_STAMP={:016x}", hasher.finish());
}

fn walk(dir: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).expect("assets/pets").flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, files);
        } else {
            files.push(path);
        }
    }
}
