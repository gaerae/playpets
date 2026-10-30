// The settings tab tells people which file to paste into, in the spelling their system uses. The
// list of agents and their files comes from the backend; the test uses the same shape.
import assert from 'node:assert/strict';
import test from 'node:test';
import { agentFile } from '../src/core/agent-files.js';
import { agentLabel, agentsOf, linkView } from '../src/core/agents.js';

const data = {
  agents: [
    { kind: 'claude', label: 'Claude Code', file: ['.claude', 'settings.json'] },
    { kind: 'codex', label: 'Codex', file: ['.codex', 'config.toml'] },
    { kind: 'cursor', label: 'Cursor', file: ['.cursor', 'hooks.json'] },
    { kind: 'mcp', label: 'MCP', file: [] },
  ],
  agentPets: { claude: 'p1', mcp: 'p1', codex: 'p2' },
};

test('each agent file is spelled for the system it is on', () => {
  assert.equal(agentFile(data, 'claude', false), '~/.claude/settings.json');
  assert.equal(agentFile(data, 'claude', true), '%USERPROFILE%\\.claude\\settings.json');
  assert.equal(agentFile(data, 'codex', true), '%USERPROFILE%\\.codex\\config.toml');
  assert.equal(agentFile(data, 'cursor', false), '~/.cursor/hooks.json');
  assert.equal(agentFile(data, 'mcp', false), '', 'MCP has no one file; each tool has its own setting');
  assert.equal(agentFile({}, 'claude', false), '', 'before the backend answered there is nothing to show');
});

test('agents are named by the backend list and a friend knows who reports to it', () => {
  assert.equal(agentLabel(data, 'claude'), 'Claude Code');
  assert.equal(agentLabel(data, 'nope'), 'nope');
  assert.deepEqual(agentsOf(data, 'p1'), ['Claude Code', 'MCP']);
  assert.deepEqual(agentsOf({}, 'p1'), []);
});

test('the settings tab has a row for every agent the backend knows', async () => {
  const { readFileSync } = await import('node:fs');
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const kinds = [...read('src-tauri/src/agent/kinds.rs').matchAll(/kind: "(\w+)"/g)].map(m => m[1]);
  assert.ok(kinds.includes('grok'), 'Grok Build is one of them');
  const html = read('src/index.html');
  for (const kind of kinds) {
    assert.match(html, new RegExp(`id="agent-name-${kind}"`), kind);
    assert.match(html, new RegExp(`data-agent="${kind}"`), kind);
    assert.match(html, new RegExp(`id="agent-copy-${kind}"[^>]*data-kind="${kind}"`), kind);
  }
  // Every agent with a settings file to write can be connected in one press; MCP is copied only.
  const connectable = [...read('src-tauri/src/agent/kinds.rs').matchAll(/kind: "(\w+)"[^}]*format: Format::(\w+)/g)]
    .filter(m => m[2] !== 'None')
    .map(m => m[1]);
  assert.ok(connectable.includes('codex') && !connectable.includes('mcp'));
  for (const kind of kinds) {
    assert.equal(new RegExp(`data-connect="${kind}"`).test(html), connectable.includes(kind), kind);
    assert.equal(new RegExp(`data-link-state="${kind}"`).test(html), connectable.includes(kind), kind);
    assert.equal(new RegExp(`data-link-problem="${kind}"`).test(html), connectable.includes(kind), kind);
  }
});

test('a row offers Connect, Disconnect or only Copy settings by where its agent stands', () => {
  assert.deepEqual(linkView('off'), { button: 'settings.connect', connect: true });
  assert.deepEqual(linkView('on'), { mark: 'settings.linked', button: 'settings.disconnect', connect: false });
  assert.equal(linkView('outdated').button, 'settings.reconnect');
  assert.ok(linkView('outdated').connect, 'connecting again asks first, like the first time');
  // A file PlayPets cannot read, or Codex running another program, is never written: Copy settings only.
  for (const link of ['unreadable', 'taken']) {
    assert.equal(linkView(link).button, undefined, link);
    assert.ok(linkView(link).problem, link);
  }
  assert.deepEqual(linkView(undefined), {}, 'nothing is offered before the backend answered');
});
