import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pngSize } from '../scripts/png-lossless-lib.mjs';

const python = process.env.PLAYPETS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

test('action packing uses shared scale and foot anchors, refusing clipped frames', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'companion-pack-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source.png');
  const made = spawnSync(
    python,
    [
      '-c',
      'from PIL import Image,ImageDraw; import sys; im=Image.new("RGBA",(64,32)); d=ImageDraw.Draw(im); d.rectangle((5,5,15,20),fill="red"); d.rectangle((37,10,47,20),fill="blue"); im.save(sys.argv[1])',
      source,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(made.status, 0, made.stderr);
  const spec = {
    source,
    scale: 1,
    anchor: [96, 199],
    frames: [
      { rect: [0, 0, 32, 32], foot: [10, 20], duration: 200, tip: [25, 10] },
      { rect: [32, 0, 32, 32], foot: [10, 20], duration: 300 },
    ],
  };
  const plan = path.join(dir, 'plan.json'),
    out = path.join(dir, 'atlas.png');
  await writeFile(plan, JSON.stringify(spec));
  const run = () =>
    spawnSync(process.execPath, ['scripts/pack-companion-actions.mjs', plan, out], { encoding: 'utf8' });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.size, [384, 208]);
  assert.equal(report.duration, 500);
  assert.equal(report.sourceScale, 1);
  assert.deepEqual(report.canvas, [192, 208]);
  assert.deepEqual(report.offset, [0, 0]);
  assert.deepEqual(report.frames[0].tip, [111, 189]);
  assert.deepEqual(
    report.frames.map(frame => frame.foot),
    [
      [96, 199],
      [96, 199],
    ],
  );
  assert.deepEqual(report.frames[1].rect, [192, 0, 192, 208]);
  assert.equal((await readFile(out)).readUInt32BE(16), 384);
  const bounds = spawnSync(
    python,
    [
      '-c',
      'from PIL import Image; import json,sys; im=Image.open(sys.argv[1]); print(json.dumps([im.crop((x,0,x+192,208)).getchannel("A").getbbox() for x in (0,192)]))',
      out,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(bounds.status, 0, bounds.stderr);
  assert.deepEqual(
    JSON.parse(bounds.stdout),
    [
      [91, 184, 102, 200],
      [91, 189, 102, 200],
    ],
    'shorter authored poses keep their own height while both ground contacts align',
  );
  spec.canvas = [224, 216];
  spec.anchor = [96, 207];
  spec.offset = [0, -8];
  await writeFile(plan, JSON.stringify(spec));
  const wide = run();
  assert.equal(wide.status, 0, wide.stderr);
  const overscan = JSON.parse(wide.stdout);
  assert.deepEqual(overscan.size, [448, 216]);
  assert.deepEqual(overscan.frames[1].rect, [224, 0, 224, 216]);
  assert.deepEqual(overscan.frames[0].foot, [96, 207]);
  assert.deepEqual(overscan.frames[0].tip, [111, 197]);
  assert.deepEqual(overscan.offset, [0, -8]);
  spec.frames[0].foot = [-200, 20];
  await writeFile(plan, JSON.stringify(spec));
  const clipped = run();
  assert.notEqual(clipped.status, 0);
  assert.match(clipped.stderr, /clip|foot/i);
});

test('malformed action plans never replace a previous atlas or create partial output', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'companion-invalid-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source.png');
  const fixture = spawnSync(
    python,
    [
      '-c',
      'from PIL import Image; import sys; im=Image.new("RGBA",(32,32)); im.paste((255,0,0,255),(5,5,20,20)); im.save(sys.argv[1])',
      source,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(fixture.status, 0, fixture.stderr);
  const baseline = {
    source,
    scale: 1,
    anchor: [96, 199],
    frames: [
      { rect: [0, 0, 32, 32], foot: [12, 20], duration: 200 },
      { rect: [0, 0, 32, 32], foot: [12, 20], duration: 300 },
    ],
  };
  const changes = [
    [
      'fractional source rectangle',
      p => {
        p.frames[1].rect = [0.5, 0, 30, 32];
      },
    ],
    [
      'boolean source rectangle',
      p => {
        p.frames[1].rect = [true, 0, 30, 32];
      },
    ],
    [
      'null duration',
      p => {
        p.frames[1].duration = null;
      },
    ],
    [
      'boolean duration',
      p => {
        p.frames[1].duration = true;
      },
    ],
    [
      'invalid output anchor',
      p => {
        p.anchor = [-1, 199];
      },
    ],
    [
      'short output anchor',
      p => {
        p.anchor = [96];
      },
    ],
    [
      'boolean shared scale',
      p => {
        p.scale = true;
      },
    ],
    [
      'per-frame scale',
      p => {
        p.frames[1].scale = 0.5;
      },
    ],
    [
      'boolean foot',
      p => {
        p.frames[1].foot[0] = true;
      },
    ],
    [
      'invalid rod tip',
      p => {
        p.frames[1].tip = [100, 0];
      },
    ],
    [
      'empty frames',
      p => {
        p.frames = [];
      },
    ],
  ];
  changes.push(
    [
      'overflowing duration',
      p => {
        p.frames[1].duration = 'overflow';
      },
    ],
    [
      'oversized canvas',
      p => {
        p.canvas = [385, 216];
      },
    ],
    [
      'fractional canvas',
      p => {
        p.canvas = [224.5, 216];
      },
    ],
    [
      'invalid offset',
      p => {
        p.offset = [null, 0];
      },
    ],
    [
      'misaligned overscan foot',
      p => {
        p.offset = [1, 0];
      },
    ],
    [
      'clipped visible frame',
      p => {
        p.frames[1].foot = [0, 0];
      },
    ],
  );
  for (const [label, change] of changes) {
    const spec = structuredClone(baseline);
    change(spec);
    const plan = path.join(dir, 'plan.json');
    await writeFile(plan, JSON.stringify(spec).replace('"overflow"', '1e999'));
    for (const existing of [false, true]) {
      const out = path.join(dir, `${existing ? 'existing' : 'new'}.png`);
      if (existing) await writeFile(out, 'previous accepted atlas');
      else await rm(out, { force: true });
      const run = spawnSync(python, ['scripts/pack-companion-actions.py', plan, out], { encoding: 'utf8' });
      assert.notEqual(run.status, 0, `${label}: malformed plan was accepted`);
      if (existing) assert.equal(await readFile(out, 'utf8'), 'previous accepted atlas', label);
      else await assert.rejects(readFile(out), { code: 'ENOENT' }, label);
    }
  }
});

test('generated companion action registry stays inside canonical transparent atlases', async () => {
  const registry = JSON.parse(
    await readFile(new URL('../src/content/companion-actions.json', import.meta.url), 'utf8'),
  );
  assert.equal(registry.version, 1);
  const ids = new Set(['playpets-clover', 'playpets-daisy', 'playpets-pip', 'playpets-miso']);
  const seasons = new Set(['spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual(Object.keys(registry.characters).sort(), [...ids].sort(), 'every bundled character owns actions');
  const finitePoint = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  const checkedImages = new Set();
  for (const [id, character] of Object.entries(registry.characters)) {
    assert.ok(ids.has(id), id);
    assert.deepEqual(Object.keys(character.variants).sort(), [...seasons].sort(), `${id}: every season`);
    for (const [season, actions] of Object.entries(character.variants)) {
      assert.deepEqual(
        Object.keys(actions).sort(),
        ['cast', 'dig', 'discover', 'plant', 'reel', 'wait'],
        `${id}/${season}: complete action set`,
      );
      assert.ok(seasons.has(season), season);
      for (const [name, clip] of Object.entries(actions)) {
        const label = `${id}/${season}/${name}`;
        const canvas = clip.canvas ?? [192, 208];
        const offset = clip.offset ?? [0, 0];
        assert.ok(
          canvas.length === 2 &&
            canvas.every(Number.isInteger) &&
            canvas[0] > 0 &&
            canvas[0] <= 384 &&
            canvas[1] > 0 &&
            canvas[1] <= 416,
          label,
        );
        assert.ok(finitePoint(offset), label);
        assert.match(clip.url, /^art\/[a-zA-Z0-9/_-]+\.png$/, label);
        assert.ok(finitePoint(clip.anchor), label);
        assert.ok(
          clip.anchor[0] >= 0 && clip.anchor[0] <= canvas[0] && clip.anchor[1] >= 0 && clip.anchor[1] <= canvas[1],
          label,
        );
        assert.equal(clip.scale, 1, label);
        assert.ok(Array.isArray(clip.frames) && clip.frames.length > 0 && clip.frames.length <= 64, label);
        const bytes = await readFile(new URL(`../src/${clip.url}`, import.meta.url));
        const size = pngSize(bytes);
        assert.equal(size.height, canvas[1], label);
        assert.equal(size.width % canvas[0], 0, label);
        if (offset.some(value => value !== 0))
          assert.ok(
            clip.anchor.every((value, i) => Math.abs(value + offset[i] - [96, 199][i]) <= 1e-6),
            label,
          );
        assert.equal(bytes[25], 6, `${label}: RGBA PNG`);
        if (!checkedImages.has(clip.url)) {
          const imagePath = new URL(`../src/${clip.url}`, import.meta.url);
          const alpha = spawnSync(
            python,
            [
              '-c',
              'from PIL import Image; import json,sys; a=Image.open(sys.argv[1]).getchannel("A"); print(json.dumps([a.getextrema(),a.histogram()[0]]))',
              fileURLToPath(imagePath),
            ],
            { encoding: 'utf8' },
          );
          assert.equal(alpha.status, 0, alpha.stderr);
          const [[minimum, maximum], transparent] = JSON.parse(alpha.stdout);
          assert.equal(minimum, 0, `${label}: genuine transparent background`);
          assert.ok(maximum > 24 && transparent > 0, `${label}: visible subject and transparent gutters`);
          checkedImages.add(clip.url);
        }
        for (const frame of clip.frames) {
          assert.ok(Array.isArray(frame.rect) && frame.rect.length === 4 && frame.rect.every(Number.isInteger), label);
          const [x, y, w, h] = frame.rect;
          assert.ok(
            x >= 0 && y >= 0 && w === canvas[0] && h === canvas[1] && x + w <= size.width && y + h <= size.height,
            label,
          );
          assert.equal(x % canvas[0], 0, `${label}: aligned atlas cell`);
          assert.ok(Number.isFinite(frame.duration) && frame.duration > 0 && frame.duration <= 10000, label);
          assert.deepEqual(frame.foot, clip.anchor, `${label}: shared ground anchor`);
          if (frame.tip)
            assert.ok(
              finitePoint(frame.tip) &&
                frame.tip[0] >= 0 &&
                frame.tip[0] <= canvas[0] &&
                frame.tip[1] >= 0 &&
                frame.tip[1] <= canvas[1],
              label,
            );
        }
      }
    }
  }
});

test('an alpha channel alone cannot make opaque scenery or empty crops accepted poses', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'companion-alpha-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, fill] of [
    ['opaque', '(70,90,40,255)'],
    ['empty', '(0,0,0,0)'],
  ]) {
    const source = path.join(dir, `${name}.png`);
    const fixture = spawnSync(
      python,
      ['-c', `from PIL import Image; import sys; Image.new("RGBA",(32,32),${fill}).save(sys.argv[1])`, source],
      { encoding: 'utf8' },
    );
    assert.equal(fixture.status, 0, fixture.stderr);
    const plan = path.join(dir, 'plan.json'),
      out = path.join(dir, 'atlas.png');
    await writeFile(
      plan,
      JSON.stringify({
        source,
        scale: 1,
        anchor: [96, 100],
        frames: [{ rect: [0, 0, 32, 32], foot: [16, 20], duration: 200 }],
      }),
    );
    const run = spawnSync(python, ['scripts/pack-companion-actions.py', plan, out], { encoding: 'utf8' });
    assert.notEqual(run.status, 0, name);
    assert.match(run.stderr, /transparent|empty|background/i);
    await assert.rejects(readFile(out), { code: 'ENOENT' });
  }
});
