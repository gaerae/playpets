import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyStore } from './store-api.mjs';

const PUBLISH_MODES = ['Manual', 'Immediate'];
// The script's own messages and storeFailure hold no address or key, so the log may show them;
// anything else is hidden.
const stop = message => Object.assign(new Error(message), { safe: true });
// About ten minutes, 30 seconds apart, inside the submit job's 15.
const COMMIT_CHECKS = 20;
// Why the Store refused a request: a 400 names no field, only this body does. Upload addresses and
// other long values are signed, so they never reach the log.
const clean = text =>
  String(text)
    .replace(/https?:\/\/\S+/g, '[address]')
    .replace(/[\w+/=%.-]{32,}/g, '[value]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
export function storeFailure(status, body) {
  const reason = clean(body);
  return `Store request failed (HTTP ${status})${reason ? `: ${reason}` : ''}`;
}
// store-retry.yml sends a release from main, with the tag's packages and main's script.
export const forThisRelease = (env, version) =>
  env.GITHUB_REF === `refs/tags/v${version}` ||
  (env.GITHUB_REF === 'refs/heads/main' && env.STORE_RELEASE_TAG === `v${version}`);
const packageVersion = text => (/^\d+(\.\d+){3}$/.test(text || '') ? text.split('.').map(Number) : null);
const notOlder = (a, b) => {
  const i = a.findIndex((part, at) => part !== b[at]);
  return i < 0 || a[i] > b[i];
};

// The release notes' languages, and the listing names Partner Center may use for each.
const LISTING_NAMES = {
  'en-us': ['en-us', 'en'],
  'ko-kr': ['ko-kr', 'ko'],
  'ja-jp': ['ja-jp', 'ja'],
  'zh-cn': ['zh-cn', 'zh-hans', 'zh-hans-cn'],
};
const LANGUAGE_NAMES = {
  'en-us': 'English',
  'ko-kr': 'Korean',
  'ja-jp': 'Japanese',
  'zh-cn': 'Simplified Chinese',
};

export async function submitStore(client, release) {
  const { version, files, notes, publishMode } = release;
  if (
    !/^[1-9]\d*\.\d+\.\d+$/.test(version) ||
    !Array.isArray(files) ||
    files.length !== 2 ||
    !['x64', 'arm64'].every(arch => files.includes(`PlayPets_${version}_${arch}.msix`))
  )
    throw stop('Invalid Store package files');
  const locales = ['en-us', 'ko-kr', 'ja-jp', 'zh-cn'];
  if (
    !locales.every(
      locale => typeof notes?.[locale] === 'string' && notes[locale].trim() && notes[locale].length <= 1500,
    )
  )
    throw stop('Provide release notes for all four Store languages');
  if (!PUBLISH_MODES.includes(publishMode)) throw stop('Store publish mode must be Manual or Immediate');
  const app = await client.request('GET', '');
  if (
    app.id !== '9NSKXQ6R187M' ||
    app.packageIdentityName !== 'gaerae.PlayPets' ||
    app.publisherName !== 'CN=85817E6E-C9F8-44E1-B251-9010546EC6B8'
  )
    throw stop('Store product identity does not match PlayPets');
  if (!app.lastPublishedApplicationSubmission?.id)
    throw stop('Complete the first Store registration and establish a published baseline before API submissions');
  if (app.pendingApplicationSubmission?.id)
    throw stop('An existing pending submission needs maintainer review; no changes made');
  // A second run for a version the Store already has (a rerun, or a manual upload) changes nothing.
  const published = app.lastPublishedApplicationSubmission.id;
  if (!/^\d+$/.test(published)) throw stop('Invalid published submission ID');
  const baseline = await client.request('GET', `/submissions/${published}`);
  const next = packageVersion(`${version}.0`);
  if (
    (baseline.applicationPackages || []).some(
      item => packageVersion(item.version) && notOlder(packageVersion(item.version), next),
    )
  )
    throw stop('The Store already has this version or a later one; no changes made');
  // A listing is named after the package's language, so zh-Hans in the manifest is zh-hans there.
  // Check the published one before making a draft: the draft copies its listings.
  const listingKeys = Object.keys(baseline.listings || {}).filter(key => baseline.listings[key]?.baseListing);
  const listingFor = {};
  for (const locale of locales) {
    listingFor[locale] = listingKeys.find(key => LISTING_NAMES[locale].includes(key.toLowerCase()));
    if (!listingFor[locale]) {
      const seen = listingKeys.map(key => (/^[a-z]{2,3}(-[a-z0-9]{2,8}){0,3}$/i.test(key) ? key : '?')).join(', ');
      throw stop(
        `The published Store submission has no ${LANGUAGE_NAMES[locale]} listing (it has ${seen}); no changes made`,
      );
    }
  }
  const draft = await client.request('POST', '/submissions');
  if (!/^\d+$/.test(draft.id)) throw stop('Invalid created submission ID; inspect Partner Center');
  const path = `/submissions/${draft.id}`;
  // The next run stops at any pending submission, so this one takes back the draft it made.
  const takeBack = () =>
    client.request('DELETE', path).then(
      () => 'The new draft was removed.',
      () => 'The new draft is still in Partner Center; delete it before retrying.',
    );
  try {
    await fillDraft(client, draft, path, { files, notes, publishMode, locales, listingFor });
  } catch (error) {
    const left = await takeBack();
    throw stop(error.safe ? `${error.message}. ${left}` : left);
  }
  await client.request('POST', `${path}/commit`);
  const status = await afterCommit(client, path);
  if (status.status === 'CommitFailed') throw stop(`${failure(status)}. ${await takeBack()}`);
  if (['PreProcessingFailed', 'CertificationFailed', 'PublishFailed', 'ReleaseFailed'].includes(status.status))
    throw stop(`${failure(status)}. Inspect Partner Center without retrying submission`);
  return {
    submissionId: draft.id,
    version,
    publishMode,
    certificationRequested: true,
    storeStatus: status.status,
    publishesAfterCertification: publishMode === 'Immediate',
  };
}

// A commit returns at once; the Store reads the packages and listings after that, and a refusal
// shows only in the status.
async function afterCommit(client, path) {
  for (let check = 1; ; check++) {
    const status = await client.request('GET', `${path}/status`);
    if (status.status !== 'CommitStarted' || check === COMMIT_CHECKS) return status;
    await client.wait();
  }
}

function failure({ status, statusDetails }) {
  const errors = (statusDetails?.errors || []).map(({ code, details }) => `${code}: ${details}`);
  return `Store processing failed (${status})${errors.length ? `: ${clean(errors.join('; '))}` : ''}`;
}

async function fillDraft(client, draft, path, { files, notes, publishMode, locales, listingFor }) {
  let destination;
  try {
    destination = new URL(draft.fileUploadUrl);
  } catch {
    throw stop('Invalid Store upload destination');
  }
  if (
    destination.protocol !== 'https:' ||
    !destination.hostname.endsWith('.blob.core.windows.net') ||
    destination.port ||
    destination.username ||
    destination.password
  )
    throw stop('Invalid Store upload destination');
  // Everything else goes back as the Store copied it: it refuses an update without pricing, and
  // leaving the copy alone is what keeps the price.
  const update = structuredClone(draft);
  delete update.fileUploadUrl;
  delete update.status;
  delete update.statusDetails;
  update.targetPublishMode = publishMode;
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
  // Only What's new changes: approved store descriptions stay.
  for (const locale of locales) {
    if (!update.listings?.[listingFor[locale]]?.baseListing)
      throw stop('Published listing is missing a supported Store language; inspect the created draft');
    update.listings[listingFor[locale]].baseListing.releaseNotes = notes[locale].trim();
  }
  // notesForCertification stays as the published submission had it: it carries the runFullTrust
  // justification and the reviewer's test steps.
  await client.request('PUT', path, update);
  await client.upload(destination.href);
  const saved = await client.request('GET', path);
  if (saved.targetPublishMode !== publishMode) throw stop(`${publishMode} publication was not retained; not committed`);
}

async function run(env) {
  const dir = resolve(process.argv[2] || 'release/store');
  const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'));
  if (env.GITHUB_ACTIONS !== 'true' || !forThisRelease(env, release.version) || env.STORE_SUBMISSION_ENABLED !== 'true')
    throw stop('Store submission is disabled or not running for this release tag');
  await verifyStore(env).catch(error => {
    throw stop(error.message);
  });
  release.notes = JSON.parse(readFileSync(join(dir, 'notes.json'), 'utf8'));
  release.publishMode = env.STORE_PUBLISH_MODE || 'Manual';
  // Build the upload before requesting any Store mutation; filenames are validated by submitStore.
  const expected = ['x64', 'arm64'].map(arch => `PlayPets_${release.version}_${arch}.msix`);
  if (!/^[1-9]\d*\.\d+\.\d+$/.test(release.version) || JSON.stringify(release.files) !== JSON.stringify(expected))
    throw stop('Invalid Store package files');
  const archive = join(dir, 'submission.zip');
  rmSync(archive, { force: true });
  execFileSync('zip', ['-j', '-q', archive, ...expected.map(file => join(dir, file))], { stdio: 'ignore' });
  // Only the Store's own answers are read: the identity service and the upload address are not ours to log.
  const send = async (url, options, explain = false) => {
    let response;
    try {
      response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(180_000) });
    } catch {
      throw stop('Store request failed (network or timeout)');
    }
    if (!response.ok) throw stop(storeFailure(response.status, explain ? await response.text().catch(() => '') : ''));
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
  if (typeof token !== 'string' || !token) throw stop('Microsoft identity returned no access token');
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
          true,
        );
        if (response.status === 204 || path.endsWith('/commit')) return {};
        try {
          return await response.json();
        } catch {
          throw stop('Store returned invalid JSON; inspect the draft before retrying');
        }
      },
      upload: async url => {
        await send(url, {
          method: 'PUT',
          headers: { 'x-ms-blob-type': 'BlockBlob', 'x-ms-version': '2021-12-02' },
          body: readFileSync(archive),
        });
      },
      wait: () => new Promise(done => setTimeout(done, 30_000)),
    },
    release,
  );
  const after =
    report.publishMode === 'Immediate'
      ? 'The Store publishes it when certification passes.'
      : 'Press Publish now in Partner Center after certification passes.';
  const summary = `## Store certification request\n\n${JSON.stringify(report)}\n\nCheck certification progress in Partner Center. ${after}\n`;
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.env).catch(error => {
    // Never print arbitrary SDK/parser/process errors in a credentialed job.
    if (error.safe) console.error(error.message);
    console.error(
      'Store submission stopped. Inspect the store-bundle artifact and any Partner Center draft. No automatic retry was performed.',
    );
    process.exitCode = 1;
  });
}
