// A friend's state as the pages read it. The backend keeps the last word from a coding agent or a
// chat (`statuses[id]`: state, message, source, at); what the yard and the panels show follows
// from it here, in one place.

/** A finished or failed agent state fades after this long; working and waiting stand until the agent reports again. */
export const FADE_MS = 30 * 60 * 1000;

/** The status to show for a friend, or null once an agent's done/error has faded. */
export function statusOf(data, id, now = Date.now()) {
  const s = data.statuses?.[id];
  if (!s) return null;
  const faded = s.source !== 'chat' && (s.state === 'done' || s.state === 'error') && s.at && now - s.at > FADE_MS;
  return faded ? null : s;
}
/** The state for the pose and the portrait: a chat's state counts too. */
export const stateOf = (data, id, now) => statusOf(data, id, now)?.state || 'idle';
/** The state a coding agent reported, for the dot, the summary line and the friend tab's pill. */
export function agentStateOf(data, id, now) {
  const s = statusOf(data, id, now);
  return s && s.source !== 'chat' ? s.state : 'idle';
}
