import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { zipStore } from '../scripts/creator-bundle-lib.mjs';
import { copyCreatorSkill } from '../scripts/creator-skill.mjs';
import { validateBackgroundPack } from '../src/yard/background-pack.js';

const root = 'assets/creator-skill/playpets-creator';
const python = process.env.PLAYPETS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

test('the maintained skill runs outside the checkout and produces an app-readable background', async () => {
  const dest = await mkdtemp(join(tmpdir(), 'playpets-installed-skill-'));
  try {
    await cp(root, dest, { recursive: true });
    await cp('src/art/environments/studio-cozy-day.png', join(dest, 'scene.png'));
    await writeFile(join(dest, 'layout.json'), JSON.stringify({ name: 'Independent studio', floor: 0.67 }));
    const result = spawnSync(
      python,
      [
        'scripts/creator-workflow.py',
        'pack-background',
        '--image',
        'scene.png',
        '--config',
        'layout.json',
        '--output',
        'background.json',
      ],
      { cwd: dest, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    validateBackgroundPack(JSON.parse(await readFile(join(dest, 'background.json'), 'utf8')));
    assert.equal(await readFile(join(dest, 'LICENSE'), 'utf8'), await readFile('LICENSE', 'utf8'));
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test('portable and plugin archives contain the same canonical skill with a versioned plugin manifest', async () => {
  const dest = await mkdtemp(join(tmpdir(), 'playpets-plugin-'));
  try {
    await copyCreatorSkill(dest);
    const result = spawnSync(
      python,
      [
        '-c',
        `
import json, sys, zipfile
from pathlib import Path
root = Path(sys.argv[1])
with zipfile.ZipFile(root / 'playpets-creator.zip') as portable, zipfile.ZipFile(root / 'playpets-creator-plugin.zip') as plugin:
    for name in portable.namelist():
        assert portable.read(name) == plugin.read('skills/' + name), name
    claude = json.loads(plugin.read('.claude-plugin/plugin.json'))
    assert claude['name'] == 'playpets-creator'
    assert claude['skills'] == './skills/'
    print(plugin.read('plugin.json').decode())
`,
        dest,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    assert.equal(manifest.name, 'playpets-creator');
    assert.equal(manifest.version, JSON.parse(await readFile('package.json', 'utf8')).version);
    assert.equal(manifest.extensions['com.openai'].requires_local_executor, true);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test('install commands target the self-contained source and stay scoped to the current project', async () => {
  const { installCommand } = await import('../website/.vitepress/theme/skill-install.mjs');
  for (const agent of ['codex', 'claude-code']) {
    assert.equal(
      installCommand(agent),
      `npx --yes skills@1.7.2 add gaerae/playpets --skill playpets-creator --agent ${agent} --copy`,
    );
    assert.doesNotMatch(installCommand(agent), /--global|--yes$/);
  }
  assert.throws(() => installCommand('untrusted; command'));
});

test('plugin metadata permits the exact compatibility manifest without allowing hidden or parent paths', () => {
  assert.ok(zipStore([{ name: '.claude-plugin/plugin.json', bytes: Buffer.from('{}') }]).length);
  for (const name of ['.env', '.claude-plugin/../outside', '.claude-plugin/other.json', '../outside'])
    assert.throws(() => zipStore([{ name, bytes: Buffer.from('{}') }]));
});

test('skills CLI installs the complete local source for Codex and Claude Code without global changes', {
  skip: process.env.PLAYPETS_TEST_SKILLS_INSTALL !== '1',
  timeout: 180000,
}, async () => {
  const dest = await mkdtemp(join(tmpdir(), 'playpets-skills-cli-'));
  try {
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      [
        '--yes',
        'skills@1.7.2',
        'add',
        resolve('.'),
        '--skill',
        'playpets-creator',
        '--agent',
        'codex',
        'claude-code',
        '--copy',
        '--yes',
      ],
      {
        cwd: dest,
        encoding: 'utf8',
        timeout: 150000,
        env: {
          ...process.env,
          HOME: join(dest, 'home'),
          USERPROFILE: join(dest, 'home'),
          XDG_CONFIG_HOME: join(dest, 'home', '.config'),
          npm_config_cache: join(dest, 'npm-cache'),
          DISABLE_TELEMETRY: '1',
          DO_NOT_TRACK: '1',
        },
      },
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    for (const host of ['.agents', '.claude']) {
      const installed = join(dest, host, 'skills/playpets-creator');
      for (const file of [
        'SKILL.md',
        'requirements.txt',
        'LICENSE',
        'scripts/creator-workflow.py',
        'references/formats.md',
      ])
        assert.equal(await readFile(join(installed, file), 'utf8'), await readFile(join(root, file), 'utf8'));
      const helper = spawnSync(python, ['scripts/creator-workflow.py', '--help'], { cwd: installed, encoding: 'utf8' });
      assert.equal(helper.status, 0, helper.stderr);
      assert.match(helper.stdout, /pack-pet/);
      assert.match(helper.stdout, /pack-background/);
    }
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});
