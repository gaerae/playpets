import { brandCast } from './art-lib.mjs';

// What the screenshot script (shots.mjs) reads from the system, as plain functions it can be tested by.

/** The main display's size in points from `system_profiler SPDisplaysDataType -json` output
 * ("1728 x 1117 @ 120.00Hz"), or null if it names none. */
export function mainDisplay(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const screens = (data?.SPDisplaysDataType || []).flatMap(g => g.spdisplays_ndrvs || []);
  const main = screens.find(s => s.spdisplays_main === 'spdisplays_yes') || screens[0];
  const m = /^(\d+)\s*x\s*(\d+)/.exec(main?._spdisplays_resolution || '');
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

// Never fall back to a screen region: a missing app window must stop the capture.
export function captureWindow(windows, pid, rect) {
  const keys = ['x', 'y', 'width', 'height'];
  const matches = Array.isArray(windows)
    ? windows.filter(
        w =>
          Number.isInteger(w.id) &&
          w.id > 0 &&
          w.pid === pid &&
          Number.isInteger(w.layer) &&
          w.layer >= 0 &&
          keys.every(
            k => Number.isFinite(rect?.[k]) && Number.isFinite(w.bounds?.[k]) && Math.abs(w.bounds[k] - rect[k]) <= 2,
          ),
      )
    : [];
  if (matches.length !== 1 || !(rect.width > 0 && rect.height > 0))
    throw new Error(`Cannot identify capture window for PID ${pid}: ${matches.length} matches`);
  return matches[0];
}

// The desktop picture is the app's own overlay window, never a screen region: a region also takes
// whatever the system draws above it (the screen-sharing indicator, notifications, the screen's
// rounded corner). The overlay spans its monitor, so it is the one app window holding the rect.
export function desktopWindow(windows, pid, rect) {
  const sized = ['width', 'height'].every(k => Number.isFinite(rect?.[k]) && rect[k] > 0);
  const matches =
    sized && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Array.isArray(windows)
      ? windows.filter(
          w =>
            Number.isInteger(w.id) &&
            w.id > 0 &&
            w.pid === pid &&
            Number.isInteger(w.layer) &&
            w.layer >= 0 &&
            ['x', 'y', 'width', 'height'].every(k => Number.isFinite(w.bounds?.[k])) &&
            w.bounds.x <= rect.x &&
            w.bounds.y <= rect.y &&
            w.bounds.x + w.bounds.width >= rect.x + rect.width &&
            w.bounds.y + w.bounds.height >= rect.y + rect.height,
        )
      : [];
  if (matches.length !== 1)
    throw new Error(`Cannot identify desktop overlay for PID ${pid}: ${matches.length} matches`);
  return matches[0];
}

// Window alpha reveals only this controlled backdrop, regardless of desktop focus.
export function composeWindow(canvas, image, logicalWidth, margin = 0) {
  const ratio = image.naturalWidth / logicalWidth;
  const pad = Math.round(margin * ratio);
  canvas.width = image.naturalWidth + pad * 2;
  canvas.height = image.naturalHeight + pad * 2;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#eaf3ef');
  gradient.addColorStop(0.55, '#e5edf0');
  gradient.addColorStop(1, '#f4efe4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (margin) {
    ctx.shadowColor = 'rgba(41,65,58,0.18)';
    ctx.shadowBlur = 18 * ratio;
    ctx.shadowOffsetY = 6 * ratio;
  }
  ctx.drawImage(image, pad, pad);
}

// Explicit choices keep seasonal marketing captures independent of the host's date and last UI state.
export function seasonalScenes() {
  return [
    { name: 'yard-spring', season: 'spring', weather: 'clear' },
    { name: 'yard-summer', season: 'summer', weather: 'clear' },
    { name: 'yard-winter', season: 'winter', weather: 'snow' },
  ];
}

// Keep actual selected tabs, games and options; only a resting cursor and focus are absent.
export function clearCaptureFocus(doc) {
  doc.activeElement?.blur?.();
}

// Canonical cells include different headroom; equal canvas widths do not give equal silhouettes.
export function companionCast() {
  const cast = brandCast(150);
  return cast.map((pet, i) => ({
    name: pet.id[0].toUpperCase() + pet.id.slice(1),
    size: 192 * pet.scale,
    x: (i + 1) / (cast.length + 1),
    y: 0.58,
  }));
}

// Names are shared across locales, so the caller selects one locale before matching a speaker.
export function captureReply(localized, messages) {
  const asked = messages.at(-1)?.content || '';
  const system = messages.find(message => message.role === 'system')?.content || '';
  return (
    localized.chat.find(([question]) => asked.includes(question))?.[1] ||
    Object.entries(localized.talk).find(([name]) => system.includes(`named ${name}`))?.[1] ||
    '...'
  );
}

// Stop rather than publishing a composition with a friend hidden beneath the real chat panel.
export function assertChatCast(bodies, panel, yard) {
  if (bodies.length !== 4 || new Set(bodies.map(body => body.id)).size !== 4)
    throw new Error('Chat capture needs four distinct friends');
  const keys = ['left', 'top', 'right', 'bottom'];
  if (![panel, yard, ...bodies].every(rect => keys.every(key => Number.isFinite(rect?.[key]))))
    throw new Error('Chat capture has invalid bounds');
  for (const body of bodies)
    if (
      body.right <= body.left ||
      body.bottom <= body.top ||
      body.left < yard.left ||
      body.top < yard.top ||
      body.right > Math.min(yard.right, panel.left) - 8 ||
      body.bottom > yard.bottom
    )
      throw new Error(`Chat friend ${body.id} is clipped or covered by the panel`);
  return true;
}
