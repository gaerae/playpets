import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const python = process.env.PLAYPETS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(
  python,
  [fileURLToPath(new URL('./pack-companion-actions.py', import.meta.url)), ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
