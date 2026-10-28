// Prints the GitHub release body for a version: node scripts/release-notes.mjs 0.2.0
// A link to the release page for people using the app, then the changelog's section.

import { readFile } from 'node:fs/promises';
import { releaseBody } from './release-lib.mjs';

const version = (process.argv[2] || '').replace(/^v/, '');
try {
  console.log(releaseBody(await readFile('CHANGELOG.md', 'utf8'), version));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
