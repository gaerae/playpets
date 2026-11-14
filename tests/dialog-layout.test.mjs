import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('editing dialogs keep headings and actions outside one bounded body scroller', async () => {
  const html = await readFile('src/index.html', 'utf8');
  for (const id of ['pet', 'import', 'connection']) {
    const form = html.match(new RegExp(`<form id="${id}-form"[^>]*>([\\s\\S]*?)</form>`))?.[1];
    assert.ok(form, id);
    assert.match(form, /class="dialog-body(?: friend-dialog-body)?"/, `${id} has one body scroller`);
    assert.match(form, /<\/div>\s*<div class="dialog-actions">/, `${id} keeps actions out of the scroller`);
  }
  const css = await readFile('src/styles/dialog.css', 'utf8');
  assert.match(css, /\.dialog-body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.dialog-form\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s);
});

test('desktop controls use a compact reading scale while touch targets stay generous', async () => {
  const base = await readFile('src/styles/base.css', 'utf8');
  const button = base.match(/\.button\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(button, /min-height:\s*36px/);
  assert.match(button, /font-size:\s*var\(--font-md\)/);
  assert.match(base, /@media\s*\(pointer:\s*coarse\)/);
  const play = await readFile('src/styles/play.css', 'utf8');
  assert.match(play, /(?:^|\})\s*\.play-action\s*\{[^}]*min-height:\s*40px/s);
});

// At 300 by 210 in Japanese, a long friend's name took three lines of the leaving question and
// pushed what follows into a one-line scroller, so the consequence could not be read before
// answering. The shortest windows set the question smaller, in at most two lines.
test('the shortest window keeps room for what a question warns of', async () => {
  const css = await readFile('src/styles/dialog.css', 'utf8');
  const short = [...css.matchAll(/@media \(max-height: 280px\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('');
  const heading = short.match(/\.confirm-dialog h2\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(heading, /-webkit-line-clamp:\s*2/);
  assert.match(heading, /font-size:\s*var\(--font-lg\)/);
  assert.match(short, /\.confirm-dialog\s*\{[^}]*padding:\s*14px/);
});
