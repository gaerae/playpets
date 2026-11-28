// What went wrong while the app runs, kept in memory for a report a person can copy (Settings >
// About, copyProblemReport) and send with an issue: a command that failed, a save the system
// refused, an error in a page. Nothing is written to a file: what goes wrong is often that the disk
// refuses writes, and a log file there would fail with it. It also goes to standard error, for a
// run started from a terminal.
use crate::app::hold;
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// How many problems are kept: the oldest goes once there are more.
const KEPT: usize = 200;
/// How long one problem's text may be, in characters.
const LONGEST: usize = 400;

struct Problem {
    /// When it first and last happened (Unix seconds), and how many times in a row.
    first: u64,
    last: u64,
    times: u32,
    /// Where: a command's name, "save", "page" or "overlay".
    area: String,
    text: String,
}

struct Book {
    kept: VecDeque<Problem>,
    /// Problems in all, the ones no longer kept too.
    total: u64,
}
impl Book {
    const fn new() -> Book {
        Book {
            kept: VecDeque::new(),
            total: 0,
        }
    }
    /// Notes a problem at `secs`: the same one again, right after itself, only counts once more, so
    /// a save that fails every minute is one line with its count, not a page of them.
    fn note(&mut self, area: &str, text: &str, secs: u64) {
        self.total += 1;
        let text = one_line(text);
        if let Some(last) = self.kept.back_mut()
            && last.area == area
            && last.text == text
        {
            last.times = last.times.saturating_add(1);
            last.last = secs;
            return;
        }
        if self.kept.len() == KEPT {
            self.kept.pop_front();
        }
        self.kept.push_back(Problem {
            first: secs,
            last: secs,
            times: 1,
            area: one_line(area),
            text,
        });
    }
    /// The report: the app, the system and the problems kept, oldest first.
    fn report(&self, version: &str, language: &str) -> String {
        let mut out = format!(
            "PlayPets {version}\nos: {} {}\nlanguage: {language}\nproblems: {}\n",
            std::env::consts::OS,
            std::env::consts::ARCH,
            self.total
        );
        for p in &self.kept {
            out.push_str(&utc_stamp(p.first));
            if p.times > 1 {
                out.push_str(&format!(" (x{} until {})", p.times, utc_stamp(p.last)));
            }
            out.push_str(&format!(" {}: {}\n", p.area, p.text));
        }
        out
    }
}

static BOOK: Mutex<Book> = Mutex::new(Book::new());

/// Notes a problem in `area` (a command's name, "save", "page"…) with what was said about it.
pub fn note(area: &str, text: &str) {
    let text = without_home(text);
    eprintln!("[PlayPets] {area}: {}", one_line(&text));
    hold(&BOOK).note(area, &text, unix_secs());
}

/// The report of this run's problems, to copy.
pub fn report(version: &str) -> String {
    hold(&BOOK).report(version, crate::i18n::current().code())
}

/// `text` on one line, without control characters, and no longer than LONGEST.
fn one_line(text: &str) -> String {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let flat: String = flat.chars().filter(|c| !c.is_control()).collect();
    if flat.chars().count() <= LONGEST {
        return flat;
    }
    format!("{}…", flat.chars().take(LONGEST).collect::<String>())
}

/// `text` with the home folder written `~`: a path there names the person.
fn without_home(text: &str) -> String {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    if home.len() < 2 {
        return text.to_string();
    }
    text.replace(&home, "~")
}

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

#[cfg(test)]
mod tests {
    use super::*;

    // Every problem is kept with when and where, in one report: the app's version and the system,
    // then each problem oldest first. Nothing goes to a file.
    #[test]
    fn a_problem_is_kept_with_when_and_where_and_reported_oldest_first() {
        let mut book = Book::new();
        book.note(
            "save",
            "state.json rename: PermissionDenied (os error 13)",
            1_795_000_000,
        );
        book.note("importPet", "Couldn't save the pet.", 1_795_000_060);
        let report = book.report("1.10.1", "en");
        let lines: Vec<&str> = report.lines().collect();
        assert_eq!(lines[0], "PlayPets 1.10.1");
        assert!(lines[1].starts_with("os: "), "{report}");
        assert_eq!(lines[2], "language: en");
        assert_eq!(lines[3], "problems: 2");
        assert_eq!(
            lines[4],
            "2026-11-18T11:06:40Z save: state.json rename: PermissionDenied (os error 13)"
        );
        assert_eq!(lines[5], "2026-11-18T11:07:40Z importPet: Couldn't save the pet.");
    }

    // A problem that comes again and again (a save tried every minute) is one line with its count
    // and when it last came, so a frequent one shows as frequent without filling the report.
    #[test]
    fn the_same_problem_again_counts_on_its_line() {
        let mut book = Book::new();
        for i in 0..3 {
            book.note("save", "held", 1_795_000_000 + i * 60);
        }
        book.note("page", "other", 1_795_000_200);
        book.note("save", "held", 1_795_000_300);
        let report = book.report("1.10.1", "ko");
        assert!(report.contains("problems: 5"));
        assert!(
            report.contains("2026-11-18T11:06:40Z (x3 until 2026-11-18T11:08:40Z) save: held"),
            "{report}"
        );
        assert_eq!(
            report.matches("save: held").count(),
            2,
            "not when something else came between"
        );
    }

    // The report stays small: the oldest go past KEPT, each line is one line and not too long,
    // and the home folder is written ~, as a path there names the person.
    #[test]
    fn the_report_stays_small_and_names_no_one() {
        let mut book = Book::new();
        for i in 0..(KEPT as u64 + 5) {
            book.note("page", &format!("error {i}"), 1_795_000_000 + i);
        }
        let report = book.report("1.10.1", "en");
        assert!(report.contains(&format!("problems: {}", KEPT + 5)));
        assert!(!report.contains("page: error 4\n") && report.contains("page: error 5\n"));
        assert_eq!(one_line("a\nb\r\n\tc"), "a b c");
        assert_eq!(one_line(&"x".repeat(LONGEST + 10)).chars().count(), LONGEST + 1);
        let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap();
        assert_eq!(without_home(&format!("{home}/pets/a.json")), "~/pets/a.json");
    }
}
