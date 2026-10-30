import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validatePng } from '../scripts/creator-bundle-lib.mjs';
import { validateBackgroundPack } from '../src/yard/background-pack.js';

const python = process.env.PLAYPETS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
function run(...args) {
  return spawnSync(python, ['scripts/creator-workflow.py', ...args], { encoding: 'utf8' });
}
function entries(bytes) {
  const result = {};
  for (let at = 0; bytes.readUInt32LE(at) === 0x04034b50;) {
    assert.equal(bytes.readUInt16LE(at + 8), 0);
    const size = bytes.readUInt32LE(at + 18),
      n = bytes.readUInt16LE(at + 26),
      extra = bytes.readUInt16LE(at + 28);
    const start = at + 30 + n + extra;
    result[bytes.toString('utf8', at + 30, at + 30 + n)] = bytes.subarray(start, start + size);
    at = start + size;
  }
  return result;
}
test('offline helper packs decoded production pet and seasonal sheets with safe fixed ZIP names', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-cli-'));
  try {
    const out = path.join(dir, 'pet.zip');
    const source = path.join(dir, 'source.json');
    const credit = { name: 'PlayPets', creator: 'gaerae', license: 'MIT', url: 'https://github.com/gaerae/playpets' };
    await writeFile(source, JSON.stringify(credit));
    const args = [
      'pack-pet',
      '--atlas',
      'assets/pets/clover/spritesheet.png',
      '--id',
      'my-clover',
      '--name',
      'My Clover',
      '--kind',
      'animal',
      '--source-json',
      source,
      '--season',
      'summer=assets/pets/clover/spritesheet.png',
      '--output',
      out,
    ];
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    const files = entries(await readFile(out)),
      manifest = JSON.parse(files['pet.json']);
    assert.deepEqual(Object.keys(files).sort(), ['pet.json', 'spritesheet.png', 'summer.png']);
    assert.equal(manifest.spriteVersionNumber, 2);
    assert.equal(manifest.spritesheetPath, 'spritesheet.png');
    assert.deepEqual(manifest.source, credit);
    assert.deepEqual(manifest.seasonalSpritesheets, { summer: 'summer.png' });
    validatePng(files['spritesheet.png'], { canonical: true });
    assert.notEqual(run(...args).status, 0);
    assert.equal(run(...args, '--overwrite').status, 0);
    assert.notEqual(run(...args, '--id', '../escape', '--overwrite').status, 0);
    assert.notEqual(run(...args, '--output', source, '--overwrite').status, 0);
    assert.deepEqual(JSON.parse(await readFile(source, 'utf8')), credit);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('offline helper rejects malformed, opaque, wrong-size, empty-cell, and incomplete row images', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-cli-'));
  try {
    await writeFile(path.join(dir, 'bad.png'), 'not a PNG');
    const generated = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image,ImageDraw
import sys
p=sys.argv[1]
Image.new('RGBA',(1536,2288),(30,40,50,255)).save(p+'/opaque.png')
Image.new('RGBA',(100,100)).save(p+'/small.png')
Image.new('RGBA',(1536,2288)).save(p+'/empty.png')
`,
        dir,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    for (const file of ['bad', 'opaque', 'small', 'empty']) {
      const result = run(
        'pack-pet',
        '--atlas',
        path.join(dir, `${file}.png`),
        '--id',
        'valid',
        '--name',
        'Valid',
        '--kind',
        'animal',
        '--output',
        path.join(dir, 'pet.zip'),
      );
      assert.notEqual(result.status, 0, file);
    }
    assert.notEqual(
      run(
        'pack-pet',
        '--rows',
        dir,
        '--id',
        'valid',
        '--name',
        'Valid',
        '--kind',
        'animal',
        '--output',
        path.join(dir, 'pet.zip'),
      ).status,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('offline helper assembles all eleven transparent source batches on one shared scale', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-cli-'));
  try {
    const generated = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image,ImageDraw
import sys
from pathlib import Path
names=['idle','right','left','wave','jump','error','waiting','working','done','look','look']
for row,name in enumerate(names):
 im=Image.new('RGBA',(1536,1024)); draw=ImageDraw.Draw(im)
 for col in range(8):
  x=(col%4)*384+160; y=(col//4)*512+180
  for offset in range(80):
   draw.line((x,y+offset,x+40,y+offset),fill=(80+offset,100+row,140+col,255))
 im.save(Path(sys.argv[1])/f'{row:02d}-{name}.png')
`,
        dir,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    const out = path.join(dir, 'assembled.zip');
    const result = run(
      'pack-pet',
      '--rows',
      dir,
      '--id',
      'fixture-pet',
      '--name',
      'Fixture pet',
      '--kind',
      'animal',
      '--output',
      out,
    );
    assert.equal(result.status, 0, result.stderr);
    const files = entries(await readFile(out));
    validatePng(files['spritesheet.png'], { canonical: true });
    assert.match(result.stdout, /73 used cells/);
    const mapping = path.join(dir, 'frame-map.json');
    const args = [
      'pack-pet',
      '--rows',
      dir,
      '--id',
      'mapped-pet',
      '--name',
      'Mapped pet',
      '--kind',
      'animal',
      '--output',
      out,
      '--overwrite',
    ];
    await writeFile(mapping, JSON.stringify({ '03-wave': [0, 2, 4, 5] }));
    const implicit = run(...args);
    assert.notEqual(implicit.status, 0);
    assert.match(implicit.stderr, /--frame-map/);
    const mapped = run(...args, '--frame-map', mapping);
    assert.equal(mapped.status, 0, mapped.stderr);
    const atlas = path.join(dir, 'mapped.png');
    await writeFile(atlas, entries(await readFile(out))['spritesheet.png']);
    const verify = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image
import sys
im=Image.open(sys.argv[1]).convert('RGBA')
for row,indices in [(0,list(range(6))),(3,[0,2,4,5])]:
 for col,source in enumerate(indices):
  assert im.getpixel((col*192+96,row*208+120))[1:]==(100+row,140+source,255)
assert im.getchannel('A').crop((4*192,3*208,8*192,4*208)).getbbox() is None
`,
        atlas,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(verify.status, 0, verify.stderr);
    for (const value of [
      [],
      { wave: [0, 2, 4, 5] },
      { '03-wave': [0, 2, 4] },
      { '03-wave': [0, 2, 4, 8] },
      { '03-wave': [0, 2, 4, -1] },
      { '03-wave': [0, 2, 4, true] },
      { '03-wave': [0, 2, 4, 1.5] },
      { '03-wave': '0245' },
      { '03-wave': [0, 2, 4, 5], '03-wave.png': [0, 2, 4, 5] },
    ]) {
      await writeFile(mapping, JSON.stringify(value));
      assert.notEqual(run(...args, '--frame-map', mapping).status, 0, JSON.stringify(value));
    }
    await writeFile(mapping, JSON.stringify({ '03-wave.png': [0, 2, 4, 5] }));
    assert.equal(run(...args, '--frame-map', mapping).status, 0);
    assert.notEqual(
      run(
        'pack-pet',
        '--atlas',
        atlas,
        '--frame-map',
        mapping,
        '--id',
        'valid',
        '--name',
        'Valid',
        '--kind',
        'animal',
        '--output',
        out,
        '--overwrite',
      ).status,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('offline background output passes the app validator and rejects invalid geometry and capability types', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-cli-'));
  try {
    const generated = spawnSync(
      python,
      [
        '-c',
        "from PIL import Image; import sys; Image.open('assets/pets/clover/spritesheet.png').convert('RGB').resize((1536,1024)).save(sys.argv[1])",
        path.join(dir, 'scene.jpg'),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    const config = path.join(dir, 'layout.json'),
      out = path.join(dir, 'background.json');
    const args = ['pack-background', '--image', path.join(dir, 'scene.jpg'), '--config', config, '--output', out];
    await writeFile(
      config,
      JSON.stringify({
        name: 'Painted meadow',
        floor: 0.7,
        sky: false,
        weather: false,
        ambient: false,
        windows: [],
        capabilities: { soil: true },
      }),
    );
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    const pack = validateBackgroundPack(JSON.parse(await readFile(out, 'utf8')));
    assert.equal(pack.capabilities.soil, true);
    assert.doesNotMatch(result.stdout, /true sky alpha/);
    validatePng(Buffer.from(pack.images.base.split(',')[1], 'base64'));
    await writeFile(
      config,
      JSON.stringify({
        name: 'Indoor scene',
        floor: 0.7,
        sky: false,
        weather: true,
        windows: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
      }),
    );
    assert.equal(run(...args, '--overwrite').status, 0);
    assert.equal(validateBackgroundPack(JSON.parse(await readFile(out, 'utf8'))).capabilities.soil, false);
    for (const change of [
      { floor: 0.4 },
      { water: { from: 0.5, to: 0.2, center: 0.3, radius: 0.1 } },
      { sky: 'true' },
      { capabilities: { soil: 'true' } },
      { capabilities: { soil: null } },
      { capabilities: [] },
      { sky: false, ambient: true },
      { windows: [{ x: 0.9, y: 0.1, width: 0.2, height: 0.2 }] },
    ]) {
      await writeFile(config, JSON.stringify({ name: 'Scene', floor: 0.7, ...change }));
      assert.notEqual(run(...args, '--overwrite').status, 0, JSON.stringify(change));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('background names use the same UTF-16 limit as app import', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-name-'));
  try {
    const config = path.join(dir, 'layout.json'),
      out = path.join(dir, 'background.json');
    const args = [
      'pack-background',
      '--image',
      'src/art/environments/studio-cozy-day.png',
      '--config',
      config,
      '--output',
      out,
    ];
    for (const name of ['🌼'.repeat(31), `${'a'.repeat(59)}🌼`]) {
      await writeFile(config, JSON.stringify({ name, floor: 0.67 }));
      const result = run(...args);
      assert.notEqual(result.status, 0, 'a helper-accepted name must fit the app import limit');
      assert.match(result.stderr, /UTF-16/);
    }
    for (const name of ['🌼'.repeat(30), 'a'.repeat(60)]) {
      await writeFile(config, JSON.stringify({ name, floor: 0.67 }));
      const result = run(...args, '--overwrite');
      assert.equal(result.status, 0, result.stderr);
      assert.equal(validateBackgroundPack(JSON.parse(await readFile(out, 'utf8'))).name, name);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('live-sky backgrounds reject opaque base and seasonal art with specific repair instructions', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-live-sky-'));
  try {
    const config = path.join(dir, 'layout.json'),
      out = path.join(dir, 'background.json');
    const generated = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image,ImageDraw
import sys
p=sys.argv[1]
opaque=Image.new('RGB',(1536,1024),(40,60,100)); opaque.save(p+'/opaque.png'); opaque.save(p+'/opaque.jpg')
sky=Image.new('RGBA',(1536,1024)); ImageDraw.Draw(sky).rectangle((0,700,1535,1023),fill=(10,150,20,255)); sky.save(p+'/sky.png')
below=Image.new('RGBA',(1536,1024),(40,60,100,255)); ImageDraw.Draw(below).rectangle((0,900,1535,1023),fill=(0,0,0,0)); below.save(p+'/below.png')
`,
        dir,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    await writeFile(config, JSON.stringify({ name: 'Live sky', floor: 0.7, sky: true }));
    for (const file of ['opaque.png', 'opaque.jpg', 'below.png']) {
      const result = run('pack-background', '--image', path.join(dir, file), '--config', config, '--output', out);
      assert.notEqual(result.status, 0, file);
      assert.match(result.stderr, /base.*true transparent pixels above floor/);
      assert.match(result.stderr, /transparent PNG\/WebP.*sky=false/);
    }
    const season = run(
      'pack-background',
      '--image',
      path.join(dir, 'sky.png'),
      '--season',
      `summer=${path.join(dir, 'opaque.png')}`,
      '--config',
      config,
      '--output',
      out,
    );
    assert.notEqual(season.status, 0);
    assert.match(season.stderr, /summer.*true transparent pixels above floor/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('offline background conversion preserves transparent sky pixels', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-alpha-'));
  try {
    const input = path.join(dir, 'sky.png'),
      config = path.join(dir, 'layout.json'),
      out = path.join(dir, 'background.json');
    const generated = spawnSync(
      python,
      [
        '-c',
        "from PIL import Image,ImageDraw; import sys; im=Image.new('RGBA',(1536,1024)); ImageDraw.Draw(im).rectangle((0,700,1535,1023),fill=(10,150,20,255)); im.save(sys.argv[1])",
        input,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    await writeFile(config, JSON.stringify({ name: 'Transparent sky', floor: 0.7, sky: true }));
    const result = run(
      'pack-background',
      '--image',
      input,
      '--season',
      `winter=${input}`,
      '--config',
      config,
      '--output',
      out,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /true sky alpha above floor in every image/);
    const pack = validateBackgroundPack(JSON.parse(await readFile(out, 'utf8')));
    assert.equal(pack.images.winter, pack.images.base);
    const decoded = path.join(dir, 'decoded.png');
    await writeFile(decoded, Buffer.from(pack.images.base.split(',')[1], 'base64'));
    const verify = spawnSync(
      python,
      [
        '-c',
        "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGBA'); assert im.getpixel((0,0))==(0,0,0,0); assert im.getpixel((100,800))==(10,150,20,255)",
        decoded,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('offline layout rendering provides a PNG guide usable by image tools', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-guide-'));
  try {
    const config = path.join(dir, 'layout.json'),
      out = path.join(dir, 'layout.png');
    await writeFile(
      config,
      JSON.stringify({ name: 'Guide', floor: 0.7, sky: true, water: { from: 0.2, to: 0.5, center: 0.4, radius: 0.1 } }),
    );
    const result = run('render-layout', '--config', config, '--output', out);
    assert.equal(result.status, 0, result.stderr);
    const verify = spawnSync(
      python,
      [
        '-c',
        'from PIL import Image; import sys; im=Image.open(sys.argv[1]); assert im.size==(1536,1024); assert im.getpixel((500,410))==(155,201,238); assert im.getpixel((100,900))==(232,231,217)',
        out,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(verify.status, 0, verify.stderr);
    const scene = path.join(dir, 'scene.png');
    const generated = spawnSync(
      python,
      ['-c', "from PIL import Image; import sys; Image.new('RGB',(1536,1024),(90,30,70)).save(sys.argv[1])", scene],
      { encoding: 'utf8' },
    );
    assert.equal(generated.status, 0, generated.stderr);
    const original = await readFile(scene);
    const overlay = path.join(dir, 'overlay.png');
    const overlaid = run('render-layout', '--config', config, '--image', scene, '--output', overlay);
    assert.equal(overlaid.status, 0, overlaid.stderr);
    assert.deepEqual(await readFile(scene), original);
    const pixels = spawnSync(
      python,
      [
        '-c',
        'from PIL import Image; import sys; im=Image.open(sys.argv[1]); assert im.getpixel((500,410))==(90,30,70,255); assert im.getpixel((100,900))==(90,30,70,255); assert im.getpixel((100,717))==(54,59,67,255)',
        overlay,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(pixels.status, 0, pixels.stderr);
    assert.notEqual(
      run('render-layout', '--config', config, '--image', scene, '--output', scene, '--overwrite').status,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('assembly fallback retile preserves pixels, shared scale and vertical motion from a wider source grid', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-retile-'));
  try {
    const fixture = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image,ImageDraw
from pathlib import Path
import sys
p=Path(sys.argv[1]); im=Image.new('RGBA',(1536,1024)); d=ImageDraw.Draw(im)
for i in range(6):
 x=(i%3)*512+170; y=(i//3)*512+80+i*9
 d.rectangle((x,y,x+70,y+250),fill=(30+i*20,80,150,255))
 d.point((x+1,y+1),fill=(10+i,20,30,128))
im.save(p/'source.png')
wide=im.copy(); ImageDraw.Draw(wide).rectangle((30,80,450,400),fill='red'); wide.save(p/'wide.png')
gutter=im.copy(); ImageDraw.Draw(gutter).point((0,100),fill='red'); gutter.save(p/'gutter.png')
Image.new('RGBA',(1500,1024)).save(p/'wrong.png')
`,
        dir,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(fixture.status, 0, fixture.stderr);
    const out = path.join(dir, 'row.png');
    const args = [
      'assemble-row',
      '--image',
      path.join(dir, 'source.png'),
      '--columns',
      '3',
      '--rows',
      '2',
      '--frames',
      '0,1,2,3,4,5,5,5',
      '--output',
      out,
    ];
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    const inspect = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image
import sys
im=Image.open(sys.argv[1]); assert im.size==(1536,1024)
for i,source in enumerate([0,1,2,3,4,5,5,5]):
 tile=im.crop(((i%4)*384,(i//4)*512,(i%4+1)*384,(i//4+1)*512))
 box=tile.getchannel('A').getbbox()
 assert box[1]==80+source*9 and box[3]-box[1]==251, (i,box)
 assert box[2]-box[0]==71, (i,box)
 assert tile.getpixel((box[0],box[1]))==(30+source*20,80,150,255)
 assert tile.getpixel((box[0]+1,box[1]+1))==(10+source,20,30,128)
`,
        out,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(inspect.status, 0, inspect.stderr);
    assert.notEqual(run(...args).status, 0, 'existing output needs explicit overwrite');
    assert.equal(run(...args, '--overwrite').status, 0);
    for (const [flag, value] of [
      ['--image', path.join(dir, 'wide.png')],
      ['--image', path.join(dir, 'gutter.png')],
      ['--image', path.join(dir, 'wrong.png')],
      ['--columns', '0'],
      ['--columns', '5'],
      ['--rows', '3'],
      ['--frames', '0,1,2,3,4,5,6,0'],
      ['--frames', '0,1,2,3,4,5,true,0'],
      ['--frames', '0,1,2'],
      ['--output', path.join(dir, 'source.png')],
    ])
      assert.notEqual(run(...args, flag, value, '--overwrite').status, 0, `${flag} ${value}`);
    if (process.platform !== 'win32') {
      const { link } = await import('node:fs/promises');
      const hardlink = path.join(dir, 'source-alias.png');
      await link(path.join(dir, 'source.png'), hardlink);
      assert.notEqual(
        run(...args, '--output', hardlink, '--overwrite').status,
        0,
        'a hard link cannot overwrite source pixels',
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
