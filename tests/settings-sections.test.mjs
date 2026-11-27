import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { agentsInUse } from '../src/core/agents.js';
import { strings as en } from '../src/core/strings/en.js';
import { strings as ja } from '../src/core/strings/ja.js';
import { strings as ko } from '../src/core/strings/ko.js';
import { strings as zh } from '../src/core/strings/zh-hans.js';

const kinds = ['claude', 'codex', 'gemini', 'cursor', 'grok', 'qoder', 'kimi', 'mcp'];
const html = await readFile('src/index.html', 'utf8');
const section = id =>
  html.slice(html.indexOf(`<section id="${id}"`), html.indexOf('</section>', html.indexOf(`<section id="${id}"`)));

// Eight tools took two screens, and three in a small window, to find the one or two a person uses.
test('the coding tools a person uses stand first, and the recommended one when none is', () => {
  assert.deepEqual(agentsInUse(kinds, {}, {}, []), ['claude'], 'a first visit sees the recommended tool');
  assert.deepEqual(agentsInUse(kinds, { claude: 'off', codex: 'off' }, {}, ['a']), ['claude']);
  assert.deepEqual(
    agentsInUse(kinds, { gemini: 'on', cursor: 'outdated', grok: 'taken', qoder: 'unreadable', kimi: 'off' }, {}, [
      'a',
    ]),
    ['gemini', 'cursor', 'grok', 'qoder'],
    'linked, linked with an older setting, or a problem to read',
  );
  assert.deepEqual(
    agentsInUse(kinds, {}, { codex: 'a', mcp: 'gone' }, ['a']),
    ['codex'],
    'a tool copied by hand counts once it names a friend still in the yard',
  );
});

test('the other coding tools fold under one line that names them', () => {
  const agents = section('settings-agents');
  const used = agents.indexOf('id="agents-used"'),
    more = agents.indexOf('<details id="agents-more"'),
    other = agents.indexOf('id="agents-other"');
  assert.ok(used > 0 && more > used && other > more, 'used list, then the fold holding the rest');
  assert.match(
    agents,
    /<summary><span id="agents-more-label"><\/span><small id="agents-more-names"><\/small><\/summary>/,
  );
  assert.equal(agents.match(/<li class="link-row" data-tool="/g).length, kinds.length, 'every row says its tool');
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh }))
    assert.match(strings['settings.agents_more'], /\{count\}/, lang);
});

// Connections and what friends do by themselves read as two things; Connect sits under the list.
test('Friends & AI has its connections and what friends do on their own as two groups', () => {
  const ai = section('settings-ai');
  const groups = [...ai.matchAll(/<h4 class="settings-group"[^>]* data-i18n="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(groups, ['settings.ai_group', 'settings.own_group']);
  const at = id => ai.indexOf(`id="${id}"`);
  assert.ok(at('ai-connections') < at('ai-none') && at('ai-none') < at('ai-add') && at('ai-add') < at('ai-editor'));
  assert.ok(ai.indexOf('settings.own_group') < at('auto-chatter'));
  for (const [lang, strings] of Object.entries({ en, ko, ja, zh })) {
    assert.ok(strings['settings.ai_group'] && strings['settings.own_group'], lang);
    assert.doesNotMatch(strings['settings.auto_play_note'], /AI/, `${lang}: the group says it already`);
  }
});
