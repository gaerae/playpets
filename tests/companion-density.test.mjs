import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function rule(file, selector) {
  const css = await readFile(`src/styles/${file}.css`, 'utf8');
  const body = css.match(new RegExp(`${RegExp.escape(selector)}\\s*\\{([^}]+)\\}`))?.[1];
  assert.ok(body, `${selector} has an owning rule`);
  return Object.fromEntries(
    [...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
  );
}

test('the Invite shelf fits readable portraits and names in compact desktop rows', async () => {
  const card = await rule('invite', '.asset-card'),
    portrait = await rule('invite', '.asset-card canvas'),
    name = await rule('invite', '.asset-info strong'),
    rows = await rule('invite', '.shelf-group');
  assert.ok(parseFloat(card['min-height']) >= 56 && parseFloat(card['min-height']) <= 60);
  assert.ok(parseFloat(portrait.width) >= 40 && parseFloat(portrait.width) <= 44);
  assert.ok(parseFloat(name['font-size']) >= 13);
  assert.ok(parseFloat(rows.gap) >= 6 && parseFloat(rows.gap) <= 8);
});

test('chat keeps readable text while its empty state shares one bounded spacing rhythm', async () => {
  const message = await rule('chat', '.message'),
    placeholder = await rule('chat', '.chat-placeholder'),
    action = await rule('chat', '.connect-cta'),
    starters = await rule('chat', '.chat-starters'),
    composer = await rule('chat', '.composer textarea');
  assert.ok(parseFloat(message['font-size']) >= 13 && parseFloat(message['font-size']) <= 14);
  assert.ok(parseFloat(message['line-height']) >= 1.55 && parseFloat(message['line-height']) <= 1.6);
  assert.ok(parseFloat(composer['font-size']) >= 13);
  for (const [label, declarations] of [
    ['placeholder', placeholder],
    ['action', action],
    ['starters', starters],
  ])
    assert.doesNotMatch(
      declarations.margin,
      /(?:^|\s)auto(?:\s|$)/,
      `${label} does not absorb separate empty flex regions`,
    );
});

test('the Friend header preserves identity in a compact portrait without a large reserved block', async () => {
  const portrait = await rule('friend', '.avatar'),
    heading = await rule('friend', '.friend-head'),
    name = await rule('friend', '.friend-id h3');
  assert.ok(parseFloat(portrait.width) >= 40 && parseFloat(portrait.width) <= 48);
  assert.ok(parseFloat(portrait.height) <= 52);
  assert.ok(parseFloat(heading.gap) <= 8);
  assert.ok(parseFloat(name['font-size']) >= 14);
});
