// What the chat log shows: the backend's history, plus the message the person just sent while
// the backend has not listed it yet. In a group chat the first friend's answer arrives as an
// event before the send completes, and by then the history already holds the question; the
// pending copy would show it twice.
export function logEntries(history, pending) {
  if (!pending) return history;
  const listed = history.some(m => !m.name && m.role === pending.role && m.content === pending.content);
  return listed ? history : [...history, pending];
}
