// Prints the changelog's section for a version: node scripts/release-notes.mjs 0.2.0
// The release workflow uses it as the body of the GitHub release.

import { readFile } from 'node:fs/promises';
import { notesFor } from './release-lib.mjs';

const version = (process.argv[2] || '').replace(/^v/, '');
try {
  console.log(notesFor(await readFile('CHANGELOG.md', 'utf8'), version));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
