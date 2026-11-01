import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { storeNotes, storeNotesFor } from '../scripts/store-notes.mjs';
import { forThisRelease, storeFailure, submitStore } from '../scripts/store-submit.mjs';

const app = {
  id: '9NSKXQ6R187M',
  packageIdentityName: 'gaerae.PlayPets',
  publisherName: 'CN=85817E6E-C9F8-44E1-B251-9010546EC6B8',
  lastPublishedApplicationSubmission: { id: '10' },
};
const notes = { 'en-us': 'Update', 'ko-kr': 'Update', 'ja-jp': 'Update', 'zh-cn': 'Update' };
const release = {
  version: '1.3.0',
  files: ['PlayPets_1.3.0_x64.msix', 'PlayPets_1.3.0_arm64.msix'],
  notes,
  publishMode: 'Manual',
};
const fullTrust = 'runFullTrust: desktop windows, tray and the coding-tool bridge the person turns on.';

const listingsFor = keys => Object.fromEntries(keys.map(key => [key, { baseListing: { releaseNotes: 'old' } }]));

function clientFor(product = app, hold = 'Manual', storeVersion = '1.2.0.0', listingKeys = Object.keys(notes)) {
  const calls = [];
  return {
    calls,
    request: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path === '') return product;
      if (method === 'GET' && path === '/submissions/10')
        return {
          id: '10',
          applicationPackages: [{ id: 'old', version: storeVersion }],
          listings: listingsFor(listingKeys),
        };
      if (method === 'POST' && path === '/submissions')
        return {
          id: '20',
          fileUploadUrl: 'https://example.blob.core.windows.net/package?sig=private',
          pricing: { priceId: 'unknown' },
          notesForCertification: fullTrust,
          applicationPackages: [{ id: 'old', fileName: 'old.msix', fileStatus: 'Uploaded' }],
          listings: listingsFor(listingKeys),
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

test('Store submission leaves a version the Store already has untouched', async () => {
  for (const storeVersion of ['1.3.0.0', '1.10.0.0', '2.0.0.0']) {
    const client = clientFor(app, 'Manual', storeVersion);
    await assert.rejects(submitStore(client, release), /already has this version/);
    assert.deepEqual(
      client.calls.map(call => call.method),
      ['GET', 'GET'],
    );
  }
});

test('Store submission keeps manual publication, replaces packages and leaves Pricing V2 out of updates', async () => {
  const client = clientFor();
  const report = await submitStore(client, release);
  const update = client.calls.find(call => call.method === 'PUT').body;
  assert.equal(update.targetPublishMode, 'Manual');
  assert.equal('pricing' in update, false);
  assert.equal(update.notesForCertification, fullTrust);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(update.listings).map(([locale, item]) => [locale, item.baseListing.releaseNotes]),
    ),
    notes,
  );
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
    ['GET', 'GET', 'POST', 'PUT', 'UPLOAD', 'GET', 'POST', 'GET'],
  );
  assert.equal(client.calls.at(-2).path, '/submissions/20/commit');
  assert.equal(report.submissionId, '20');
  assert.equal(report.publishMode, 'Manual');
  assert.equal(report.publishesAfterCertification, false);
  assert.doesNotMatch(JSON.stringify(report), /sig=|fileUploadUrl|private/);
});

test('Store submission publishes after certification only when asked to', async () => {
  const client = clientFor(app, 'Immediate');
  const report = await submitStore(client, { ...release, publishMode: 'Immediate' });
  assert.equal(client.calls.find(call => call.method === 'PUT').body.targetPublishMode, 'Immediate');
  assert.equal(report.publishesAfterCertification, true);
  await assert.rejects(submitStore(clientFor(), { ...release, publishMode: 'SoonAsPossible' }), /publish mode/);
});

test('Store submission does not commit if the server did not retain the publish mode', async () => {
  const client = clientFor(app, 'Immediate');
  await assert.rejects(submitStore(client, release), /Manual publication was not retained/);
  assert.ok(client.calls.every(call => !call.path?.endsWith('/commit')));
  assert.equal(client.calls.at(-1).method, 'DELETE');
});

// A draft left behind stops the next run, so one this script made goes as soon as it cannot be committed.
const refusing = (method, removal = async () => ({})) => {
  const client = clientFor();
  const { request } = client;
  client.request = async (verb, path, body) => {
    if (verb === 'DELETE') {
      client.calls.push({ method: verb, path });
      return removal();
    }
    if (verb === method) throw Object.assign(new Error('Store request failed (HTTP 400): pricing'), { safe: true });
    return request(verb, path, body);
  };
  return client;
};

test('Store submission removes its own draft when the update is refused', async () => {
  const client = refusing('PUT');
  await assert.rejects(submitStore(client, release), /HTTP 400\): pricing\. The new draft was removed\./);
  assert.deepEqual(client.calls.at(-1), { method: 'DELETE', path: '/submissions/20' });
  assert.ok(client.calls.every(call => call.method !== 'UPLOAD' && !call.path?.endsWith('/commit')));
});

test('Store submission says when its draft is still there', async () => {
  const client = refusing('PUT', async () => {
    throw new Error('network');
  });
  await assert.rejects(submitStore(client, release), /still in Partner Center; delete it before retrying/);
});

test('Store submission hides what it did not write when it removes its draft', async () => {
  const client = clientFor();
  const { request } = client;
  client.request = async (verb, path, body) => {
    if (verb === 'PUT') throw new Error('sig=private');
    return request(verb, path, body);
  };
  await assert.rejects(submitStore(client, release), error => {
    assert.equal(error.safe, true);
    assert.doesNotMatch(error.message, /private/);
    return true;
  });
});

test('Store submission keeps a draft it already asked the Store to commit', async () => {
  const client = clientFor();
  const { request } = client;
  client.request = async (verb, path, body) => {
    if (path.endsWith('/commit')) throw Object.assign(new Error('refused'), { safe: true });
    return request(verb, path, body);
  };
  await assert.rejects(submitStore(client, release), /refused/);
  assert.ok(client.calls.every(call => call.method !== 'DELETE'));
});

test("a refused Store request says Microsoft's reason, without an address or a long value", () => {
  const key = 'a'.repeat(40);
  const body = JSON.stringify({
    code: 'InvalidParameterValue',
    target: 'pricing',
    message: `Bad value\n  at https://example.blob.core.windows.net/package?sig=private ${key}`,
  });
  const text = storeFailure(400, body);
  assert.match(text, /^Store request failed \(HTTP 400\): /);
  assert.match(text, /InvalidParameterValue/);
  assert.match(text, /pricing/);
  assert.doesNotMatch(text, /https:|sig=|private|\n/);
  assert.ok(!text.includes(key));
  assert.equal(storeFailure(503, ''), 'Store request failed (HTTP 503)');
  assert.ok(storeFailure(400, 'x '.repeat(2000)).length < 900);
});

test('a release is sent from its tag, or from main when main names the tag', () => {
  assert.equal(forThisRelease({ GITHUB_REF: 'refs/tags/v1.4.0' }, '1.4.0'), true);
  assert.equal(forThisRelease({ GITHUB_REF: 'refs/tags/v1.3.0' }, '1.4.0'), false);
  assert.equal(forThisRelease({ GITHUB_REF: 'refs/heads/main', STORE_RELEASE_TAG: 'v1.4.0' }, '1.4.0'), true);
  assert.equal(forThisRelease({ GITHUB_REF: 'refs/heads/main' }, '1.4.0'), false);
  assert.equal(forThisRelease({ GITHUB_REF: 'refs/heads/main', STORE_RELEASE_TAG: 'v1.3.0' }, '1.4.0'), false);
  assert.equal(forThisRelease({ GITHUB_REF: 'refs/heads/other', STORE_RELEASE_TAG: 'v1.4.0' }, '1.4.0'), false);
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

test("What's new comes from the four release pages, as plain text within the Store limit", () => {
  const page = (intro, items) =>
    `---\nversion: 1.3.0\n---\n\n# 1.3.0\n\n<ReleaseMeta />\n\n${intro}\n\n<Downloads version="1.3.0" />\n\n## What changed\n\n${items
      .map(item => `- ${item}`)
      .join('\n')}\n\nRead [the guide](../guide/play.md).\n`;
  const { text, left } = storeNotes(
    page('PlayPets 1.3.0 brings **rain**.', ['Turn on **Rain** in [Settings](../guide/settings.md).', 'Use `Esc`.']),
    'https://playpets.gaerae.com/releases/1.3.0',
  );
  assert.equal(
    text,
    'PlayPets 1.3.0 brings rain.\n\n• Turn on Rain in Settings.\n• Use Esc.\n\nhttps://playpets.gaerae.com/releases/1.3.0',
  );
  assert.equal(left, 0);
  const long = storeNotes(
    page(
      'Intro.',
      Array.from({ length: 20 }, () => 'x'.repeat(100)),
    ),
    'https://example.test/1',
  );
  assert.ok([...long.text].length <= 1500);
  assert.equal(long.left, 6);
  assert.match(long.text, /https:\/\/example\.test\/1$/);
  assert.throws(() => storeNotes(page('', ['One change.']), 'https://example.test/1'), /opening sentence/);

  const read = file => {
    assert.match(file, /^website\/((ko|ja|zh-hans)\/)?releases\/1\.3\.0\.md$/);
    return page(`Intro ${file}.`, ['One change.']);
  };
  const { notes: all } = storeNotesFor('1.3.0', read);
  assert.deepEqual(Object.keys(all), ['en-us', 'ko-kr', 'ja-jp', 'zh-cn']);
  assert.match(
    all['ko-kr'],
    /website\/ko\/releases\/1\.3\.0\.md[\s\S]*https:\/\/playpets\.gaerae\.com\/ko\/releases\/1\.3\.0$/,
  );
  assert.match(all['zh-cn'], /\/zh-hans\/releases\/1\.3\.0$/);
  assert.throws(() => storeNotesFor('1.3.0-beta.1', read), /Not a release version/);
});

test("the Store gets the release page's first section for Windows: no Also section, no other system's line", () => {
  const page = `---\nversion: 1.4.0\n---\n\n# 1.4.0\n\n<ReleaseMeta />\n\nPlayPets 1.4.0 brings rain.\n\n<Downloads version="1.4.0" />\n\n## What changed\n\n- Rain falls.\n- <Only os="macOS" /> The Mac app opens faster.\n- <Only os="Windows" /> The Windows tray icon is sharper.\n- <Only os="Linux" /> The AppImage starts on more systems.\n\n## Also\n\n- Install with winget.\n- Security updates.\n`;
  const { text, left } = storeNotes(page, 'https://example.test/1.4.0');
  assert.equal(
    text,
    'PlayPets 1.4.0 brings rain.\n\n• Rain falls.\n• The Windows tray icon is sharper.\n\nhttps://example.test/1.4.0',
  );
  assert.equal(left, 0);
  // A release with nothing new on Windows still has the opening sentence and the address.
  assert.deepEqual(storeNotes(page.replace('- Rain falls.\n', '').replace(/- <Only os="Windows" \/>.*\n/, ''), 'x'), {
    text: 'PlayPets 1.4.0 brings rain.\n\nx',
    left: 0,
  });
  assert.throws(() => storeNotes(page.replace('os="Linux"', 'os="Amiga"'), 'x'), /Only os="Amiga"/);
});

test("every published release page fits the Store as What's new", () => {
  const versions = readdirSync('website/releases')
    .map(file => file.replace(/\.md$/, ''))
    .filter(version => /^[1-9]\d*\.\d+\.\d+$/.test(version));
  assert.ok(versions.includes('1.2.0'));
  for (const version of versions) {
    const { notes, left } = storeNotesFor(version);
    for (const text of Object.values(notes)) assert.ok(text.length <= 1500, version);
    // The four pages are one text in four languages, so each lists the same changes for the Store
    // (a long language may leave its last ones to the page's address).
    const counts = Object.entries(notes).map(
      ([locale, text]) => text.split('\n').filter(line => line.startsWith('• ')).length + left[locale],
    );
    assert.equal(new Set(counts).size, 1, `${version}: ${counts}`);
  }
});

test('a published release builds and submits its own tag, with Store credentials only in the submit job', () => {
  const workflow = readFileSync('.github/workflows/store.yml', 'utf8');
  assert.match(workflow, /^on:\n {2}release:\n {4}types: \[published\]\n {2}workflow_dispatch:\n\n/m);
  assert.match(workflow, /!github\.event\.release\.prerelease/);
  // The workflow's own commit is the tag's, so no job checks out another ref.
  assert.match(workflow, /test "\$\(git rev-parse "\$GITHUB_REF\^\{commit\}"\)" = "\$GITHUB_SHA"/);
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/);
  assert.doesNotMatch(workflow, /^\s+ref:/m);
  assert.match(workflow, /pnpm exec tauri build --target \$\{\{ matrix\.target \}\} --no-bundle/);
  assert.match(workflow, /architecture: x64/);
  assert.match(workflow, /architecture: arm64/);
  const jobs = workflow.split(/\n(?= {2}[a-z]+:\n)/);
  const submit = jobs.find(job => job.startsWith('  submit:'));
  assert.match(submit, /if: vars\.STORE_SUBMISSION_ENABLED == 'true'/);
  assert.match(submit, /environment: microsoft-store/);
  assert.doesNotMatch(submit, /p?npm (ci|install)|cache:|rust-cache|action-setup/);
  for (const job of jobs.filter(job => job !== submit)) assert.doesNotMatch(job, /secrets\.|environment:/);
  // None of the four values skips the submission; some of them fails it, like the APPLE_* secrets.
  assert.match(submit, /if \[ "\$present" -eq 0 \]; then[\s\S]*exit 0/);
  assert.match(submit, /if \[ "\$present" -lt "\$\{#fields\[@\]\}" \]; then[\s\S]*exit 1/);
});

test("a retry sends the tag's own packages with main's script, and builds nothing", () => {
  const workflow = readFileSync('.github/workflows/store-retry.yml', 'utf8');
  assert.match(workflow, /^on:\n {2}workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow, /^ {2}(push|pull_request|release)/m);
  assert.match(workflow, /group: microsoft-store/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment: microsoft-store/);
  assert.match(workflow, /name: store-bundle\n\s+path: release\/store\n\s+run-id: \$\{\{ inputs\.run \}\}/);
  assert.doesNotMatch(workflow, /p?npm (ci|install)|cache:|rust-cache|action-setup|^\s+ref:/m);
  const check = workflow.indexOf('sourceSha');
  const hashes = workflow.indexOf('sha256');
  const submit = workflow.indexOf('node scripts/store-submit.mjs release/store');
  const secret = workflow.indexOf('secrets.STORE_CLIENT_SECRET');
  assert.ok(check > 0 && hashes > 0 && check < submit && hashes < submit && check < secret);
  assert.match(workflow, /STORE_RELEASE_TAG: \$\{\{ inputs\.tag \}\}/);
});

test('a stopped submission names its own reason and nothing else', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'playpets-store-'));
  try {
    writeFileSync(join(dir, 'release.json'), JSON.stringify({ version: '1.3.0', files: release.files }));
    let output = '';
    try {
      execFileSync(process.execPath, ['scripts/store-submit.mjs', dir], {
        env: { PATH: process.env.PATH, GITHUB_REF: 'refs/heads/main', STORE_CLIENT_SECRET: 'test-only-client-key' },
        stdio: 'pipe',
      });
    } catch (error) {
      output = String(error.stderr);
    }
    assert.match(output, /^Store submission is disabled or not running for this release tag\n/);
    assert.match(output, /No automatic retry was performed/);
    assert.doesNotMatch(output, /test-only-client-key/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Partner Center names a listing after the package's language: zh-Hans in the manifest is zh-hans.
test("Store submission writes each What's new into the listing named for that language", async () => {
  const client = clientFor(app, 'Manual', '1.2.0.0', ['en-us', 'ko-kr', 'ja-jp', 'zh-hans']);
  await submitStore(client, release);
  const update = client.calls.find(call => call.method === 'PUT').body;
  assert.deepEqual(Object.keys(update.listings), ['en-us', 'ko-kr', 'ja-jp', 'zh-hans']);
  assert.equal(update.listings['zh-hans'].baseListing.releaseNotes, notes['zh-cn']);
  const upper = clientFor(app, 'Manual', '1.2.0.0', ['en-US', 'ko-KR', 'ja-JP', 'zh-Hans']);
  await submitStore(upper, release);
  assert.deepEqual(Object.keys(upper.calls.find(call => call.method === 'PUT').body.listings), [
    'en-US',
    'ko-KR',
    'ja-JP',
    'zh-Hans',
  ]);
});

test('Store submission stops before making a draft when the published listing lacks a language', async () => {
  const client = clientFor(app, 'Manual', '1.2.0.0', ['en-us', 'ko-kr', 'ja-jp', 'fr-fr']);
  await assert.rejects(
    submitStore(client, release),
    /no Simplified Chinese listing \(it has en-us, ko-kr, ja-jp, fr-fr\); no changes made/,
  );
  assert.deepEqual(
    client.calls.map(call => call.method),
    ['GET', 'GET'],
  );
  const odd = clientFor(app, 'Manual', '1.2.0.0', ['en-us', 'ko-kr', 'ja-jp', '<b>zh</b>']);
  await assert.rejects(submitStore(odd, release), /\(it has en-us, ko-kr, ja-jp, \?\)/);
});
