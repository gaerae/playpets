export function installCommand(agent) {
  if (!['codex', 'claude-code'].includes(agent)) throw new Error('Unknown skill host');
  return `npx --yes skills@1.7.2 add gaerae/playpets --skill playpets-creator --agent ${agent} --copy`;
}
