// Where each coding agent reads the settings PlayPets hands over, as the backend lists it. Windows
// spells the home folder %USERPROFILE%, which Explorer's address bar opens as it is; macOS and
// Linux spell it ~.
import { agentOf } from './agents.js';

export function agentFile(data, kind, windows) {
  const parts = agentOf(data, kind)?.file;
  if (!parts?.length) return '';
  return windows ? `%USERPROFILE%\\${parts.join('\\')}` : `~/${parts.join('/')}`;
}
