// The headless browser the drawing tools paint and encode with. Playwright is loaded only when a
// tool starts one, so modules that import this one (creator-kit.mjs for the website) stay light.

const firstLine = error => String(error?.message ?? error).split('\n')[0];

/**
 * An installed Google Chrome, or Playwright's own Chromium when Chrome is missing. Options are
 * Playwright's launch options; tests pass a stand-in for Playwright's `chromium`.
 */
export async function launchBrowser(options = {}, { chromium } = {}) {
  chromium ??= (await import('playwright-core')).chromium;
  const settings = { headless: true, ...options };
  try {
    return await chromium.launch({ ...settings, channel: 'chrome' });
  } catch (chrome) {
    try {
      return await chromium.launch(settings);
    } catch (bundled) {
      throw new Error(
        'No browser to draw with. Install Google Chrome, or run `npx playwright install chromium` for ' +
          `Playwright's Chromium. Google Chrome: ${firstLine(chrome)}. Playwright's Chromium: ${firstLine(bundled)}.`,
        { cause: bundled },
      );
    }
  }
}
