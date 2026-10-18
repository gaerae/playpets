// The Store owns package identity; all three values travel together or the build stops.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function renderManifest(template, version, env = {}) {
  const architecture = env.MSIX_ARCHITECTURE || 'x64';
  if (!['x64', 'arm64'].includes(architecture)) throw new Error('Invalid MSIX architecture');
  const keys = ['MSIX_IDENTITY_NAME', 'MSIX_PUBLISHER', 'MSIX_PUBLISHER_DISPLAY_NAME'];
  const store = keys.some(key => env[key] !== undefined && env[key] !== '');
  if (store) for (const key of keys) if (!env[key]?.trim()) throw new Error(`Missing ${key} for a Store package`);
  const [name, publisher, display] = store
    ? keys.map(key => env[key].trim())
    : ['gaerae.PlayPets', 'CN=PlayPets Test', 'gaerae'];
  if (!/^[A-Za-z0-9.-]{3,50}$/.test(name)) throw new Error('Invalid MSIX identity name');
  const controls = value => [...value].some(char => char.charCodeAt(0) < 32);
  if (!publisher.startsWith('CN=') || controls(publisher)) throw new Error('Invalid MSIX publisher');
  if (controls(display)) throw new Error('Invalid publisher display name');
  const parts = version.split('.');
  if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part) || Number(part) > 65535) || Number(parts[0]) === 0)
    throw new Error('Invalid MSIX version');
  const xmlEscape = value =>
    value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
  const values = {
    ARCHITECTURE: architecture,
    VERSION: `${parts.map(Number).join('.')}.0`,
    IDENTITY_NAME: name,
    PUBLISHER: publisher,
    PUBLISHER_DISPLAY_NAME: display,
  };
  return template.replace(/@(VERSION|IDENTITY_NAME|PUBLISHER|PUBLISHER_DISPLAY_NAME|ARCHITECTURE)@/g, (_, key) =>
    xmlEscape(values[key]),
  );
}

export function storeNotes(version, env) {
  const packageVersion = renderManifest('@VERSION@', version, env);
  if (!env.MSIX_PUBLISHER) throw new Error('Store notes require Store identity');
  return `PlayPets Store hand-off
=======================

App version: ${version}
MSIX package version: ${packageVersion}
Architecture: ${env.MSIX_ARCHITECTURE || 'x64'}
Name: ${env.MSIX_IDENTITY_NAME.trim()}
Publisher: ${env.MSIX_PUBLISHER.trim()}
PublisherDisplayName: ${env.MSIX_PUBLISHER_DISPLAY_NAME.trim()}

This unsigned MSIX is for Partner Center submission. Building it does not submit or publish it.
Microsoft signs the Store-distributed package after certification. This package is not a trusted
local installer; use the separately signed msix-test package on a disposable Windows device.
WebView2 Runtime is required; the loader DLL alone does not include the runtime.

Before submission, follow docs/how-to/store-and-apple-signing.md for identity, WACK,
first-submission metadata, privacy information and manual publication hold.
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, version, notes] = process.argv.slice(2);
  writeFileSync(output, renderManifest(readFileSync(input, 'utf8'), version, process.env));
  if (notes) writeFileSync(notes, storeNotes(version, process.env));
}
