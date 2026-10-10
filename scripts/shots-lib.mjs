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
