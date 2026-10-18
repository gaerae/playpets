import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyStore } from '../scripts/store-api.mjs';

const env = {
  STORE_APP_ID: '9NSKXQ6R187M',
  STORE_TENANT_ID: '495accae-b756-49d9-b640-946e3dc9c192',
  STORE_CLIENT_ID: 'a0325d8c-4834-4b93-b26e-5034aaa06b91',
  STORE_CLIENT_SECRET: 'test-only-client-key',
};
const app = {
  id: '9NSKXQ6R187M',
  primaryName: 'PlayPets',
  packageIdentityName: 'gaerae.PlayPets',
  publisherName: 'CN=85817E6E-C9F8-44E1-B251-9010546EC6B8',
  pendingApplicationSubmission: { id: '1152921505702162755' },
};

test('Store verification uses client credentials and reads only the matching product and its hold', async () => {
  const calls = [];
  const report = await verifyStore(env, async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return Response.json({ access_token: 'test-access-token' });
    if (calls.length === 2) return Response.json(app);
    return Response.json({
      id: '1152921505702162755',
      targetPublishMode: 'Manual',
      status: 'PendingCommit',
      fileUploadUrl: 'private-upload-url',
    });
  });
  assert.equal(calls[0].url, 'https://login.microsoftonline.com/495accae-b756-49d9-b640-946e3dc9c192/oauth2/token');
  const body = new URLSearchParams(calls[0].options.body);
  assert.equal(body.get('client_secret'), 'test-only-client-key');
  assert.equal(body.get('client_id'), 'a0325d8c-4834-4b93-b26e-5034aaa06b91');
  assert.equal(body.get('resource'), 'https://manage.devcenter.microsoft.com');
  assert.deepEqual(
    calls.slice(1).map(call => [call.url, call.options.method]),
    [
      ['https://manage.devcenter.microsoft.com/v1.0/my/applications/9NSKXQ6R187M', 'GET'],
      [
        'https://manage.devcenter.microsoft.com/v1.0/my/applications/9NSKXQ6R187M/submissions/1152921505702162755',
        'GET',
      ],
    ],
  );
  assert.ok(calls.every(call => call.options.redirect === 'error'));
  assert.equal(report.authenticated, true);
  assert.equal(report.pendingPublishMode, 'Manual');
  assert.equal(report.hasPublishedSubmission, false);
  assert.doesNotMatch(JSON.stringify(report), /test-access-token|test-only-client-key|private-upload-url/);
});

test('Store verification rejects missing keys before contacting Microsoft', async () => {
  await assert.rejects(
    verifyStore({ ...env, STORE_CLIENT_SECRET: '' }, () => assert.fail('No request allowed')),
    /STORE_CLIENT_SECRET/,
  );
});

test('Store verification does not print provider error bodies or secret-bearing exceptions', async () => {
  await assert.rejects(
    verifyStore(env, async () => Response.json({ error_description: env.STORE_CLIENT_SECRET }, { status: 401 })),
    /^Error: Microsoft identity request failed \(HTTP 401\)$/,
  );
  await assert.rejects(
    verifyStore(env, async () => {
      throw new Error(env.STORE_CLIENT_SECRET);
    }),
    /^Error: Microsoft identity request failed \(network or timeout\)$/,
  );
});

test('Store verification rejects a valid token for the wrong Store product', async () => {
  let count = 0;
  await assert.rejects(
    verifyStore(env, async () =>
      Response.json(++count === 1 ? { access_token: 'token' } : { ...app, packageIdentityName: 'Other.Product' }),
    ),
    /Store product identity does not match PlayPets/,
  );
});

test('Store verification refuses to call an unexpected pending submission address', async () => {
  let count = 0;
  await assert.rejects(
    verifyStore(env, async () =>
      Response.json(
        ++count === 1 ? { access_token: 'token' } : { ...app, pendingApplicationSubmission: { id: '../outside' } },
      ),
    ),
    /Invalid pending submission ID/,
  );
  assert.equal(count, 2);
});
