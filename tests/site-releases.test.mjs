import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedReleases } from '../scripts/site-releases.mjs';

const asset = name => ({ name });
const answer = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test('the site is built with the published releases, every page of them, and no drafts', async () => {
  const asked = [];
  const pageOne = Array.from({ length: 100 }, (_, i) => ({ tag_name: `v0.0.${i}`, assets: [] }));
  const fetcher = async (url, { headers }) => {
    asked.push([url.replace('https://api.github.com/repos/test/app/', ''), headers.Authorization]);
    if (url.endsWith('page=1')) return answer(pageOne);
    if (url.endsWith('page=2'))
      return answer([
        { tag_name: 'v1.4.0', draft: true, assets: [asset('PlayPets_1.4.0_macos-universal.dmg')] },
        {
          tag_name: 'v1.3.0',
          published_at: '2026-10-20T00:00:00Z',
          assets: [asset('PlayPets_1.3.0_macos-universal.dmg')],
        },
        { tag_name: 'nightly', assets: [] },
      ]);
    return answer({
      tag_name: 'v1.3.0',
      published_at: '2026-10-20T00:00:00Z',
      assets: [asset('PlayPets_1.3.0_macos-universal.dmg')],
    });
  };
  const built = await publishedReleases('test/app', { fetcher, token: 'secret' });
  assert.deepEqual(
    asked.map(([path]) => path),
    ['releases?per_page=100&page=1', 'releases?per_page=100&page=2', 'releases/latest'],
  );
  assert.ok(asked.every(([, auth]) => auth === 'Bearer secret'));
  assert.equal(built.latest.version, '1.3.0');
  assert.deepEqual(built.latest.files, ['PlayPets_1.3.0_macos-universal.dmg']);
  assert.equal(built.tagged['1.4.0'], undefined, 'a draft has no links yet');
  assert.equal(built.tagged['1.3.0'].publishedAt, '2026-10-20T00:00:00Z');
  assert.equal(Object.keys(built.tagged).length, 101);
});

test('no release yet is an answer, and an unreachable GitHub leaves the lookup to the browser', async () => {
  const none = await publishedReleases('test/new', {
    fetcher: async url => (url.endsWith('latest') ? answer({}, 404) : answer([])),
  });
  assert.deepEqual(none, { latest: null, tagged: {} });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await publishedReleases('test/limited', { fetcher: async () => answer({}, 403) }), null);
    assert.equal(
      await publishedReleases('test/offline', {
        fetcher: async () => {
          throw new Error('offline');
        },
      }),
      null,
    );
  } finally {
    console.warn = warn;
  }
});
