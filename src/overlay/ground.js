// The grass along the floor of the screen friends first come out on (desktop/grass.rs): a strip
// whose two ends are mossy pebbles to drag. The backend says where it reaches (`desktopGround`, and
// `ground` with each layout), takes the pointer only once it has rested on an end, and keeps what
// a drag ends with. This page only draws it and reports the drag.

import { t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { remember } from '../core/state.js';
import { setupFlurry } from './flurry.js';

/** A drag still going is told to the backend this often, so it keeps the pointer (grass.rs DRAG_STALE). */
const TELL_MS = 400;
/** How long the hand shows an end being pulled (overlay.css .ground-demo: two pulls), and how many
 * times the grass coming brings it before it is left to be found. */
const DEMO_MS = 5400;
const DEMOS = 3;
// What this page remembers of the hand; none at all (storage refused) and it never comes, rather
// than every time. Not state.js recall, which reads a refusal as nothing stored yet.
function stored(key) {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

/**
 * Builds the strip on this window's page. `show(view)` draws the backend's view (null hides it),
 * `see(over)` thins it while the pointer is over the bare grass, `season(name)` dresses it, and
 * `fall(x)` lets the season's petals, leaves or flakes fall around a friend standing at `x`.
 */
export function setupGround({ api, displayId, reduced }) {
  const ground = document.createElement('div');
  ground.className = 'ground';
  ground.hidden = true;
  ground.innerHTML =
    '<div class="ground-turf"></div><div class="ground-grip" data-end="left"></div><div class="ground-grip" data-end="right"></div>';
  // First, so everything out on the floor stands in front of it.
  document.body.insertBefore(ground, document.body.firstChild);
  let view = null;
  let drag = null;
  const flurry = setupFlurry({ host: ground, reduced });
  const grips = [...ground.querySelectorAll('.ground-grip')];

  // The pebbles say nothing until the pointer rests on one, so when the grass comes a painted hand
  // pulls the right one in and back (the same hand the yard teaches with), the first few times only.
  let hand = null,
    demoTimer = 0;
  function demo() {
    const seen = stored('grass-demos');
    if (seen === undefined || stored('grass-pulled') === '1' || Number(seen) >= DEMOS) return;
    remember('grass-demos', String(Number(seen) + 1));
    hand = document.createElement('i');
    hand.className = 'ground-hand';
    hand.setAttribute('aria-hidden', 'true');
    grips[1]?.append(hand);
    ground.classList.add('ground-demo');
    demoTimer = setTimeout(endDemo, DEMO_MS);
  }
  function endDemo() {
    clearTimeout(demoTimer);
    hand?.remove();
    hand = null;
    ground.classList.remove('ground-demo');
  }

  // Ends in logical pixels on the whole desktop; the window starts at its area's left. A layout comes
  // with every step of a stroll, mostly with the grass where it was, so the same place is not
  // written again.
  let placed = '';
  function place(left, right) {
    const key = `${left} ${right} ${view.areaLeft} ${view.areaRight}`;
    if (key === placed) return;
    placed = key;
    ground.style.left = `${left - view.areaLeft}px`;
    ground.style.width = `${right - left}px`;
    // Across the whole floor an end runs off the screen with no fade.
    ground.classList.toggle('ground-edge-left', left <= view.areaLeft + 1);
    ground.classList.toggle('ground-edge-right', right >= view.areaRight - 1);
  }

  function show(next) {
    view = next && next.displayId === displayId ? next : null;
    if (!view) {
      drag = null;
      endDemo();
      ground.classList.remove('ground-resizing', 'ground-see');
      ground.hidden = true;
      return;
    }
    if (ground.hidden) {
      ground.hidden = false;
      // It grows up from the floor when it first comes, unless motion is turned down.
      ground.classList.toggle('ground-rise', !reduced.matches);
      demo();
    }
    size();
    // What the person is pulling stays where the pointer is until it is let go.
    if (!drag) place(view.left, view.right);
  }

  // The strip's height and its grips' width, as the backend takes the pointer there (grass.rs view);
  // overlay.css keeps the same sizes for a view without them.
  let sized = '';
  function size() {
    const key = `${view.height} ${view.gripWidth}`;
    if (key === sized) return;
    sized = key;
    for (const [name, px] of [
      ['--ground-height', view.height],
      ['--grip-width', view.gripWidth],
    ])
      if (Number.isFinite(px)) ground.style.setProperty(name, `${px}px`);
  }

  function end(grip, event) {
    if (!drag) return;
    const { left, right } = drag;
    drag = null;
    ground.classList.remove('ground-resizing');
    if (event?.pointerId !== undefined && grip.hasPointerCapture?.(event.pointerId))
      grip.releasePointerCapture(event.pointerId);
    if (view) view = { ...view, left, right };
    api.setGrass(left, right, false);
  }

  for (const grip of grips) {
    grip.title = t('desktop.grass_drag');
    // Put away, or spread across the floor again, from the desktop itself (menu.rs grass_choices).
    grip.oncontextmenu = event => {
      event.preventDefault();
      api.grassMenu();
    };
    grip.onpointerdown = event => {
      if (event.button !== 0 || !view) return;
      // Pulled once, it is known: the hand goes and does not come again.
      endDemo();
      remember('grass-pulled', '1');
      drag = { end: grip.dataset.end, left: view.left, right: view.right, told: event.timeStamp };
      grip.setPointerCapture(event.pointerId);
      ground.classList.add('ground-resizing');
      api.setGrass(view.left, view.right, true);
    };
    grip.onpointermove = event => {
      if (!drag || !view) return;
      const x = event.clientX + view.areaLeft;
      if (drag.end === 'left') drag.left = clamp(x, view.areaLeft, drag.right - view.min);
      else drag.right = clamp(x, drag.left + view.min, view.areaRight);
      place(drag.left, drag.right);
      if (event.timeStamp - drag.told > TELL_MS) {
        drag.told = event.timeStamp;
        api.setGrass(drag.left, drag.right, true);
      }
    };
    grip.onpointerup = event => end(grip, event);
    grip.onpointercancel = grip.onpointerup;
    // A capture lost some other way (another window took the pointer) ends the drag where it is.
    grip.onlostpointercapture = grip.onpointerup;
    // A double click spreads the grass across the whole floor again.
    grip.ondblclick = () => {
      if (!view) return;
      view = { ...view, left: view.areaLeft, right: view.areaRight };
      place(view.left, view.right);
      api.setGrass(view.left, view.right, false);
    };
  }

  return {
    show,
    see: over => ground.classList.toggle('ground-see', !!over && !drag),
    // The season the yard shows: the strip lies under its snow, petals or leaves (overlay.css).
    season: next => {
      ground.dataset.season = next;
      flurry.season(next);
    },
    // Ends in logical pixels on the whole desktop, as the layout gives a friend's.
    fall: x =>
      !!view && !drag && x >= view.left && x <= view.right && flurry.fall(x - view.left, view.right - view.left),
  };
}
