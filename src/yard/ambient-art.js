// Species keep their collection identity while roaming; decoding starts only in a living yard.
import { canvasFor, decodeImage, materialCache } from './raster.js';

const WINGBEAT = [0, 1, 2, 1];
// How long one beat of a flier's wings takes (ms). The yard draws twenty frames a second while one
// flies: a beat over six frames or more reads as a beat; a quicker one is drawn at a few scattered
// points of it and flickers.
export const WING_BEAT = { butterfly: 360, dragonfly: 300 };
/** How far a flier's wings are spread (0 folded, 1 open) `beat` of the way (0 to 1) through a beat. */
export const wingSpread = beat => Math.abs(Math.sin(Math.PI * beat));
let bugsReady;
function loadBugs() {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  bugsReady ??= fetch(new URL('../art/collection.json', import.meta.url))
    .then(r => (r.ok ? r.json() : []))
    .then(async entries => {
      const atlases = [...new Set(entries.filter(entry => entry.kind === 'bugs').map(entry => entry.atlas))];
      const images = new Map(
        await Promise.all(atlases.map(async atlas => [atlas, await decodeImage(`../art/${atlas}`)])),
      );
      return { images, entries };
    })
    .catch(() => null);
  return bugsReady;
}
const loadBirds = () => decodeImage('../art/ambient/birds.webp');
export function createAmbientArt(
  changed,
  { loadBugs: bugs = loadBugs, loadBirds: birds = loadBirds, makeCanvas = canvasFor } = {},
) {
  let birdImage,
    bugPending,
    birdPending,
    wildlife = false,
    sky = false;
  const crops = new Map(),
    materials = materialCache(makeCanvas),
    { material } = materials;
  function use(living, openSky, creatures = []) {
    wildlife = living;
    sky = openSky;
    for (const creature of creatures) {
      if (creature.kind !== 'firefly') continue;
      const ink = creature.look.glow || '#ecf096';
      // A firefly's light (firefly below): a soft halo in its glow, and a core warm white at its heart.
      const light = stops => ctx => {
        const fade = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
        for (const [at, colour] of stops) fade.addColorStop(at, colour);
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, 64, 64);
      };
      material(
        `halo ${ink}`,
        light([
          [0, `${ink}aa`],
          [0.25, `${ink}55`],
          [1, `${ink}00`],
        ]),
      );
      material(
        `core ${ink}`,
        light([
          [0, '#fffbe8'],
          [0.25, ink],
          [0.6, `${ink}66`],
          [1, `${ink}00`],
        ]),
      );
    }
    if (wildlife && !bugPending)
      bugPending = Promise.resolve(bugs())
        .then(result => {
          if (!Array.isArray(result?.entries)) return;
          for (const entry of result.entries)
            if (entry.kind === 'bugs' && entry.crop?.length === 4) {
              const image = result.images?.get(entry.atlas) || result.image;
              if (image) crops.set(entry.id, { image, crop: entry.crop, yard: entry.yard });
            }
          if (wildlife) changed();
        })
        .catch(() => {});
    if (sky && !birdPending)
      birdPending = Promise.resolve(birds())
        .then(image => {
          if (image?.width === 384 && image.height === 128) birdImage = image;
          if (birdImage && sky) changed();
        })
        .catch(() => {});
    if (sky) {
      material('star', ctx => {
        const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
        glow.addColorStop(0, '#fff9e7');
        glow.addColorStop(0.12, '#fff9e7');
        glow.addColorStop(0.3, 'rgba(255,249,231,.25)');
        glow.addColorStop(1, 'rgba(255,249,231,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 64, 64);
      });
      material('tail', ctx => {
        const fade = ctx.createLinearGradient(0, 0, 64, 0);
        fade.addColorStop(0, 'rgba(255,249,231,0)');
        fade.addColorStop(1, '#fff9e7');
        ctx.fillStyle = fade;
        ctx.beginPath();
        ctx.moveTo(0, 32);
        ctx.lineTo(62, 29);
        ctx.quadraticCurveTo(66, 32, 62, 35);
        ctx.closePath();
        ctx.fill();
      });
    }
  }
  function bug(ctx, creature, scale) {
    const specimen = crops.get(creature.species);
    if (!specimen) return false;
    const { image, crop } = specimen;
    // A kind can be smaller or larger than the rest of its kind (catalog.json look.size).
    const size = ({ dragonfly: 23, beetle: 13, cricket: 17 }[creature.kind] || 21) * (creature.look?.size ?? 1) * scale;
    ctx.save();
    ctx.translate(creature.x, creature.y);
    if (['dragonfly', 'beetle', 'cricket'].includes(creature.kind)) ctx.rotate(creature.heading + Math.PI / 2);
    // The butterfly's wings fold; its center remains at the catch target.
    if (creature.kind === 'butterfly') ctx.scale(0.4 + 0.6 * wingSpread(creature.beat ?? 0), 1);
    const aspect = crop[3] / crop[2];
    ctx.drawImage(image, ...crop, -size / 2, (-size * aspect) / 2, size, size * aspect);
    ctx.restore();
    return true;
  }
  function bird(ctx, x, y, phase, direction, scale, now) {
    if (!birdImage) return false;
    const frame = WINGBEAT[Math.floor((now / 100 + phase) % 4)],
      size = 22 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.drawImage(birdImage, frame * 128, 0, 128, 128, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  function star(ctx, point) {
    const sprite = materials.get('star');
    if (!sprite) return false;
    const size = point.r * 8;
    ctx.drawImage(sprite, point.x - size / 2, point.y - size / 2, size, size);
    return true;
  }
  // A shooting star's tail behind its head at (x, y), flying at `angle`; the tail's taper is a
  // tenth of the material's height, so it is drawn ten times as thick as the star.
  function streak(ctx, x, y, angle, length, width) {
    const sprite = materials.get('tail');
    if (!sprite) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(sprite, -length, -width * 5, length, width * 10);
    ctx.restore();
    return true;
  }
  // A firefly in the yard is mostly its light, `lit` (0 to 1) along its blink. Its small body, the
  // bug alone (its yard crop in collection.json), stands upright with its lantern at the light and
  // shows most while the light is low; a soft halo and a warm-white core in its own glow go over
  // it. The halo stays soft and the core is the only bright point; both follow `lit` evenly, so
  // with random phases about half of them show at once.
  // Before the specimens are in, the light alone.
  function firefly(ctx, creature, scale, lit) {
    const ink = creature.look.glow || '#ecf096',
      halo = materials.get(`halo ${ink}`),
      core = materials.get(`core ${ink}`);
    if (!halo || !core) return false;
    const size = (creature.look.size ?? 1) * scale,
      light = creature.light ?? 1,
      { x, y } = creature,
      specimen = crops.get(creature.species);
    if (specimen?.yard) {
      const [, , cropWidth, cropHeight] = specimen.yard,
        height = 9 * size,
        width = (height * cropWidth) / cropHeight;
      ctx.globalAlpha = (0.35 + (1 - lit) * 0.45) * light;
      ctx.drawImage(specimen.image, ...specimen.yard, x - width / 2, y - height * 0.82, width, height);
    }
    ctx.globalAlpha = (0.08 + lit * 0.47) * light;
    ctx.drawImage(halo, x - 12 * size, y - 12 * size, 24 * size, 24 * size);
    ctx.globalAlpha = (0.15 + lit * 0.85) * light;
    ctx.drawImage(core, x - 6.5 * size, y - 6.5 * size, 13 * size, 13 * size);
    return true;
  }
  return { use, bug, bird, star, streak, firefly };
}
