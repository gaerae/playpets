import assert from 'node:assert/strict';
import test from 'node:test';
import { submitStore } from '../scripts/store-submit.mjs';

const app = {
  id: '9NSKXQ6R187M',
  packageIdentityName: 'gaerae.PlayPets',
  publisherName: 'CN=85817E6E-C9F8-44E1-B251-9010546EC6B8',
  lastPublishedApplicationSubmission: { id: '10' },
};
const notes = { 'en-us': 'Update', 'ko-kr': 'Update', 'ja-jp': 'Update', 'zh-cn': 'Update' };
const release = { version: '1.0.0', files: ['PlayPets_1.0.0_x64.msix', 'PlayPets_1.0.0_arm64.msix'], notes };

function clientFor(product = app, hold = 'Manual') {
  const calls = [];
  return {
    calls,
    request: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path === '') return product;
      if (method === 'POST' && path === '/submissions')
        return {
          id: '20',
          fileUploadUrl: 'https://example.blob.core.windows.net/package?sig=private',
          pricing: { priceId: 'unknown' },
          applicationPackages: [{ id: 'old', fileName: 'old.msix', fileStatus: 'Uploaded' }],
          listings: Object.fromEntries(Object.keys(notes).map(key => [key, { baseListing: { releaseNotes: 'old' } }])),
        };
      if (method === 'GET' && path === '/submissions/20') return { id: '20', targetPublishMode: hold };
      if (path.endsWith('/status')) return { status: 'CommitStarted', fileUploadUrl: 'private' };
      return {};
    },
    upload: async url => {
      calls.push({ method: 'UPLOAD', url });
    },
  };
}

test('Store submission leaves the initial portal draft and unpublished products untouched', async () => {
  for (const product of [
    { ...app, lastPublishedApplicationSubmission: undefined },
    { ...app, pendingApplicationSubmission: { id: '11' } },
  ]) {
    const client = clientFor(product);
    await assert.rejects(submitStore(client, release), /published baseline|pending submission/);
    assert.deepEqual(
      client.calls.map(call => call.method),
      ['GET'],
    );
  }
});

test('Store submission keeps manual publication, replaces packages and leaves Pricing V2 out of updates', async () => {
  const client = clientFor();
  const report = await submitStore(client, release);
  const update = client.calls.find(call => call.method === 'PUT').body;
  assert.equal(update.targetPublishMode, 'Manual');
  assert.equal('pricing' in update, false);
  assert.equal(update.applicationPackages[0].fileStatus, 'PendingDelete');
  assert.deepEqual(
    update.applicationPackages.slice(1),
    release.files.map(fileName => ({
      fileName,
      fileStatus: 'PendingUpload',
      minimumDirectXVersion: 'None',
      minimumSystemRam: 'None',
    })),
  );
  assert.deepEqual(
    client.calls.map(call => call.method),
    ['GET', 'POST', 'PUT', 'UPLOAD', 'GET', 'POST', 'GET'],
  );
  assert.equal(client.calls.at(-2).path, '/submissions/20/commit');
  assert.equal(report.submissionId, '20');
  assert.equal(report.publishMode, 'Manual');
  assert.doesNotMatch(JSON.stringify(report), /sig=|fileUploadUrl|private/);
});

test('Store submission does not commit if the server did not retain manual publication', async () => {
  const client = clientFor(app, 'Immediate');
  await assert.rejects(submitStore(client, release), /Manual publication hold was not retained/);
  assert.ok(client.calls.every(call => !call.path?.endsWith('/commit')));
});

test('Store submission rejects non-Azure upload URLs without uploading credentials or packages', async () => {
  const client = clientFor();
  const original = client.request;
  client.request = async (...args) => {
    const response = await original(...args);
    return response.fileUploadUrl ? { ...response, fileUploadUrl: 'https://untrusted.example/upload' } : response;
  };
  await assert.rejects(submitStore(client, release), /Invalid Store upload destination/);
  assert.ok(client.calls.every(call => !['UPLOAD', 'PUT'].includes(call.method)));
});

test('Store submission requires both architectures and release notes before changing a draft', async () => {
  for (const invalid of [
    { ...release, files: ['../package.msix'] },
    { ...release, files: [] },
    { ...release, notes: {} },
  ]) {
    const client = clientFor();
    await assert.rejects(submitStore(client, invalid), /package files|release notes/);
    assert.equal(client.calls.length, 0);
  }
});

test('Store packaging executes only the current trusted workflow commit', async () => {
  const { readFile } = await import('node:fs/promises');
  const workflow = await readFile('.github/workflows/store-package.yml', 'utf8');
  assert.match(workflow, /test "\$sha" = "\$GITHUB_SHA"/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ needs\.source\.outputs\.sha \}\}/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
});
