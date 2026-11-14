import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom } from './support/dom.mjs';

const { setData, views } = await import('../src/core/state.js');
const { bubble } = await import('../src/yard/views.js');
const { measureYard } = await import('../src/yard/field.js');

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

test('a bubble near a side of the yard moves over to stay inside it, by the least it can', async () => {
  const { bubbleShift } = await import('../src/yard/views.js');
  // A 460-pixel yard, six pixels kept at each side.
  assert.equal(bubbleShift(230, 180, 460), 0, 'in the middle it stays centred over the friend');
  assert.equal(bubbleShift(420, 180, 460), -56, 'at the right it moves left: its right edge at 454');
  assert.equal(bubbleShift(30, 180, 460), 66, 'at the left it moves right: its left edge at 6');
  assert.equal(bubbleShift(400, 460, 460), -170, 'wider than the room: centred on the yard');
  assert.equal(bubbleShift(400, 0, 460), 0, 'not laid out: left as it is');
  assert.equal(bubbleShift(400, 180, 0), 0, 'a yard not measured: left as it is');
});

test('a bubble shown at the right edge of the mini window is moved inside it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = installDom(t, { ids: ['yard'], anyId: true });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 460, height: 320 });
  measureYard();
  const pip = friend('Pip', { left: 380, right: 560, top: 100, bottom: 140 });
  pip.bubble.offsetWidth = 180;
  Object.assign(pip, { px: 380, pet: { ...pip.pet, size: 80 } });
  views.clear();
  views.set('pip', pip);
  setData({ pets: [pip.pet], assets: [] });
  t.after(() => views.clear());
  bubble(pip, 'Shall we have a picnic under the blossoms?');
  // Centred over the friend at 380 + 40 (its size at the mini window's zoom), it would end past 460.
  assert.ok(Number.parseFloat(pip.bubble.style['--bubble-shift']) < 0, 'moved left');
  t.mock.timers.tick(10_000);
  assert.equal(pip.bubble.style['--bubble-shift'], undefined, 'hidden: nothing kept for the next line');
});

// In a 300 by 210 window three friends talking at once stacked their bubbles up past the window's
// top (at -40, -123 and -204), where nobody could read them.
test('a bubble with no room above the one it would cover takes its place instead of leaving the window', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  const daisy = friend('Daisy', { left: 100, right: 220, top: 20, bottom: 60 });
  const pip = friend('Pip', { left: 160, right: 280, top: 30, bottom: 70 });
  views.clear();
  views.set('daisy', daisy);
  views.set('pip', pip);
  setData({ pets: [daisy.pet, pip.pet], assets: [] });
  t.after(() => views.clear());
  bubble(daisy, 'Look, a ladybug!');
  bubble(pip, 'Where?');
  assert.equal(pip.bubble.style['--bubble-lift'], undefined, 'rising above Daisy would leave the window');
  assert.equal(daisy.bubble.hidden, true, "the newer line takes the place of Daisy's");
  t.mock.timers.tick(10_000);
  assert.equal(pip.bubble.hidden, true);
});

test('a lone bubble that would start above the window comes down inside it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true });
  const pip = friend('Pip', { left: 160, right: 280, top: -40, bottom: 0 });
  views.clear();
  views.set('pip', pip);
  setData({ pets: [pip.pet], assets: [] });
  t.after(() => views.clear());
  bubble(pip, 'Up here!');
  assert.equal(pip.bubble.style['--bubble-lift'], '-46px', 'its top six pixels inside the window');
  t.mock.timers.tick(10_000);
});
