// Answers arrive as Markdown; the chat shows its common marks as styles and bubbles show none.

import assert from 'node:assert/strict';
import test from 'node:test';
import { setLanguageForTests } from '../src/core/i18n.js';
import { STRINGS } from '../src/core/strings.js';
import { blocks, clip, inline, plain, spoken, waitingLine } from '../src/core/text.js';

test('an error reaches the person in plain words; a raw engine message is kept, but behind them', () => {
  const fallback = STRINGS.en['error.history'];
  assert.equal(spoken(new Error('Couldn’t find that pet.'), fallback), 'Couldn’t find that pet.');
  assert.equal(spoken(new TypeError('history is not iterable'), fallback), `${fallback} (history is not iterable)`);
  assert.equal(spoken(new Error(''), fallback), fallback);
  assert.equal(spoken('no message object', fallback), `${fallback} (no message object)`);
  const backend = Object.assign(new Error('Claude CLI error: exit 1'), { spoken: true });
  assert.equal(
    spoken(backend, fallback),
    'Claude CLI error: exit 1',
    'a backend sentence passes whatever it ends with',
  );
});

test('in Korean and Japanese a sentence shows by its script, with or without a full stop', () => {
  try {
    setLanguageForTests('ko');
    assert.equal(spoken(new Error('펫을 찾을 수 없어요'), STRINGS.ko['error.history']), '펫을 찾을 수 없어요');
    assert.equal(
      spoken(new TypeError('history is not iterable'), STRINGS.ko['error.history']),
      `${STRINGS.ko['error.history']} (history is not iterable)`,
    );
    setLanguageForTests('ja');
    assert.equal(spoken(new Error('ペットが見つかりません'), STRINGS.ja['error.history']), 'ペットが見つかりません');
    assert.equal(waitingLine(0), STRINGS.ja['wait.short'], 'the waiting line follows the language too');
  } finally {
    setLanguageForTests('en');
  }
});

test('emphasis and code become styled pieces, and the marks are gone', () => {
  assert.deepEqual(inline('친구는 **프리렌**과 *화이트*야'), [
    { text: '친구는 ' },
    { text: '프리렌', bold: true },
    { text: '과 ' },
    { text: '화이트', italic: true },
    { text: '야' },
  ]);
  assert.deepEqual(inline('`npm test`를 돌려 봐'), [{ text: 'npm test', code: true }, { text: '를 돌려 봐' }]);
  assert.deepEqual(inline('__굵게__ 그리고 _기울여_'), [
    { text: '굵게', bold: true },
    { text: ' 그리고 ' },
    { text: '기울여', italic: true },
  ]);
  assert.deepEqual(
    inline('[놀이터](https://example.org/yard) 가자'),
    [{ text: '놀이터' }, { text: ' 가자' }],
    'a link keeps its words only',
  );
});

test('what only looks like a mark stays as it was written', () => {
  for (const text of ['2 * 3 * 4 = 24', 'snake_case_name', '별 하나 * 만', 'a ** b', '**'])
    assert.deepEqual(inline(text), [{ text }], text);
  assert.deepEqual(inline('`**그대로**`'), [{ text: '**그대로**', code: true }], 'nothing is read inside code');
  assert.deepEqual(inline(''), []);
});

test('headings, lists and code fences are read line by line', () => {
  const found = blocks('# 오늘\n- 산책\n2. **간식**\n```\nlet a = *b*;\n```\n끝');
  assert.deepEqual(
    found.map(b => b.type),
    ['heading', 'item', 'item', 'code', 'text'],
  );
  assert.equal(found[1].marker, '•');
  assert.equal(found[2].marker, '2.');
  assert.deepEqual(found[2].inline, [{ text: '간식', bold: true }]);
  assert.equal(found[3].text, 'let a = *b*;', 'code is kept exactly');
  assert.equal(blocks('```\n닫지 않은 코드').at(-1).text, '닫지 않은 코드');
});

test('bubbles get the words without the marks', () => {
  assert.equal(plain('친구는 **프리렌**과 **화이트**랍니다!'), '친구는 프리렌과 화이트랍니다!');
  assert.equal(plain('## 할 일\n- `밥` 먹기'), '할 일\n• 밥 먹기');
  assert.equal(plain('그냥 말이야'), '그냥 말이야');
  assert.equal(plain(undefined), '');
});

test('nothing written by an AI can become markup', () => {
  const pieces = inline('<img src=x onerror=alert(1)> **<b>굵게</b>**');
  assert.deepEqual(
    pieces,
    [{ text: '<img src=x onerror=alert(1)> ' }, { text: '<b>굵게</b>', bold: true }],
    'tags stay text; the page sets them with textContent',
  );
});

test('the waiting line changes as the wait grows, and only a few times', () => {
  const lines = new Set();
  for (let s = 0; s < 120; s++) lines.add(waitingLine(s));
  assert.equal(lines.size, 3);
  assert.notEqual(waitingLine(0), waitingLine(10));
  assert.equal(waitingLine(40), STRINGS.en['wait.long']);
});

test('a line cut for a speech bubble says so with an ellipsis, and a short one is left whole', () => {
  assert.equal(clip('Hello there', 80), 'Hello there');
  const long = 'a'.repeat(100);
  assert.equal([...clip(long, 80)].length, 80);
  assert.ok(clip(long, 80).endsWith('…'));
  assert.equal(clip('하늘이 정말 맑아요 오늘은 산책하기 좋은 날이에요', 10), '하늘이 정말 맑아…');
});
