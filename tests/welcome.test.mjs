import assert from 'node:assert/strict';
import test from 'node:test';
import * as welcome from '../src/yard/welcome.js';

test('companionship setup finishes without requiring a coding agent', () => {
  assert.equal(welcome.onboardingSteps([], {}, false).hidden, false);
  assert.equal(welcome.onboardingSteps([{ providerId: '' }], {}, false).hidden, false);
  assert.equal(welcome.onboardingSteps([{ providerId: 'local' }], {}, false).hidden, true);
  assert.equal(welcome.onboardingSteps([{ providerId: '' }], {}, true).hidden, true);
  assert.equal(welcome.onboardingSteps([], {}, true).hidden, false);
});
