// Measured grip and terminal guide on the retained transparent source artwork.
export const ROD = Object.freeze({
  width: 1536,
  height: 1024,
  grip: { x: 200, y: 510 },
  tip: { x: 1495, y: 480 },
});
export const rodUrl = new URL('../art/props/fishing-rod.png', import.meta.url).href;

/** Aim the terminal guide toward the water so the line carries on past the rod. */
export function castGeometry(grip, float, petWidth, petHeight) {
  const delta = float.x - grip.x;
  const reach = Math.min(petWidth * 0.46, Math.abs(delta) * 0.6);
  return {
    grip,
    tip: { x: grip.x + Math.sign(delta || 1) * reach, y: grip.y - petHeight * 0.48 },
    float,
  };
}

/** Keep the curve's bend on the water side of the rod for either casting direction. */
export function linePath(tip, float) {
  const bend = Math.sign(float.x - tip.x) * 3;
  return `M${tip.x} ${tip.y}Q${(tip.x + float.x) / 2 + bend} ${(tip.y + float.y) / 2 + 5} ${float.x} ${float.y - 6}`;
}

/** Fit the rigid prop between the pet's hand and the existing fishing-line attachment. */
export function rodPlacement(grip, tip) {
  const sx = ROD.tip.x - ROD.grip.x;
  const sy = ROD.tip.y - ROD.grip.y;
  const tx = tip.x - grip.x;
  const ty = tip.y - grip.y;
  const norm = sx * sx + sy * sy;
  const a = (tx * sx + ty * sy) / norm;
  const b = (ty * sx - tx * sy) / norm;
  return {
    a,
    b,
    c: -b,
    d: a,
    e: grip.x - a * ROD.grip.x + b * ROD.grip.y,
    f: grip.y - b * ROD.grip.x - a * ROD.grip.y,
  };
}
