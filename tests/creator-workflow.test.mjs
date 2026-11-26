import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
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
      'assets/sources/environments/studio-cozy-day.png',
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

// A pose batch for the tests: a 40×80 figure standing with its feet at (192, 460) in tiles 0–5 and
// 7 of each 384×512 tile, so tile 7 sets the scale to the sheet's idle height. The plant batch
// also has a pot on the ground beside the feet, which only a `feet` list in points.json corrects.
const POSE_FIXTURE = `from PIL import Image,ImageDraw
import sys,json
from pathlib import Path
root=Path(sys.argv[1])
for outfit in ('base','winter'):
 (root/outfit).mkdir(parents=True)
 for batch in ('dig','plant','discover','fish'):
  im=Image.new('RGBA',(1536,1024)); d=ImageDraw.Draw(im)
  for col in (0,1,2,3,4,5,7):
   x=(col%4)*384+172; y=(col//4)*512+380
   for line in range(80):
    d.line((x,y+line,x+39,y+line),fill=(60+line,110+col,150,255))
   if batch=='plant' and col<6:
    d.rectangle((x+42,y+64,x+56,y+79),fill=(150,90,40,255))
  im.save(root/outfit/f'{batch}.png')
 tile=lambda i,dx,dy:[(i%4)*384+192+dx,(i//4)*512+460+dy]
 (root/outfit/'points.json').write_text(json.dumps({
  'dig':{'ground':tile(2,50,0)},
  'plant':{'ground':tile(3,40,0),'feet':[tile(i,0,0) for i in range(6)]},
  'fish':{'tips':[tile(i,60,-90) for i in range(6)]}}))
`;
const pngSize = bytes => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];

test('offline helper packs game poses for each outfit at the sheet scale with the friends timings', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-poses-'));
  try {
    const poses = path.join(dir, 'poses');
    const generated = spawnSync(python, ['-c', POSE_FIXTURE, poses], { encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr);
    const out = path.join(dir, 'pet.zip');
    const args = [
      'pack-pet',
      '--atlas',
      'assets/pets/clover/spritesheet.png',
      '--season',
      'winter=assets/pets/clover/spritesheet.png',
      '--actions',
      poses,
      '--id',
      'posed',
      '--name',
      'Posed',
      '--kind',
      'animal',
      '--output',
      out,
    ];
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /game poses/);
    const files = entries(await readFile(out));
    const atlases = ['dig', 'plant', 'discover', 'fish'];
    assert.deepEqual(
      Object.keys(files).sort(),
      [
        'actions.json',
        ...['base', 'winter'].flatMap(outfit => atlases.map(name => `actions/${outfit}/${name}.png`)),
        'pet.json',
        'spritesheet.png',
        'winter.png',
      ].sort(),
    );
    assert.equal(JSON.parse(files['pet.json']).actionsPath, 'actions.json');
    const actions = JSON.parse(files['actions.json']);
    assert.equal(actions.version, 1);
    assert.deepEqual(Object.keys(actions.outfits).sort(), ['base', 'winter']);
    const durations = {
      dig: [280, 280, 300, 400, 360, 380],
      plant: [260, 260, 400, 440, 300, 340],
      discover: [200, 220, 260, 360, 300, 260],
      cast: [300, 400],
      wait: [3200, 200],
      reel: [320, 420],
    };
    for (const [outfit, clips] of Object.entries(actions.outfits)) {
      assert.deepEqual(Object.keys(clips).sort(), Object.keys(durations).sort());
      for (const [name, clip] of Object.entries(clips)) {
        const fishing = ['cast', 'wait', 'reel'].includes(name),
          [width, height] = pngSize(files[clip.image]);
        assert.equal(clip.image, `actions/${outfit}/${fishing ? 'fish' : name}.png`);
        assert.deepEqual(
          [clip.canvas, clip.anchor, clip.offset],
          fishing
            ? [
                [320, 256],
                [128, 239],
                [-32, -40],
              ]
            : name === 'dig'
              ? [
                  [224, 224],
                  [96, 199],
                  [0, 0],
                ]
              : [
                  [192, 208],
                  [96, 199],
                  [0, 0],
                ],
          name,
        );
        assert.deepEqual(
          clip.frames.map(frame => frame.duration),
          durations[name],
        );
        for (const frame of clip.frames) {
          const [x, y, w, h] = frame.rect;
          assert.deepEqual([w, h], clip.canvas);
          assert.ok(x + w <= width && y + h <= height, `${outfit} ${name} frame inside its atlas`);
          if (fishing) assert.ok(frame.tip[0] <= w && frame.tip[1] <= h && frame.tip.every(n => n >= 0));
          else assert.equal(frame.tip, undefined);
        }
        assert.equal(clip.loop, fishing ? name === 'wait' : undefined);
      }
      assert.deepEqual([clips.dig.contactAt, clips.dig.tossAt, clips.dig.commitAt], [560, 1280, undefined]);
      assert.deepEqual([clips.plant.contactAt, clips.plant.tossAt, clips.plant.commitAt], [520, 1360, 1360]);
      assert.deepEqual(
        [clips.cast, clips.wait, clips.reel].flatMap(clip => clip.frames.map(frame => frame.rect[0])),
        [0, 320, 640, 960, 1280, 1600],
      );
    }
    // The packed figures stand on the anchor at the sheet's idle height, and every point moved with them.
    const unpacked = path.join(dir, 'unpacked');
    await mkdir(path.join(unpacked, 'actions', 'base'), { recursive: true });
    for (const [name, bytes] of Object.entries(files)) {
      if (name.startsWith('actions/base/') || name === 'spritesheet.png' || name === 'actions.json')
        await writeFile(path.join(unpacked, name), bytes);
    }
    const measured = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image
import sys,json
from pathlib import Path
root=Path(sys.argv[1]); clips=json.loads((root/'actions.json').read_text())['outfits']['base']
box=lambda im:im.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
idle=box(Image.open(root/'spritesheet.png').crop((0,0,192,208))); idle=idle[3]-idle[1]
scale=idle/80
for name in ('dig','plant','discover','cast','wait','reel'):
 clip=clips[name]; atlas=Image.open(root/clip['image']).convert('RGBA')
 for frame in clip['frames']:
  x,y,w,h=frame['rect']; cell=atlas.crop((x,y,x+w,y+h))
  if name=='plant': cell=cell.crop((0,0,clip['anchor'][0]+round(21*scale),h))
  b=box(cell)
  assert abs((b[3]-b[1])-idle)<=2,(name,b,idle)
  assert abs((b[0]+b[2])/2-clip['anchor'][0])<=1.5,(name,b)
  assert abs(b[3]-clip['anchor'][1])<=1.5,(name,b)
  if 'tip' in frame:
   assert abs(frame['tip'][0]-clip['anchor'][0]-60*scale)<=1.5 and abs(clip['anchor'][1]-frame['tip'][1]-90*scale)<=1.5,(name,frame)
assert clips['dig']['ground']==[round(96+50*scale),199],clips['dig']['ground']
assert clips['plant']['ground']==[round(96+40*scale),199],clips['plant']['ground']
`,
        unpacked,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(measured.status, 0, measured.stderr);

    // Each refusal names what to fix, and no half-made ZIP is left.
    const points = path.join(poses, 'base', 'points.json'),
      given = JSON.parse(await readFile(points, 'utf8'));
    const refused = async (pattern, change, extra = args) => {
      const undo = await change();
      const attempt = run(...extra, '--overwrite');
      await undo?.();
      assert.notEqual(attempt.status, 0, String(pattern));
      assert.match(attempt.stderr, pattern);
    };
    const writePoints = value => async () => {
      await writeFile(points, JSON.stringify(value));
      return () => writeFile(points, JSON.stringify(given));
    };
    await refused(/six rod tips/, writePoints({ ...given, fish: { tips: given.fish.tips.slice(0, 5) } }));
    await refused(/six rod tips/, writePoints({ ...given, fish: {} }));
    await refused(/tile 2/, writePoints({ ...given, fish: { tips: given.fish.tips.with(2, [10, 10]) } }));
    await refused(/Unknown points/, writePoints({ ...given, swim: {} }));
    await refused(/points.json/, async () => {
      await rename(points, `${points}.away`);
      return () => rename(`${points}.away`, points);
    });
    await refused(/discover.png/, async () => {
      const file = path.join(poses, 'winter', 'discover.png');
      await rename(file, `${file}.away`);
      return () => rename(`${file}.away`, file);
    });
    await refused(/autumn2/, async () => {
      await mkdir(path.join(poses, 'autumn2'));
      return () => rm(path.join(poses, 'autumn2'), { recursive: true });
    });
    await refused(
      /--season winter/,
      () => {},
      args.filter((_, i) => i < 3 || i > 4),
    );
    const blank = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image
import sys
im=Image.open(sys.argv[1]).convert('RGBA'); im.paste((0,0,0,0),(1152,512,1536,1024)); im.save(sys.argv[2])`,
        path.join(poses, 'base', 'dig.png'),
        path.join(dir, 'blank.png'),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(blank.status, 0, blank.stderr);
    // A shovel blade below the paws pulls the guessed feet onto the blade and the figure off its
    // canvas: the refusal says so and names the `feet` points that fix it.
    const blade = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image,ImageDraw
import sys
im=Image.open(sys.argv[1]).convert('RGBA'); ImageDraw.Draw(im).rectangle((1152+172+120,380+82,1152+172+180,380+92),fill=(120,120,120,255)); im.save(sys.argv[2])`,
        path.join(poses, 'base', 'dig.png'),
        path.join(dir, 'blade.png'),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(blade.status, 0, blade.stderr);
    await refused(/tile 3 would clip.*feet were guessed.*dig\.feet/s, async () => {
      const file = path.join(poses, 'base', 'dig.png');
      await rename(file, `${file}.away`);
      await rename(path.join(dir, 'blade.png'), file);
      return async () => {
        await rename(file, path.join(dir, 'blade.png'));
        await rename(`${file}.away`, file);
      };
    });
    const tiles = given.plant.feet;
    await refused(
      /plant tile 3 would clip.*feet point 3/s,
      writePoints({ ...given, plant: { ...given.plant, feet: tiles.with(3, [tiles[3][0] + 120, tiles[3][1]]) } }),
    );
    await refused(/standing pose/, async () => {
      const file = path.join(poses, 'base', 'dig.png');
      await rename(file, `${file}.away`);
      await rename(path.join(dir, 'blank.png'), file);
      return () => rename(`${file}.away`, file);
    });
    assert.equal(run(...args, '--overwrite').status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('offline pose review sheet draws every packed frame without touching its sources', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-pose-sheet-'));
  try {
    const poses = path.join(dir, 'poses');
    const generated = spawnSync(python, ['-c', POSE_FIXTURE, poses], { encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr);
    const source = path.join(poses, 'base', 'fish.png'),
      original = await readFile(source),
      out = path.join(dir, 'review.png');
    const result = run('render-actions', '--actions', poses, '--output', out);
    assert.equal(result.status, 0, result.stderr);
    const [width, height] = pngSize(await readFile(out));
    assert.ok(width >= 6 * 320 && height >= 2 * (224 + 208 + 208 + 256), `${width}x${height}`);
    assert.deepEqual(await readFile(source), original);
    assert.notEqual(run('render-actions', '--actions', poses, '--output', source, '--overwrite').status, 0);
    assert.deepEqual(await readFile(source), original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Walk and run batches for the tests, in DIR/<outfit>/ for each comma-separated outfit. A walk
// toward or away is eight figures standing at (192, 460) of their 384×512 tiles, 79–81 px tall (the
// art's own bob), the body set off to the right of the feet so only a feet-centred packer puts the
// feet at x 96. A run is eight 76 px figures with the torso centred on x 192 and the feet ahead of
// it; tiles 3 and 7 are in flight, 10 px above their row's ground, and tiles 0 and 4 reach widest.
const WALK_FIXTURE = `from PIL import Image,ImageDraw
import sys
from pathlib import Path
root=Path(sys.argv[1])
for outfit in sys.argv[2].split(','):
 (root/outfit).mkdir(parents=True,exist_ok=True)
 for clip in ('walk-front','walk-back'):
  im=Image.new('RGBA',(1536,1024)); d=ImageDraw.Draw(im)
  for i,h in enumerate((80,79,81,80,80,79,81,80)):
   x=(i%4)*384+192; y=(i//4)*512+460
   d.rectangle((x-10,y-h,x+29,y-11),fill=(70,110,150,255))
   d.rectangle((x-16,y-10,x+15,y-1),fill=(40,60,90+i,255))
  im.save(root/outfit/f'{clip}.png')
 for clip in ('run-right','run-left'):
  im=Image.new('RGBA',(1536,1024)); d=ImageDraw.Draw(im)
  for i in range(8):
   x=(i%4)*384+192; y=(i//4)*512+460-(10 if i%4==3 else 0); w=40 if i%4==0 else 20
   d.rectangle((x-15,y-76,x+14,y-11),fill=(150,90,60,255))
   d.rectangle((x-5,y-10,x-6+w,y-1),fill=(90,50,30+i,255))
  im.save(root/outfit/f'{clip}.png')
`;
const WALKS = ['walk-front', 'walk-back', 'run-right', 'run-left'];
function py(code, ...args) {
  const result = spawnSync(python, ['-c', code, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('offline helper packs walks toward and away and runs into eight-cell clips at the sheet scale', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-walks-'));
  try {
    const poses = path.join(dir, 'poses');
    py(POSE_FIXTURE, poses);
    py(WALK_FIXTURE, poses, 'base,winter');
    const out = path.join(dir, 'pet.zip');
    const args = [
      'pack-pet',
      '--atlas',
      'assets/pets/clover/spritesheet.png',
      '--season',
      'winter=assets/pets/clover/spritesheet.png',
      '--actions',
      poses,
      '--id',
      'walker',
      '--name',
      'Walker',
      '--kind',
      'animal',
      '--output',
      out,
    ];
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /walk-front/);
    const files = entries(await readFile(out));
    const actions = JSON.parse(files['actions.json']);
    for (const outfit of ['base', 'winter']) {
      const clips = actions.outfits[outfit];
      assert.deepEqual(
        Object.keys(clips).sort(),
        ['cast', 'dig', 'discover', 'plant', 'reel', 'wait', ...WALKS].sort(),
        outfit,
      );
      for (const name of WALKS) {
        const clip = clips[name];
        const { frames, stride, ...rest } = clip;
        assert.deepEqual(rest, {
          image: `actions/${outfit}/${name}.png`,
          canvas: [192, 208],
          anchor: [96, 199],
          offset: [0, 0],
          loop: true,
        });
        assert.deepEqual(
          frames,
          Array.from({ length: 8 }, (_, i) => ({ rect: [i * 192, 0, 192, 208], duration: 100 })),
        );
        assert.deepEqual(pngSize(files[clip.image]), [1536, 208]);
        if (name.startsWith('run')) {
          // 2 × the widest pair's mean feet spread: tiles 0 and 4, 40 px at the run's scale.
          const scale = (0.95 * 168) / 76;
          assert.ok(Math.abs(stride - Math.round(((2 * 40 * scale) / 192) * 100) / 100) <= 0.02, `${stride}`);
          assert.ok(stride >= 0.5 && stride <= 1.2);
        } else assert.equal(stride, undefined);
      }
    }
    // Every walking figure's feet are on the anchor at the idle height; a run is 0.95 of it, its
    // torso on x 96, the grounded cells on the baseline and the flight cells as high as drawn.
    const unpacked = path.join(dir, 'unpacked');
    await mkdir(path.join(unpacked, 'actions', 'base'), { recursive: true });
    for (const [name, bytes] of Object.entries(files))
      if (name.startsWith('actions/base/') || name === 'spritesheet.png')
        await writeFile(path.join(unpacked, name), bytes);
    py(
      `from PIL import Image
import sys
from pathlib import Path
root=Path(sys.argv[1])
box=lambda im:im.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
idle=box(Image.open(root/'spritesheet.png').crop((0,0,192,208))); idle=idle[3]-idle[1]
for name in ('walk-front','walk-back'):
 strip=Image.open(root/'actions/base'/f'{name}.png').convert('RGBA'); scale=idle/80
 for i,h in enumerate((80,79,81,80,80,79,81,80)):
  cell=strip.crop((i*192,0,i*192+192,208)); b=box(cell)
  assert abs(b[3]-199)<=1,(name,i,b)
  assert abs((b[3]-b[1])-h*scale)<=3,(name,i,b)
  feet=box(cell.crop((0,b[3]-round(6*scale),192,b[3])))
  assert abs((feet[0]+feet[2])/2-96)<=1.5,(name,i,feet)
for name in ('run-right','run-left'):
 strip=Image.open(root/'actions/base'/f'{name}.png').convert('RGBA'); scale=0.95*idle/76
 for i in range(8):
  cell=strip.crop((i*192,0,i*192+192,208)); b=box(cell)
  lift=round(10*scale) if i%4==3 else 0
  assert abs(b[3]-(199-lift))<=1,(name,i,b,lift)
  assert abs((b[3]-b[1])-76*scale)<=3,(name,i,b)
  torso=box(cell.crop((0,b[1],192,b[1]+round(40*scale))))
  assert abs((torso[0]+torso[2])/2-96)<=1.5,(name,i,torso)
`,
      unpacked,
    );

    // Each refusal names the batch, the tile and what to fix.
    const edit = (name, code) => async () => {
      const file = path.join(poses, 'base', name),
        original = await readFile(file);
      py(
        `from PIL import Image,ImageDraw
import sys
im=Image.open(sys.argv[1]).convert('RGBA'); d=ImageDraw.Draw(im)
${code}
im.save(sys.argv[1])`,
        file,
      );
      return () => writeFile(file, original);
    };
    const refused = async (pattern, change) => {
      const undo = await change();
      const attempt = run(...args, '--overwrite');
      await undo?.();
      assert.notEqual(attempt.status, 0, String(pattern));
      assert.match(attempt.stderr, pattern);
    };
    await refused(/Expected 1536x1024.*walk-back/, edit('walk-back.png', `im=Image.new('RGBA',(1024,1024))`));
    // A generated picture with a faint haze over its whole background names the picture to clean.
    await refused(
      /true transparent background.*run-left\.png/,
      edit('run-left.png', `im.putalpha(im.getchannel('A').point(lambda a:max(a,6)))`),
    );
    await refused(
      /walk-front tile 2 crosses its tile gutter/,
      edit('walk-front.png', `d.rectangle((768,300,800,320),fill=(9,9,9,255))`),
    );
    await refused(/walk-front tile 5 is empty/, edit('walk-front.png', `im.paste((0,0,0,0),(384,512,768,1024))`));
    await refused(
      /walk-back tile 1 would clip its 192x208 cell/,
      edit('walk-back.png', `d.rectangle((384+192-150,400,384+192+29,410),fill=(9,9,9,255))`),
    );
    await refused(
      /walk-front tile 6 .*19 ?% .*within 5 ?%/,
      edit('walk-front.png', `d.rectangle((768+192-10,512+460-95,768+192+29,512+460-11),fill=(70,110,150,255))`),
    );
    await refused(
      /run-right tile 1 .*off the ground/,
      edit(
        'run-right.png',
        `im.paste((0,0,0,0),(384,0,768,512)); im.paste(Image.open(sys.argv[1]).crop((0,0,384,512)).transform((384,512),Image.AFFINE,(1,0,0,0,1,10)),(384,0))`,
      ),
    );
    await refused(
      /run-left tile 3 .*both feet off the ground/,
      edit(
        'run-left.png',
        `t=im.crop((1152,0,1536,512)); im.paste((0,0,0,0),(1152,0,1536,512)); im.paste(t,(1152,10))`,
      ),
    );
    await refused(/Unknown pose picture base\/walkfront\.png/, async () => {
      const file = path.join(poses, 'base', 'walkfront.png');
      await writeFile(file, await readFile(path.join(poses, 'base', 'walk-front.png')));
      return () => rm(file);
    });
    assert.equal(run(...args, '--overwrite').status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a pose folder may hold only walks, adds only the clips given, and still refuses half a game set', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-walks-only-'));
  try {
    const poses = path.join(dir, 'poses');
    py(WALK_FIXTURE, poses, 'base');
    await rm(path.join(poses, 'base', 'walk-back.png'));
    await rm(path.join(poses, 'base', 'run-left.png'));
    const out = path.join(dir, 'pet.zip');
    const args = [
      'pack-pet',
      '--atlas',
      'assets/pets/clover/spritesheet.png',
      '--actions',
      poses,
      '--id',
      'walker',
      '--name',
      'Walker',
      '--kind',
      'animal',
      '--output',
      out,
      '--overwrite',
    ];
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    const files = entries(await readFile(out));
    assert.deepEqual(Object.keys(files).sort(), [
      'actions.json',
      'actions/base/run-right.png',
      'actions/base/walk-front.png',
      'pet.json',
      'spritesheet.png',
    ]);
    assert.equal(JSON.parse(files['pet.json']).actionsPath, 'actions.json');
    assert.deepEqual(Object.keys(JSON.parse(files['actions.json']).outfits.base).sort(), ['run-right', 'walk-front']);

    // One game batch asks for the rest, as before.
    await writeFile(path.join(poses, 'base', 'dig.png'), await readFile(path.join(poses, 'base', 'walk-front.png')));
    let attempt = run(...args);
    assert.notEqual(attempt.status, 0);
    assert.match(attempt.stderr, /points\.json is missing/);
    await writeFile(path.join(poses, 'base', 'points.json'), JSON.stringify({ fish: { tips: [] } }));
    attempt = run(...args);
    assert.notEqual(attempt.status, 0);
    assert.match(attempt.stderr, /six rod tips/);
    await rm(path.join(poses, 'base', 'dig.png'));
    await rm(path.join(poses, 'base', 'points.json'));

    // A folder with nothing to pack says so.
    await mkdir(path.join(poses, 'winter'));
    attempt = run(...args, '--season', 'winter=assets/pets/clover/spritesheet.png');
    assert.notEqual(attempt.status, 0);
    assert.match(attempt.stderr, /winter\/ has no poses/);
    await rm(path.join(poses, 'winter'), { recursive: true });

    // The app opens at most 32 pose pictures a pet: five outfits of eight would lose some.
    py(POSE_FIXTURE, path.join(dir, 'full'));
    py(WALK_FIXTURE, path.join(dir, 'full'), 'base,spring,summer,autumn,winter');
    for (const outfit of ['spring', 'summer', 'autumn'])
      for (const name of ['dig', 'plant', 'discover', 'fish', 'points'])
        await writeFile(
          path.join(dir, 'full', outfit, `${name}.${name === 'points' ? 'json' : 'png'}`),
          await readFile(path.join(dir, 'full', 'base', `${name}.${name === 'points' ? 'json' : 'png'}`)),
        );
    attempt = run('render-actions', '--actions', path.join(dir, 'full'), '--output', path.join(dir, 'full.png'));
    assert.notEqual(attempt.status, 0);
    assert.match(attempt.stderr, /40 pose pictures.*at most 32/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the pose review sheet draws the walks and runs too, eight cells a row', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-walk-sheet-'));
  try {
    const poses = path.join(dir, 'poses');
    py(POSE_FIXTURE, poses);
    py(WALK_FIXTURE, poses, 'base,winter');
    const out = path.join(dir, 'review.png');
    const result = run('render-actions', '--actions', poses, '--output', out);
    assert.equal(result.status, 0, result.stderr);
    // Per outfit: dig 224, plant 208, discover 208 and fishing 256 high, then four 208-high walks,
    // each row with a 20 px label and a 12 px gap.
    const [width, height] = pngSize(await readFile(out));
    assert.equal(height, 24 + 2 * (32 * 8 + 224 + 208 + 208 + 256 + 4 * 208));
    assert.ok(width >= 24 + 8 * (192 + 12), `${width}`);
    // The last row (winter run-left) shows a figure in its eighth cell.
    py(
      `from PIL import Image
import sys
im=Image.open(sys.argv[1]).convert('RGB'); x=24+7*204; y=im.height-12-208
assert any(im.getpixel((x+96+dx,y+150))!=(237,244,252) for dx in range(-8,9)),'eighth run cell is empty'`,
      out,
    );
    assert.match(result.stdout, /stride/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the skill draws the gait guides the kit uses, as grey mannequins on a transparent picture', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'creator-guides-'));
  try {
    const guides = { walk: 'gait-guide', front: 'gait-guide-front', back: 'gait-guide-back', run: 'gait-guide-run' };
    for (const [gait, name] of Object.entries(guides)) {
      const out = path.join(dir, `${gait}.png`);
      const result = run('render-gait-guide', '--gait', gait, '--output', out);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(pngSize(await readFile(out)), [1536, 1024]);
      // The same picture the maintainers drew the four friends' walks with.
      py(
        `from PIL import Image,ImageChops
import sys
a=Image.open(sys.argv[1]).convert('RGBA'); b=Image.open(sys.argv[2]).convert('RGBA')
assert a.getchannel('A').getextrema()[0]==0
diff=ImageChops.difference(a,b); total=sum(i*n for i,n in enumerate(diff.convert('L').histogram()))
assert total/(1536*1024)<0.5,total`,
        out,
        `assets/sources/walk-2026-11-26/guides/${name}.png`,
      );
      assert.notEqual(run('render-gait-guide', '--gait', gait, '--output', out).status, 0, 'never replaced silently');
    }
    assert.notEqual(run('render-gait-guide', '--gait', 'hop', '--output', path.join(dir, 'hop.png')).status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
