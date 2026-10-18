import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderManifest } from '../scripts/msix-manifest.mjs';

const template = readFileSync('packaging/windows/msix/AppxManifest.xml', 'utf8');
const identity = {
  MSIX_IDENTITY_NAME: '12345.Owner.PlayPets',
  MSIX_PUBLISHER: 'CN=12345678-1234-1234-1234-123456789abc',
  MSIX_PUBLISHER_DISPLAY_NAME: 'Owner & Friends',
};
test('Store identity is complete, escaped and independent of the app display name', () => {
  const xml = renderManifest(template, '1.0.0', identity);
  assert.match(xml, /Name="12345.Owner.PlayPets"/);
  assert.match(xml, /Publisher="CN=12345678-1234-1234-1234-123456789abc"/);
  assert.match(xml, /<PublisherDisplayName>Owner &amp; Friends<\/PublisherDisplayName>/);
  assert.match(xml, /Version="1.0.0.0"/);
  assert.match(xml, /<DisplayName>PlayPets<\/DisplayName>/);
  assert.doesNotMatch(xml, /@(?:VERSION|PUBLISHER|IDENTITY_NAME|PUBLISHER_DISPLAY_NAME)@/);
});
test('partial Store credentials and malformed identities cannot produce a submission', () => {
  for (const name of Object.keys(identity)) {
    const incomplete = { ...identity };
    delete incomplete[name];
    assert.throws(() => renderManifest(template, '1.0.0', incomplete), /MSIX_/);
  }
  assert.throws(
    () => renderManifest(template, '1.0.0', { ...identity, MSIX_IDENTITY_NAME: 'invalid/name' }),
    /identity/i,
  );
  assert.throws(
    () => renderManifest(template, '1.0.0', { ...identity, MSIX_PUBLISHER: 'PlayPets Test' }),
    /publisher/i,
  );
  assert.throws(() => renderManifest(template, '0.2.0-beta', identity), /version/i);
});
test('local test packages keep the test identity when no Store values are supplied', () => {
  const xml = renderManifest(template, '1.0.0', {});
  assert.match(xml, /Publisher="CN=PlayPets Test"/);
  assert.match(xml, /Name="gaerae.PlayPets"/);
});

test('MSIX versions match app versions with a zero fourth component', () => {
  assert.match(renderManifest(template, '1.0.0', identity), /Version="1.0.0.0"/);
  assert.match(renderManifest(template, '1.2.3', identity), /Version="1.2.3.0"/);
  assert.match(renderManifest(template, '65535.65535.65535', identity), /Version="65535.65535.65535.0"/);
  for (const version of ['0.2.0', '65536.0.0', '1.65536.0', '1.0.65536'])
    assert.throws(() => renderManifest(template, version, identity), /version/i);
});

test('native CI selects x64 or ARM64 without accepting arbitrary architecture text', () => {
  assert.match(renderManifest(template, '1.0.0', { MSIX_ARCHITECTURE: 'arm64' }), /ProcessorArchitecture="arm64"/);
  assert.match(renderManifest(template, '1.0.0'), /ProcessorArchitecture="x64"/);
  assert.throws(() => renderManifest(template, '1.0.0', { MSIX_ARCHITECTURE: 'x86' }), /architecture/i);
});
