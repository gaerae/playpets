import assert from 'node:assert/strict';
import test from 'node:test';
import { commandPlan, runPlan } from '../scripts/local.mjs';

test('start resolves the native executable without a shell or losing arguments', () => {
  const plan = commandPlan('start', { root: 'C:\\Work files\\PlayPets', platform: 'win32', args: ['--help'] });
  assert.equal(plan.steps[0].command, 'C:\\Work files\\PlayPets\\src-tauri\\target\\release\\playpets.exe');
  assert.deepEqual(plan.steps[0].args, ['--help']);
  assert.equal(
    commandPlan('start', { root: '/work/pets', platform: 'linux' }).steps[0].command,
    '/work/pets/src-tauri/target/release/playpets',
  );
});

test('Docker receives whole paths and forwards supported packaging options', () => {
  const win = commandPlan('windows', { root: 'C:\\Work files\\PlayPets', platform: 'win32' });
  assert.equal(win.output, 'C:\\Work files\\PlayPets\\release\\windows');
  assert.ok(win.steps[1].args.includes('C:\\Work files\\PlayPets:/src:ro'));
  assert.ok(win.steps[1].args.includes('C:\\Work files\\PlayPets\\release\\windows:/out'));
  for (const name of ['MSIX_PUBLISHER', 'MSIX_IDENTITY_NAME', 'MSIX_PUBLISHER_DISPLAY_NAME'])
    assert.ok(win.steps[1].args.includes(name), name);
  // The test signing key gets its own volume, never a folder under release/.
  assert.ok(win.steps[1].args.includes('playpets-msix-key:/keys'));
  const linux = commandPlan('linux', { root: '/work/a $name (copy)', platform: 'darwin' });
  assert.ok(linux.steps[1].args.includes('/work/a $name (copy):/src:ro'));
  assert.ok(linux.steps[1].args.includes('BUNDLES'));
  assert.ok(!linux.steps[1].args.includes('playpets-msix-key:/keys'));
  assert.throws(() => commandPlan('unknown', { root: '/work/pets' }), /Unknown command/);
});

test('a failed Docker build stops before the container runs and preserves its exit code', () => {
  const calls = [];
  const plan = commandPlan('linux', { root: '/work/pets' });
  const code = runPlan(plan, {
    mkdir: () => {},
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 17 };
    },
  });
  assert.equal(code, 17);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.shell, false);
});
