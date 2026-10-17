// Packages the portable skill; no model calls, installed skills or source artwork are changed.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { backgroundLayout, backgroundSheet } from './background-specs.mjs';
import { zipStore } from './creator-bundle-lib.mjs';

export async function copyCreatorSkill(destination = 'website/public/creator-kit/skill') {
  const root = 'assets/creator-skill/playpets-creator';
  const names = ['SKILL.md', 'LICENSE', 'requirements.txt', 'references/formats.md', 'scripts/creator-workflow.py'];
  const files = await Promise.all(names.map(async name => ({ name, text: await readFile(`${root}/${name}`, 'utf8') })));
  files.push({
    name: 'references/layouts.json',
    text: JSON.stringify(
      Object.fromEntries(
        ['garden', 'lakeside', 'interior'].map(id => [id, { name: 'My space', ...backgroundLayout(id) }]),
      ),
      null,
      2,
    ),
  });
  const { version, author } = JSON.parse(await readFile('package.json', 'utf8'));
  const plugin = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: 'playpets-creator',
    version,
    description: 'Create and package PlayPets pets and backgrounds',
    license: 'MIT',
    author: { name: author },
    extensions: { 'com.openai': { requires_local_executor: true } },
  };
  const compatibility = {
    name: plugin.name,
    version,
    description: plugin.description,
    author: plugin.author,
    license: 'MIT',
    skills: './skills/',
  };
  const revision = createHash('sha256')
    .update(JSON.stringify({ files, plugin, compatibility }))
    .digest('hex')
    .slice(0, 16);
  await mkdir(destination, { recursive: true });
  await writeFile(`${destination}/files.json`, JSON.stringify({ version: 1, revision, files }));
  await writeFile(
    `${destination}/playpets-creator.zip`,
    zipStore(files.map(f => ({ name: `playpets-creator/${f.name}`, bytes: Buffer.from(f.text) }))),
  );
  await writeFile(
    `${destination}/playpets-creator-plugin.zip`,
    zipStore([
      { name: 'plugin.json', bytes: Buffer.from(JSON.stringify(plugin, null, 2)) },
      {
        name: '.claude-plugin/plugin.json',
        bytes: Buffer.from(JSON.stringify(compatibility, null, 2)),
      },
      ...files.map(f => ({ name: `skills/playpets-creator/${f.name}`, bytes: Buffer.from(f.text) })),
    ]),
  );
  for (const id of ['garden', 'lakeside', 'interior']) {
    await writeFile(
      `${destination}/${id}-layout.svg`,
      backgroundSheet({ indoor: id === 'interior', ...backgroundLayout(id) }),
    );
  }
  for (const [id, file] of [
    ['garden', 'green'],
    ['lakeside', 'lakeside-spring'],
    ['interior', 'studio-cozy-day'],
  ])
    await cp(`src/art/environments/${file}.png`, `${destination}/${id}.png`);
  return revision;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await copyCreatorSkill();
