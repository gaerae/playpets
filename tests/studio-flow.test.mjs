import assert from 'node:assert/strict';
import test from 'node:test';
import { studioPanelForHash } from '../website/.vitepress/theme/studio-flow.mjs';

test('existing studio deep links open the matching tool rather than a hidden panel', () => {
  assert.equal(studioPanelForHash('#pet-package-title', 'pet'), 'package');
  assert.equal(studioPanelForHash('#custom-prompts', 'pet'), 'custom');
  assert.equal(studioPanelForHash('#official-kit', 'pet'), 'sample');
  assert.equal(studioPanelForHash('#studio-images', 'background'), 'images');
  assert.equal(studioPanelForHash('#studio-export', 'background'), 'export');
  assert.equal(studioPanelForHash('#unrelated', 'background'), 'layout');
  assert.equal(studioPanelForHash('', 'pet'), 'sample');
});

test('pet IDs are automatic, portable and distinct from the starter identity', async () => {
  const { petIdFromName } = await import('../website/.vitepress/theme/studio-flow.mjs');
  assert.equal(petIdFromName('My Friend', 'abcd1234'), 'my-friend-abcd1234');
  assert.equal(petIdFromName('클로버', 'abcd1234'), 'pet-abcd1234');
  assert.notEqual(petIdFromName('Clover', 'abcd1234'), 'playpets-clover');
  assert.match(petIdFromName('A'.repeat(100), 'abcd1234'), /^[a-z0-9][a-z0-9_-]{0,63}$/);
});

test('studio tabs retain the router entry state and existing query when changing anchors', async () => {
  const { replaceStudioHash } = await import('../website/.vitepress/theme/studio-flow.mjs');
  const state = { scrollPosition: [0, 200] };
  let entry;
  const history = {
    state,
    replaceState: (...args) => {
      entry = args;
    },
  };
  replaceStudioHash('#pet-package-title', {
    history,
    location: { pathname: '/ko/guide/creator-kit', search: '?kit=clover' },
  });
  assert.equal(entry[0], state);
  assert.equal(entry[2], '/ko/guide/creator-kit?kit=clover#pet-package-title');
});
