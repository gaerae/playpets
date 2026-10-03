// The settings tab tells people which file to paste into, in the spelling their system uses. The
// list of agents and their files comes from the backend; the test uses the same shape.
import assert from 'node:assert/strict';
import test from 'node:test';
import { agentFile } from '../src/core/agent-files.js';
import { agentLabel, agentsOf } from '../src/core/agents.js';

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
