// Species keep their collection identity while flying; decoding starts only in a living yard.
const WINGBEAT = [0, 1, 2, 1];
let bugsReady, birdsReady;
const decode = async path => {
  if (typeof Image === 'undefined') return null;
  const image = new Image();
  image.src = new URL(path, import.meta.url).href;
  await image.decode();
  return image;
};
function loadBugs() {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  bugsReady ??= Promise.all([
    decode('../art/bugs/specimens.png'),
    fetch(new URL('../art/collection.json', import.meta.url)).then(r => (r.ok ? r.json() : [])),
  ])
    .then(([image, entries]) => ({ image, entries }))
    .catch(() => null);
  return bugsReady;
}
function loadBirds() {
  birdsReady ??= decode('../art/ambient/birds.png').catch(() => null);
  return birdsReady;
}
const canvasFor = () => (typeof document === 'undefined' ? null : document.createElement('canvas'));
export function createAmbientArt(
  changed,
  { loadBugs: bugs = loadBugs, loadBirds: birds = loadBirds, makeCanvas = canvasFor } = {},
) {
  let bugImage,
    birdImage,
    bugPending,
    birdPending,
    wildlife = false,
    sky = false;
  const crops = new Map(),
    materials = new Map();
  function material(key, draw) {
    if (materials.has(key)) return materials.get(key);
    const canvas = makeCanvas();
    if (!canvas) {
      materials.set(key, null);
      return null;
    }
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      materials.set(key, null);
      return null;
    }
    draw(ctx);
    materials.set(key, canvas);
    return canvas;
  }
  function use(living, openSky, creatures = []) {
    wildlife = living;
    sky = openSky;
    for (const creature of creatures) {
      if (creature.kind !== 'firefly') continue;
      const ink = creature.look.glow || '#ecf096';
      material(ink, ctx => {
        const fade = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
        fade.addColorStop(0, ink);
        fade.addColorStop(0.15, ink);
        fade.addColorStop(1, `${ink}00`);
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, 64, 64);
      });
    }
    if (wildlife && !bugPending)
      bugPending = Promise.resolve(bugs())
        .then(result => {
          if (!result?.image || !Array.isArray(result.entries)) return;
          bugImage = result.image;
          for (const entry of result.entries)
            if (entry.kind === 'bugs' && entry.crop?.length === 4) crops.set(entry.id, entry.crop);
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
    const crop = crops.get(creature.species);
    if (!bugImage || !crop) return false;
    const size = (creature.kind === 'firefly' ? 12 : creature.kind === 'dragonfly' ? 23 : 21) * scale;
    ctx.save();
    ctx.translate(creature.x, creature.y);
    if (creature.kind === 'dragonfly') ctx.rotate(creature.heading + Math.PI / 2);
    // The butterfly's wings fold; its center remains at the catch target.
    if (creature.kind === 'butterfly') ctx.scale(0.4 + 0.6 * Math.abs(Math.sin(creature.phase)), 1);
    const aspect = crop[3] / crop[2];
    ctx.drawImage(bugImage, ...crop, -size / 2, (-size * aspect) / 2, size, size * aspect);
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
  function streak(ctx, x, y, dx, dy) {
    const sprite = materials.get('tail');
    if (!sprite) return false;
    const length = Math.hypot(dx, dy) * 0.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.drawImage(sprite, -length, -6, length, 12);
    ctx.restore();
    return true;
  }
  function glow(ctx, creature, scale) {
    const sprite = materials.get(creature.look.glow || '#ecf096');
    if (!sprite) return false;
    const size = 24 * scale;
    ctx.drawImage(sprite, creature.x - size / 2, creature.y - size / 2, size, size);
    return true;
  }
  return { use, bug, bird, star, streak, glow };
}
