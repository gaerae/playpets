// What each coding agent's hooks report, in order, for the landing's replay (AgentDemo.vue).
// `state` and `say` follow the hook mapping in src-tauri/src/agent/cli.rs; `say` names a key of
// the copy table's agentStatus, which repeats the app's own agent.* strings. Terminal lines are
// code and stay the same in every language; the prompt and the reply come from the copy table.
export const AGENT_DEMOS = Object.freeze([
  {
    id: 'claude',
    name: 'Claude Code',
    pet: 'daisy',
    steps: [
      { kind: 'prompt', state: 'working', say: 'thinking' },
      { line: '⏺ Read(src/login.test.js)', state: 'working', say: 'tool', tool: 'Read' },
      { line: '⏺ Edit(src/login.js)', state: 'working', say: 'tool', tool: 'Edit' },
      { kind: 'ask', ask: 'Bash(npm test)', state: 'waiting', say: 'confirm' },
      { line: '⏺ Bash(npm test)', state: 'working', say: 'tool', tool: 'Bash' },
      { line: '  ✓ 12 passed' },
      { kind: 'reply', state: 'done', say: 'done' },
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    pet: 'clover',
    steps: [
      { kind: 'prompt' },
      { line: '• Explored src/login.test.js' },
      { line: '• Edited src/login.js (+3 -1)' },
      { line: '• Ran npm test  ✓ 12 passed' },
      { kind: 'reply', state: 'done', say: 'done' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    pet: 'pip',
    steps: [
      { kind: 'prompt', state: 'working', say: 'thinking' },
      { line: '✓ ReadFile src/login.test.js', state: 'working', say: 'tool', tool: 'read_file' },
      { line: '✓ Edit src/login.js', state: 'working', say: 'tool', tool: 'replace' },
      { kind: 'ask', ask: 'Shell npm test', state: 'waiting', say: 'confirm' },
      { line: '✓ Shell npm test', state: 'working', say: 'tool', tool: 'run_shell_command' },
      { kind: 'reply', state: 'done', say: 'done' },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    pet: 'miso',
    steps: [
      { kind: 'prompt', state: 'working', say: 'thinking' },
      { line: 'Edited src/login.js', state: 'working', say: 'editing' },
      { line: '$ npm test  ✓ 12 passed', state: 'working', say: 'command' },
      { kind: 'reply', state: 'done', say: 'done' },
    ],
  },
]);
