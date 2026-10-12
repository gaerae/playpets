// Reference collages copy production cells; they never invent a new view or alter source artwork.

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dataUrl, dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';
import { publicProvenance, validatePng, zipStore } from './creator-bundle-lib.mjs';
import { baselineManifest, kitEntries, kitPrompts, kitSpec, petManifest } from './creator-specs.mjs';
import { pngSize, sha256 } from './png-lossless-lib.mjs';

// A fork's kits credit the fork (package.json, as site-prepare reads it).
const { repository: slug } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const repository = `https://github.com/${slug.replace(/^github:/, '')}`;

export const creatorKits = kitEntries.map(entry => {
  const spec = kitSpec(entry.id),
    root = `assets/pets/${spec.character}`;
  const base = spec.style === 'realistic' ? `${root}/realistic` : root;
  return {
    id: entry.id,
    sheets: [
      `${base}/spritesheet.png`,
      ...entry.seasons.map(season =>
        spec.style === 'realistic' ? `${base}/${season}.png` : `${base}/seasonal/${season}.png`,
      ),
    ],
  };
});
const cell = (row, column, label) => ({ row, column, label });
export const referenceSheets = {
  'identity-reference': [
    cell(0, 0, 'Rest / front'),
    cell(1, 0, 'Walk right'),
    cell(2, 0, 'Walk left'),
    cell(9, 0, 'Look up'),
    cell(9, 4, 'Look right'),
    cell(10, 4, 'Look left'),
  ],
  'expression-reference': [
    cell(0, 0, 'Rest'),
    cell(3, 1, 'Greeting'),
    cell(5, 0, 'Concern'),
    cell(6, 0, 'Thinking'),
    cell(7, 0, 'Working'),
    cell(8, 1, 'Celebrating'),
  ],
  'motion-reference': [
    'idle',
    'right',
    'left',
    'wave',
    'jump',
    'error',
    'waiting',
    'working',
    'done',
    'look N–SSE',
    'look S–NNW',
  ].flatMap((name, row) => Array.from({ length: 8 }, (_, column) => cell(row, column, `${name} ${column}`))),
};

export async function createCreatorKit(destination = 'assets/creator-kit', kits = creatorKits) {
  // Check every source before writing so incomplete artwork cannot silently produce a partial kit.
  const inputs = await Promise.all(
    kits.map(async kit => ({
      ...kit,
      sources: await Promise.all(
        kit.sheets.map(async file => {
          const bytes = await readFile(file);
          const { width, height } = pngSize(bytes);
          if (width !== 1536 || height !== 2288) throw new Error(`Invalid creator-kit source: ${file}`);
          return dataUrl(bytes);
        }),
      ),
    })),
  );
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    for (const kit of inputs) {
      const target = `${destination}/${kit.id}`;
      await mkdir(target, { recursive: true });

      const pictures = await page.evaluate(
        async ({ kit, referenceSheets }) => {
          const images = await Promise.all(
            kit.sources.map(async source => {
              const image = new Image();
              image.src = source;
              await image.decode();
              return image;
            }),
          );
          const sheets = {
            ...referenceSheets,
            'wardrobe-reference': (kit.sources.length === 1
              ? ['Baseline / all seasons']
              : ['Baseline / spring / autumn', 'Summer', 'Winter']
            ).map((label, image) => ({
              row: 0,
              column: 0,
              label,
              image,
            })),
          };
          return Object.fromEntries(
            Object.entries(sheets).map(([name, cells]) => {
              const columns = name === 'motion-reference' ? 8 : 3;
              const canvas = document.createElement('canvas');
              canvas.width = columns * 208;
              canvas.height = 48 + Math.ceil(cells.length / columns) * 240;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#f5f3eb';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#253d35';
              ctx.font = 'bold 17px sans-serif';
              ctx.fillText(`${kit.id} · ${name} · reference only`, 16, 29);
              for (const [index, cell] of cells.entries()) {
                const x = (index % columns) * 208,
                  y = 48 + Math.floor(index / columns) * 240;
                ctx.drawImage(images[cell.image || 0], cell.column * 192, cell.row * 208, 192, 208, x + 8, y, 192, 208);
                ctx.font = '12px sans-serif';
                ctx.fillText(cell.label, x + 8, y + 226);
              }
              return [name, canvas.toDataURL('image/png')];
            }),
          );
        },
        { kit, referenceSheets },
      );
      for (const [name, bytes] of Object.entries(pictures))
        await writeFile(`${target}/${name}.png`, dataUrlBytes(bytes));
    }
  } finally {
    await browser.close();
  }
}

export async function copyCreatorKit(destination = 'website/public/creator-kit', { saveSpecs = false } = {}) {
  const prepared = [];
  // Validate every kit before publishing any: a missing design reference is not a partial release.
  for (const kit of creatorKits) {
    const spec = kitSpec(kit.id),
      files = new Map();
    const details = spec.references.detail === 'available' ? ['turnaround', 'face-detail'] : [];
    for (const name of [...details, ...Object.keys(referenceSheets), 'wardrobe-reference']) {
      const bytes = await readFile(`assets/creator-kit/${kit.id}/${name}.png`);
      const size = validatePng(bytes);
      if (['turnaround', 'face-detail'].includes(name) && Math.max(size.width, size.height) < 1024)
        throw new Error(`Creator reference is not high resolution: ${kit.id}/${name}`);
      files.set(`${name}.png`, bytes);
    }
    for (const [index, source] of kit.sheets.entries()) {
      const bytes = await readFile(source);
      validatePng(bytes, { canonical: true });
      files.set(`${['spritesheet', 'summer', 'winter'][index]}.png`, bytes);
    }
    const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    if (spec.style === 'realistic') {
      const portrait = await readFile(`assets/pets/${spec.character}/realistic/portrait.png`);
      validatePng(portrait);
      files.set('portrait.png', portrait);
    }
    files.set('identity.json', json(spec));
    for (const [name, prompt] of Object.entries(kitPrompts(spec)))
      files.set(`prompts/${name}.txt`, Buffer.from(`${prompt}\n`));
    files.set('pet.json', json(petManifest(spec)));
    for (const name of details) {
      for (const suffix of ['prompt.txt', 'generation.txt']) {
        try {
          files.set(
            `provenance/${name}.${suffix}`,
            Buffer.from(publicProvenance(await readFile(`assets/creator-kit/${kit.id}/${name}.${suffix}`, 'utf8'))),
          );
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
    files.set(
      'README.txt',
      Buffer.from(
        `${spec.name} — ${spec.style} design kit\n\n${details.length ? 'Turnaround and face-detail are high-resolution extension references, not runtime sprites.' : 'Detailed turnaround and face-detail sheets have not been created for this pet. Prompts describe how to propose them; the shipped runtime collages remain the approved identity source.'} identity-reference, wardrobe-reference, expression-reference and motion-reference are supplemental collages of shipped cells. Read identity.json and prompts/ before generation; inspect every generated face, accessory side and action manually.\n\nRuntime remains v2: 1536x2288, 8x11 cells of 192x208, 88 cells; leading counts [6, 8, 8, 4, 5, 8, 6, 6, 6] plus 16 gaze. Do not import the reference images.\n\nTo use the separate pet download: extract importable-pet.zip, then choose its containing folder in PlayPets. This design ZIP also contains those same runtime files. ZIP import itself is not required or promised. This is an independent creator-kit copy; each named built-in entry retains its own default artwork. All drawing styles use the same pet format. baseline-pet.zip contains only pet.json and spritesheet.png; importable-pet.zip adds only available optional PlayPets seasonal sheets and chat portrait. Check identity.json references for availability; absent seasonal artwork is not supplied or simulated.\n\nSource artwork: PlayPets, ${repository}, MIT. Fictional characters only.\n`,
      ),
    );
    const manifest = {
      schemaVersion: 1,
      id: kit.id,
      identity: 'identity.json',
      references: [
        ...details.map(name => `${name}.png`),
        ...Object.keys(referenceSheets).map(name => `${name}.png`),
        'wardrobe-reference.png',
        ...(files.has('portrait.png') ? ['portrait.png'] : []),
      ],
      availability: spec.references,
      files: Object.fromEntries(
        [...files].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha256(bytes) }]),
      ),
    };
    files.set('kit.json', json(manifest));
    const entries = [...files].map(([name, bytes]) => ({ name, bytes }));
    const petEntries = entries.filter(entry =>
      ['pet.json', 'spritesheet.png', 'summer.png', 'winter.png', 'portrait.png'].includes(entry.name),
    );
    const baseline = zipStore([
      { name: 'pet.json', bytes: json(baselineManifest(spec)) },
      { name: 'spritesheet.png', bytes: files.get('spritesheet.png') },
    ]);
    prepared.push({ kit, files, design: zipStore(entries), pet: zipStore(petEntries), baseline });
  }
  for (const { kit, files, design, pet, baseline } of prepared) {
    const target = `${destination}/${kit.id}`,
      source = `assets/creator-kit/${kit.id}`;
    await mkdir(target, { recursive: true });
    for (const [name, bytes] of files) {
      const slash = name.lastIndexOf('/');
      if (slash >= 0) await mkdir(`${target}/${name.slice(0, slash)}`, { recursive: true });
      await writeFile(`${target}/${name}`, bytes);
      if (saveSpecs && (name === 'identity.json' || name === 'kit.json' || name.startsWith('prompts/'))) {
        if (slash >= 0) await mkdir(`${source}/${name.slice(0, slash)}`, { recursive: true });
        await writeFile(`${source}/${name}`, bytes);
      }
    }
    await writeFile(`${target}/design-kit.zip`, design);
    await writeFile(`${target}/importable-pet.zip`, pet);
    await writeFile(`${target}/baseline-pet.zip`, baseline);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--metadata') {
    await copyCreatorKit(undefined, { saveSpecs: true });
    execFileSync(
      process.execPath,
      [
        'node_modules/@biomejs/biome/bin/biome',
        'format',
        '--write',
        ...creatorKits.flatMap(kit =>
          ['identity.json', 'kit.json'].map(name => `assets/creator-kit/${kit.id}/${name}`),
        ),
      ],
      { stdio: 'inherit' },
    );
  } else await createCreatorKit(process.argv[2]);
}
