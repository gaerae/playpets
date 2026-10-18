// Keep host paths and packaging options intact on PowerShell, cmd and Unix shells.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));

export function commandPlan(mode, { root = repository, platform = process.platform, args = [] } = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  if (mode === 'start')
    return {
      root,
      steps: [
        {
          command: paths.join(root, 'src-tauri/target/release', platform === 'win32' ? 'playpets.exe' : 'playpets'),
          args,
        },
      ],
    };
  if (!['linux', 'windows'].includes(mode)) throw new Error(`Unknown command: ${mode}`);
  if (args.length)
    throw new Error('Set BUNDLES or the MSIX identity variables in the environment instead of passing Docker flags.');
  const windows = mode === 'windows';
  const image = `playpets-${mode}`;
  const output = paths.join(root, 'release', mode);
  return {
    root,
    output,
    steps: [
      { command: 'docker', args: ['build', '-t', image, paths.join(root, 'packaging', mode)] },
      {
        command: 'docker',
        args: [
          'run',
          '--rm',
          ...(windows ? ['MSIX_PUBLISHER', 'MSIX_IDENTITY_NAME', 'MSIX_PUBLISHER_DISPLAY_NAME'] : ['BUNDLES']).flatMap(
            name => ['--env', name],
          ),
          '-v',
          `${root}:/src:ro`,
          '-v',
          `${windows ? 'playpets-cargo-win' : 'playpets-cargo'}:/usr/local/cargo/registry`,
          '-v',
          `${windows ? 'playpets-target-win' : 'playpets-target'}:/work/src-tauri/target`,
          '-v',
          `${output}:/out`,
          // The MSIX test signing key lives in a volume, out of the release folder (packaging/windows/build.sh).
          ...(windows ? ['-v', 'playpets-msix-key:/keys'] : []),
          image,
        ],
      },
    ],
  };
}

export function runPlan(plan, { spawn = spawnSync, mkdir = mkdirSync } = {}) {
  if (plan.output) mkdir(plan.output, { recursive: true });
  for (const step of plan.steps) {
    const result = spawn(step.command, step.args, { cwd: plan.root, stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = runPlan(commandPlan(process.argv[2], { args: process.argv.slice(3) }));
  } catch (error) {
    console.error(error.message);
    if (process.argv[2] === 'start') console.error('Build the executable first: npm run build:app');
    process.exitCode = 1;
  }
}
