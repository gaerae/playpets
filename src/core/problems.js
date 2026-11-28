// A page's errors, kept with the backend's in the problem report (problems.rs) a person can copy
// from Settings: an error a window met or a promise no one caught, and one a guarded action met
// that was not the backend's own sentence (state.js guard). A few a minute at most, so an error
// repeated every frame does not flood the report.

const MOST = 20;
const MINUTE = 60_000;
let sent = [];

/** An error as one line: its kind and words, and the first place in its stack. */
export function describeProblem(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const words = error.name && error.message ? `${error.name}: ${error.message}` : error.message || String(error);
  const at = String(error.stack || '')
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .find(Boolean);
  return at ? `${words} ${at}` : words;
}

/** Sends `error` to the problem report, unless a few went this minute already. */
export function noteProblem(error, now = Date.now()) {
  const text = describeProblem(error);
  const send = globalThis.window?.playPets?.noteProblem;
  if (!text || !send) return;
  sent = sent.filter(at => now - at < MINUTE);
  if (sent.length >= MOST) return;
  sent.push(now);
  try {
    Promise.resolve(send(text)).catch(() => {});
  } catch {}
}

/** Reports the window's own errors and the promises no one caught (an entry point calls it). */
export function setupProblemReports() {
  window.addEventListener('error', event =>
    noteProblem(event.error || `${event.message} ${event.filename}:${event.lineno}`),
  );
  window.addEventListener('unhandledrejection', event => noteProblem(event.reason));
}
