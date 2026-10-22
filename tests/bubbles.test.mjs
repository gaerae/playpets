import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom } from './support/dom.mjs';

const { setData, views } = await import('../src/core/state.js');
const { bubble } = await import('../src/yard/views.js');

function friend(name, rect) {
  const b = element('div', { className: 'yard-bubble' });
  b.hidden = true;
  b.getBoundingClientRect = () => rect;
  return { pet: { id: name.toLowerCase(), name }, bubble: b };
}

test('a bubble that would cover another rises above it, stays its reading time and is read aloud', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  const daisy = friend('Daisy', { left: 100, right: 220, top: 400, bottom: 440 });
  const pip = friend('Pip', { left: 160, right: 280, top: 410, bottom: 450 });
  views.clear();
  views.set('daisy', daisy);
  views.set('pip', pip);
  setData({ pets: [daisy.pet, pip.pet], assets: [] });
  t.after(() => views.clear());
  bubble(daisy, 'Look, a ladybug!');
  bubble(pip, 'Where?');
  assert.equal(pip.bubble.style['--bubble-lift'], '54px', 'Pip rises clear of Daisy, with a small gap');
  assert.equal(daisy.bubble.style['--bubble-lift'], undefined, 'the first one stays');
  assert.equal(document.getElementById('friend-speech').textContent, 'Pip: Where?');
  t.mock.timers.tick(2999);
  assert.equal(pip.bubble.hidden, false, 'a short line still stays three seconds');
  t.mock.timers.tick(1);
  assert.equal(pip.bubble.hidden, true);
});
