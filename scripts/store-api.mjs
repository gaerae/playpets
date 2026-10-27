import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

async function request(fetcher, label, url, options) {
  let response;
  try {
    response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error(`${label} request failed (network or timeout)`);
  }
  // Provider bodies and fetch errors can contain credentials, tokens or SAS URLs.
  if (!response.ok) throw new Error(`${label} request failed (HTTP ${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

// The submission states Microsoft documents; anything else is reported as unknown, not echoed.
const STATUSES = [
  'None',
  'Canceled',
  'PendingCommit',
  'CommitStarted',
  'CommitFailed',
  'PendingPublication',
  'Publishing',
  'Published',
  'PublishFailed',
  'PreProcessing',
  'PreProcessingFailed',
  'Certification',
  'CertificationFailed',
  'Release',
  'ReleaseFailed',
];
// Only the codes, which are plain words: the details beside them are provider text.
const codes = list =>
  Array.isArray(list)
    ? list.map(item => item?.code).filter(code => typeof code === 'string' && /^\w{1,80}$/.test(code))
    : [];

export async function verifyStore(env, fetcher = fetch) {
  for (const key of ['STORE_APP_ID', 'STORE_TENANT_ID', 'STORE_CLIENT_ID', 'STORE_CLIENT_SECRET']) {
    if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
  }
  const guid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  if (!guid.test(env.STORE_TENANT_ID) || !guid.test(env.STORE_CLIENT_ID)) throw new Error('Invalid Store identity IDs');
  if (!/^[A-Z\d]{12}$/.test(env.STORE_APP_ID)) throw new Error('Invalid Store app ID');
  const identity = await request(
    fetcher,
    'Microsoft identity',
    `https://login.microsoftonline.com/${env.STORE_TENANT_ID}/oauth2/token`,
    {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.STORE_CLIENT_ID,
        client_secret: env.STORE_CLIENT_SECRET,
        resource: 'https://manage.devcenter.microsoft.com',
      }),
    },
  );
  if (typeof identity.access_token !== 'string' || !identity.access_token)
    throw new Error('Microsoft identity returned no access token');
  const options = { method: 'GET', headers: { Authorization: `Bearer ${identity.access_token}` } };
  const url = `https://manage.devcenter.microsoft.com/v1.0/my/applications/${env.STORE_APP_ID}`;
  const app = await request(fetcher, 'Store app', url, options);
  if (
    app.id !== env.STORE_APP_ID ||
    app.packageIdentityName !== 'gaerae.PlayPets' ||
    app.publisherName !== 'CN=85817E6E-C9F8-44E1-B251-9010546EC6B8'
  ) {
    throw new Error('Store product identity does not match PlayPets');
  }
  const pending = app.pendingApplicationSubmission?.id;
  let submission;
  if (pending) {
    if (!/^\d+$/.test(pending)) throw new Error('Invalid pending submission ID');
    submission = await request(fetcher, 'Store submission', `${url}/submissions/${pending}`, options);
  }
  return {
    authenticated: true,
    appId: app.id,
    productIdentityVerified: true,
    hasPublishedSubmission: Boolean(app.lastPublishedApplicationSubmission?.id),
    hasPendingSubmission: Boolean(pending),
    pendingPublishMode: submission?.targetPublishMode === 'Manual' ? 'Manual' : submission ? 'not-manual' : 'none',
    pendingStatus: submission ? (STATUSES.includes(submission.status) ? submission.status : 'unknown') : 'none',
    pendingErrorCodes: codes(submission?.statusDetails?.errors),
    pendingWarningCodes: codes(submission?.statusDetails?.warnings),
    pendingCertificationReports: Array.isArray(submission?.statusDetails?.certificationReports)
      ? submission.statusDetails.certificationReports.length
      : 0,
    submissionEnabled: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await verifyStore(process.env);
    const summary = `## Store API verification\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\nOnly authentication and GET requests were made. No submission or publication was performed.\n`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
