import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyStore } from './store-api.mjs';

export async function submitStore(client, release) {
  const { version, files, notes } = release;
  if (
    !/^[1-9]\d*\.\d+\.\d+$/.test(version) ||
    !Array.isArray(files) ||
    files.length !== 2 ||
    !['x64', 'arm64'].every(arch => files.includes(`PlayPets_${version}_${arch}.msix`))
  )
    throw new Error('Invalid Store package files');
  const locales = ['en-us', 'ko-kr', 'ja-jp', 'zh-cn'];
  if (
    !locales.every(
      locale => typeof notes?.[locale] === 'string' && notes[locale].trim() && notes[locale].length <= 1500,
    )
  )
    throw new Error('Provide release notes for all four Store languages');
  const app = await client.request('GET', '');
  if (
    app.id !== '9NSKXQ6R187M' ||
    app.packageIdentityName !== 'gaerae.PlayPets' ||
    app.publisherName !== 'CN=85817E6E-C9F8-44E1-B251-9010546EC6B8'
  )
    throw new Error('Store product identity does not match PlayPets');
  if (!app.lastPublishedApplicationSubmission?.id)
    throw new Error('Complete the first Store registration and establish a published baseline before API submissions');
  if (app.pendingApplicationSubmission?.id)
    throw new Error('An existing pending submission needs maintainer review; no changes made');
  const draft = await client.request('POST', '/submissions');
  if (!/^\d+$/.test(draft.id)) throw new Error('Invalid created submission ID; inspect Partner Center');
  const path = `/submissions/${draft.id}`;
  let destination;
  try {
    destination = new URL(draft.fileUploadUrl);
  } catch {
    throw new Error('Invalid Store upload destination');
  }
  if (
    destination.protocol !== 'https:' ||
    !destination.hostname.endsWith('.blob.core.windows.net') ||
    destination.port ||
    destination.username ||
    destination.password
  )
    throw new Error('Invalid Store upload destination');
  const update = structuredClone(draft);
  delete update.pricing;
  delete update.fileUploadUrl;
  delete update.status;
  delete update.statusDetails;
  update.targetPublishMode = 'Manual';
  delete update.targetPublishDate;
  update.applicationPackages = [
    ...(draft.applicationPackages || []).map(item => ({ ...item, fileStatus: 'PendingDelete' })),
    // The submission API requires these legacy minimum fields even for modern MSIX targets.
    ...files.map(fileName => ({
      fileName,
      fileStatus: 'PendingUpload',
      minimumDirectXVersion: 'None',
      minimumSystemRam: 'None',
    })),
  ];
  // Do not send Pricing V2 back through the legacy API or rewrite approved store descriptions.
  for (const locale of locales) {
    if (!update.listings?.[locale]?.baseListing)
      throw new Error('Published listing is missing a supported Store language; inspect the created draft');
    update.listings[locale].baseListing.releaseNotes = notes[locale].trim();
  }
  update.notesForCertification = `PlayPets ${version}. Store installations receive updates through Microsoft Store, not the GitHub updater. Hold for manual publication.`;
  await client.request('PUT', path, update);
  await client.upload(destination.href);
  const saved = await client.request('GET', path);
  if (saved.targetPublishMode !== 'Manual') throw new Error('Manual publication hold was not retained; not committed');
  await client.request('POST', `${path}/commit`);
  const status = await client.request('GET', `${path}/status`);
  if (
    ['CommitFailed', 'PreProcessingFailed', 'CertificationFailed', 'PublishFailed', 'ReleaseFailed'].includes(
      status.status,
    )
  )
    throw new Error('Store processing failed; inspect Partner Center without retrying submission');
  return { submissionId: draft.id, publishMode: 'Manual', certificationRequested: true, publicationRequested: false };
}

async function run(env) {
  if (
    env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_REF !== 'refs/heads/main' ||
    env.STORE_SUBMISSION_ENABLED !== 'true' ||
    env.STORE_CONFIRMATION !== 'SUBMIT_FOR_CERTIFICATION'
  )
    throw new Error('Store submission is disabled or not explicitly approved on main');
  await verifyStore(env);
  const dir = resolve(process.argv[2] || 'release/store');
  const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'));
  release.notes = JSON.parse(env.STORE_RELEASE_NOTES || '{}');
  // Build the upload before requesting any Store mutation; filenames are validated by submitStore.
  const expected = ['x64', 'arm64'].map(arch => `PlayPets_${release.version}_${arch}.msix`);
  if (!/^[1-9]\d*\.\d+\.\d+$/.test(release.version) || JSON.stringify(release.files) !== JSON.stringify(expected))
    throw new Error('Invalid Store package files');
  const archive = join(dir, 'submission.zip');
  rmSync(archive, { force: true });
  execFileSync('zip', ['-j', '-q', archive, ...expected.map(file => join(dir, file))], { stdio: 'ignore' });
  const send = async (url, options) => {
    let response;
    try {
      response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(180_000) });
    } catch {
      throw new Error('Store request failed (network or timeout); inspect the draft before retrying');
    }
    if (!response.ok)
      throw new Error(`Store request failed (HTTP ${response.status}); inspect the draft before retrying`);
    return response;
  };
  const tokenResponse = await send(`https://login.microsoftonline.com/${env.STORE_TENANT_ID}/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.STORE_CLIENT_ID,
      client_secret: env.STORE_CLIENT_SECRET,
      resource: 'https://manage.devcenter.microsoft.com',
    }),
  });
  const token = (await tokenResponse.json()).access_token;
  if (typeof token !== 'string' || !token) throw new Error('Microsoft identity returned no access token');
  const report = await submitStore(
    {
      request: async (method, path, body) => {
        const response = await send(
          `https://manage.devcenter.microsoft.com/v1.0/my/applications/${env.STORE_APP_ID}${path}`,
          {
            method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          },
        );
        if (response.status === 204 || path.endsWith('/commit')) return {};
        try {
          return await response.json();
        } catch {
          throw new Error('Store returned invalid JSON; inspect the draft before retrying');
        }
      },
      upload: async url => {
        await send(url, {
          method: 'PUT',
          headers: { 'x-ms-blob-type': 'BlockBlob', 'x-ms-version': '2021-12-02' },
          body: readFileSync(archive),
        });
      },
    },
    release,
  );
  const summary = `## Store certification request\n\n${JSON.stringify(report)}\n\nCheck certification progress in Partner Center. Publishing remains a separate manual action.\n`;
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.env).catch(() => {
    // Never print arbitrary SDK/parser/process errors in a credentialed job.
    console.error(
      'Store submission stopped. Inspect the approved inputs, package report and Partner Center draft. No automatic retry or publication was performed.',
    );
    process.exitCode = 1;
  });
}
