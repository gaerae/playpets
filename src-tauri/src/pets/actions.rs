//! A pet's own game poses (`actionsPath` in pet.json, docs/standards/pet-files.md): digging,
//! planting, showing a find and fishing, drawn for each outfit. Every number is checked here, and
//! what passes is handed to the page in the shape it draws (src/core/companion-actions.js).

use super::catalog::{image_size_of, optional_relative};
use serde_json::{Map, Value, json};
use std::fs;
use std::path::{Path, PathBuf};

/// The largest `actions.json` read.
pub const ACTIONS_LIMIT: usize = 256 * 1024;
pub const IMAGE_LIMIT: usize = 8 * 1024 * 1024;
pub const IMAGE_SIDE: u32 = 4096;
const IMAGES: usize = 24;
const FRAMES: usize = 64;
const DURATION: f64 = 10_000.0;
const CANVAS: (u64, u64) = (384, 416);
const OUTFITS: [&str; 5] = ["base", "spring", "summer", "autumn", "winter"];
const CLIPS: [&str; 6] = ["dig", "plant", "discover", "cast", "wait", "reel"];
/// A cast without a reel would leave the rod in the air, so these come and go together.
const FISHING: [&str; 3] = ["cast", "wait", "reel"];

/// The poses that passed: the page's clips (each `image` an index) and the atlases they index.
#[derive(Debug, Clone)]
pub struct Poses {
    pub value: Value,
    pub images: Vec<PathBuf>,
}

/// Reads `file` (inside `root`); `None` when the file is missing, too big, broken or keeps no
/// `base` poses. A clip that fails a rule is left out, and the rest stay.
pub fn read(root: &Path, file: &Path) -> Option<Poses> {
    let path = dunce::canonicalize(file).ok()?;
    let meta = fs::metadata(&path).ok()?;
    if !path.starts_with(root) || !meta.is_file() || meta.len() > ACTIONS_LIMIT as u64 {
        return None;
    }
    let data: Value = serde_json::from_slice(&fs::read(&path).ok()?).ok()?;
    if data.get("version")? != 1 {
        return None;
    }
    let outfits = data.get("outfits")?.as_object()?;
    let mut atlases = Atlases {
        root,
        found: Vec::new(),
    };
    let mut kept = Map::new();
    for outfit in OUTFITS {
        let Some(given) = outfits.get(outfit).and_then(Value::as_object) else {
            continue;
        };
        let mut clips = Map::new();
        for name in CLIPS {
            if let Some(clip) = given.get(name).and_then(|c| clip(name, c, &mut atlases)) {
                clips.insert(name.to_owned(), clip);
            }
        }
        if !FISHING.iter().all(|name| clips.contains_key(*name)) {
            for name in FISHING {
                clips.remove(name);
            }
        }
        if !clips.is_empty() {
            kept.insert(outfit.to_owned(), Value::Object(clips));
        }
    }
    kept.contains_key("base").then(|| Poses {
        value: json!({"version": 1, "outfits": kept}),
        images: atlases.found.into_iter().map(|(path, _)| path).collect(),
    })
}

struct Atlases<'a> {
    root: &'a Path,
    found: Vec<(PathBuf, (u32, u32))>,
}
impl Atlases<'_> {
    /// The atlas's index and size; one file named twice is one entry.
    fn get(&mut self, value: &Value) -> Option<(usize, (u32, u32))> {
        let (path, size) = image_size_of(self.root, optional_relative(value)?, IMAGE_LIMIT).ok()?;
        if size.0 > IMAGE_SIDE || size.1 > IMAGE_SIDE {
            return None;
        }
        if let Some(index) = self.found.iter().position(|(p, _)| *p == path) {
            return Some((index, size));
        }
        (self.found.len() < IMAGES).then(|| {
            self.found.push((path, size));
            (self.found.len() - 1, size)
        })
    }
}

fn number(value: &Value) -> Option<f64> {
    value.as_f64().filter(|n| n.is_finite())
}
/// A point inside a `w`×`h` canvas.
fn point(value: Option<&Value>, (w, h): (u64, u64)) -> Option<Value> {
    let pair = value?.as_array()?;
    let (x, y) = (number(pair.first()?)?, number(pair.get(1)?)?);
    (pair.len() == 2 && (0.0..=w as f64).contains(&x) && (0.0..=h as f64).contains(&y))
        .then(|| json!([pair[0], pair[1]]))
}

fn clip(name: &str, given: &Value, atlases: &mut Atlases) -> Option<Value> {
    let (image, (image_w, image_h)) = atlases.get(given.get("image")?)?;
    let canvas = match given.get("canvas") {
        None => (192, 208),
        Some(value) => {
            let pair = value.as_array().filter(|p| p.len() == 2)?;
            (pair[0].as_u64()?, pair[1].as_u64()?)
        }
    };
    if !(1..=CANVAS.0).contains(&canvas.0) || !(1..=CANVAS.1).contains(&canvas.1) {
        return None;
    }
    let anchor = point(given.get("anchor"), canvas)?;
    let offset = match given.get("offset") {
        None => json!([0, 0]),
        Some(value) => {
            let pair = value.as_array().filter(|p| p.len() == 2)?;
            let (x, y) = (number(&pair[0])?, number(&pair[1])?);
            if x.abs() > CANVAS.1 as f64 || y.abs() > CANVAS.1 as f64 {
                return None;
            }
            json!([pair[0], pair[1]])
        }
    };
    let fishing = FISHING.contains(&name);
    let given_frames = given.get("frames")?.as_array()?;
    if given_frames.is_empty() || given_frames.len() > FRAMES {
        return None;
    }
    let mut frames = Vec::with_capacity(given_frames.len());
    let mut total = 0.0;
    for frame in given_frames {
        let rect: Vec<u64> = frame
            .get("rect")?
            .as_array()?
            .iter()
            .map(Value::as_u64)
            .collect::<Option<_>>()?;
        let [x, y, w, h] = rect[..] else { return None };
        if (w, h) != canvas || x + w > image_w as u64 || y + h > image_h as u64 {
            return None;
        }
        let duration = number(frame.get("duration")?).filter(|d| (1.0..=DURATION).contains(d))?;
        total += duration;
        let mut kept = json!({"rect": [x, y, w, h], "foot": anchor, "duration": frame["duration"]});
        if fishing {
            kept["tip"] = point(frame.get("tip"), canvas)?;
        }
        frames.push(kept);
    }
    let mut clip = json!({
        "image": image, "canvas": [canvas.0, canvas.1], "anchor": anchor, "offset": offset,
        "scale": 1, "heldTool": name != "discover", "frames": frames,
    });
    if let Some(ground) = given.get("ground").filter(|_| matches!(name, "dig" | "plant")) {
        clip["ground"] = point(Some(ground), canvas)?;
    }
    let mut events = Vec::new();
    for key in ["contactAt", "tossAt", "commitAt"] {
        let at = match given.get(key) {
            None => None,
            Some(value) => {
                clip[key] = value.clone();
                Some(number(value).filter(|at| (0.0..=total).contains(at))?)
            }
        };
        events.push(at);
    }
    // Contact comes first; tossing and committing may share a moment (planting does).
    let before = |later: Option<f64>| matches!((events[0], later), (Some(contact), Some(at)) if at < contact);
    if before(events[1]) || before(events[2]) {
        return None;
    }
    if let Some(looping) = given.get("loop") {
        clip["loop"] = json!(looping.as_bool()?);
    }
    Some(clip)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    fn png(w: u32, h: u32) -> Vec<u8> {
        let mut d = vec![0u8; 24];
        d[..8].copy_from_slice(&[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        d[16..20].copy_from_slice(&w.to_be_bytes());
        d[20..24].copy_from_slice(&h.to_be_bytes());
        d
    }
    fn frames(n: u32, w: u32, h: u32, tip: bool) -> serde_json::Value {
        (0..n)
            .map(|i| {
                let mut f = json!({"rect": [i * w, 0, w, h], "duration": 200});
                if tip {
                    f["tip"] = json!([w - 10, 12]);
                }
                f
            })
            .collect()
    }
    fn outfit() -> serde_json::Value {
        json!({
            "dig": {"image": "actions/dig.png", "anchor": [91, 199], "ground": [150, 199],
                    "contactAt": 300, "tossAt": 900, "frames": frames(6, 192, 208, false)},
            "plant": {"image": "actions/plant.png", "anchor": [96, 199], "contactAt": 400, "tossAt": 1000,
                      "commitAt": 1000, "frames": frames(6, 192, 208, false)},
            "discover": {"image": "actions/plant.png", "anchor": [96, 199], "frames": frames(2, 192, 208, false)},
            "cast": {"image": "actions/fish.png", "canvas": [240, 216], "anchor": [96, 207],
                     "frames": frames(2, 240, 216, true)},
            "wait": {"image": "actions/fish.png", "canvas": [240, 216], "anchor": [96, 207], "loop": true,
                     "offset": [0, -8], "frames": frames(2, 240, 216, true)},
            "reel": {"image": "actions/fish.png", "canvas": [240, 216], "anchor": [96, 207],
                     "frames": frames(2, 240, 216, true)}
        })
    }
    /// A pet folder with three atlases and `actions.json` holding `file`; returns (root, its path).
    fn folder(file: &serde_json::Value) -> (std::path::PathBuf, std::path::PathBuf) {
        let base = std::env::temp_dir().join(format!("playpets-actions-{}", uuid::Uuid::new_v4()));
        let root = base.join("pet");
        fs::create_dir_all(root.join("actions")).unwrap();
        fs::write(root.join("actions/dig.png"), png(1152, 208)).unwrap();
        fs::write(root.join("actions/plant.png"), png(1152, 208)).unwrap();
        fs::write(root.join("actions/fish.png"), png(1440, 216)).unwrap();
        fs::write(base.join("outside.png"), png(1152, 208)).unwrap();
        fs::write(root.join("actions.json"), file.to_string()).unwrap();
        let root = dunce::canonicalize(&root).unwrap();
        let path = root.join("actions.json");
        (root, path)
    }
    fn clips(poses: &Poses, outfit: &str) -> Vec<String> {
        let mut names: Vec<String> = poses.value["outfits"][outfit]
            .as_object()
            .map(|o| o.keys().cloned().collect())
            .unwrap_or_default();
        names.sort();
        names
    }

    #[test]
    fn a_valid_file_is_read_with_defaults_filled() {
        let (root, path) = folder(&json!({"version": 1, "outfits": {"base": outfit(), "winter": outfit()}}));
        let poses = read(&root, &path).expect("valid poses");
        assert_eq!(
            clips(&poses, "base"),
            ["cast", "dig", "discover", "plant", "reel", "wait"]
        );
        assert_eq!(poses.images.len(), 3, "one entry per distinct atlas");
        let dig = &poses.value["outfits"]["base"]["dig"];
        assert_eq!(dig["canvas"], json!([192, 208]));
        assert_eq!(
            dig["offset"],
            json!([0, 0]),
            "kept as written, not worked out from the anchor"
        );
        assert_eq!(dig["anchor"], json!([91, 199]));
        assert_eq!(dig["scale"], json!(1));
        assert_eq!(dig["heldTool"], json!(true));
        assert_eq!(dig["ground"], json!([150, 199]));
        assert_eq!(dig["frames"][0]["foot"], json!([91, 199]));
        assert!(dig["image"].is_u64());
        assert_eq!(poses.value["outfits"]["base"]["discover"]["heldTool"], json!(false));
        let wait = &poses.value["outfits"]["base"]["wait"];
        assert_eq!(wait["loop"], json!(true));
        assert_eq!(wait["offset"], json!([0, -8]));
        assert_eq!(wait["frames"][1]["tip"], json!([230, 12]));
    }

    #[test]
    fn each_rule_drops_its_clip() {
        let broken: [(&str, serde_json::Value); 7] = [
            (
                "dig",
                json!({"frames": [{"rect": [1100, 0, 192, 208], "duration": 200}]}),
            ),
            ("dig", json!({"canvas": [400, 208]})),
            ("dig", json!({"frames": [{"rect": [0, 0, 192, 208], "duration": 0}]})),
            ("dig", json!({"tossAt": 100})),
            ("dig", json!({"anchor": [300, 199]})),
            (
                "plant",
                json!({"frames": [{"rect": [0, 0, 190, 208], "duration": 200}]}),
            ),
            ("plant", json!({"image": "/etc/plant.png"})),
        ];
        for (name, change) in broken {
            let mut base = outfit();
            for (key, value) in change.as_object().unwrap() {
                base[name][key] = value.clone();
            }
            let (root, path) = folder(&json!({"version": 1, "outfits": {"base": base}}));
            let poses = read(&root, &path).expect("the other clips stay");
            assert!(!clips(&poses, "base").contains(&name.to_string()), "{name} {change}");
            assert_eq!(clips(&poses, "base").len(), 5, "{change}");
        }
    }

    #[test]
    fn fishing_clips_go_together() {
        let mut base = outfit();
        base["wait"]["frames"][0].as_object_mut().unwrap().remove("tip");
        let (root, path) = folder(&json!({"version": 1, "outfits": {"base": base}}));
        assert_eq!(
            clips(&read(&root, &path).unwrap(), "base"),
            ["dig", "discover", "plant"]
        );
    }

    #[test]
    fn no_base_means_no_poses() {
        for file in [
            json!({"version": 1, "outfits": {"winter": outfit()}}),
            json!({"version": 2, "outfits": {"base": outfit()}}),
            json!({"version": 1, "outfits": {"base": {"dance": {}}}}),
            json!([1, 2]),
        ] {
            let (root, path) = folder(&file);
            assert!(read(&root, &path).is_none(), "{file}");
        }
        let (root, path) = folder(&json!({"version": 1, "outfits": {"base": outfit()}}));
        fs::write(&path, "{ not json").unwrap();
        assert!(read(&root, &path).is_none());
        fs::write(&path, " ".repeat(ACTIONS_LIMIT + 1)).unwrap();
        assert!(read(&root, &path).is_none(), "too big");
    }

    #[test]
    fn image_outside_the_folder_drops_the_clip() {
        let mut base = outfit();
        base["dig"]["image"] = json!("../outside.png");
        base["plant"]["image"] = json!("actions/missing.png");
        let (root, path) = folder(&json!({"version": 1, "outfits": {"base": base}}));
        assert_eq!(
            clips(&read(&root, &path).unwrap(), "base"),
            ["cast", "discover", "reel", "wait"]
        );
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(
                root.parent().unwrap().join("outside.png"),
                root.join("actions/link.png"),
            )
            .unwrap();
            let mut base = outfit();
            base["dig"]["image"] = json!("actions/link.png");
            fs::write(&path, json!({"version": 1, "outfits": {"base": base}}).to_string()).unwrap();
            assert!(!clips(&read(&root, &path).unwrap(), "base").contains(&"dig".to_string()));
        }
        // The file itself must be inside the folder too.
        let outside = root.parent().unwrap().join("actions.json");
        fs::write(
            &outside,
            json!({"version": 1, "outfits": {"base": outfit()}}).to_string(),
        )
        .unwrap();
        assert!(read(&root, &outside).is_none());
    }

    #[test]
    fn equal_toss_and_commit_are_kept() {
        let (root, path) = folder(&json!({"version": 1, "outfits": {"base": outfit()}}));
        let plant = &read(&root, &path).unwrap().value["outfits"]["base"]["plant"];
        assert_eq!(
            (plant["tossAt"].as_f64(), plant["commitAt"].as_f64()),
            (Some(1000.0), Some(1000.0))
        );
    }

    #[test]
    fn catalog_reads_actions_path_and_a_bad_file_leaves_the_pet() {
        let (root, path) = folder(&json!({"version": 1, "outfits": {"base": outfit()}}));
        fs::write(root.join("sprite.png"), png(1536, 2288)).unwrap();
        let manifest = |actions: &str| {
            format!(r#"{{"id":"p","displayName":"P","spriteVersionNumber":2,"spritesheetPath":"sprite.png"{actions}}}"#)
        };
        fs::write(root.join("pet.json"), manifest(r#","actionsPath":"actions.json""#)).unwrap();
        assert_eq!(
            crate::pets::catalog::read_pet(&root).unwrap().actions_path,
            Some(path.clone())
        );
        fs::write(&path, "{}").unwrap();
        let pet = crate::pets::catalog::read_pet(&root).expect("the pet stays usable");
        assert_eq!(pet.actions_path, None);
        fs::write(root.join("pet.json"), manifest("")).unwrap();
        assert_eq!(crate::pets::catalog::read_pet(&root).unwrap().actions_path, None);
    }
}
