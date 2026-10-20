// Measured grip and terminal guide on the retained transparent source artwork.
export const ROD = Object.freeze({
  width: 1536,
  height: 1024,
  grip: { x: 200, y: 510 },
  tip: { x: 1495, y: 480 },
});
export const rodUrl = new URL('../art/props/fishing-rod.png', import.meta.url).href;

/** A near-bank click still casts into open water, away from the friend's face. */
export function castLandingX(gripX, requestedX, petWidth, ends) {
  const left = ends[0] + 8,
    right = ends[1] - 8;
  if (left >= right || Math.abs(requestedX - gripX) >= petWidth * 0.36) return requestedX;
  const direction = Math.abs(right - gripX) >= Math.abs(left - gripX) ? 1 : -1;
  const target = Math.max(left, Math.min(right, gripX + direction * petWidth * 0.7));
  return Math.abs(target - gripX) > Math.abs(requestedX - gripX) ? target : requestedX;
}

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

/** The line follows the painted guide on a held rod, including a reduced-motion resting frame. */
export function authoredRodTip(action, bounds, still = false) {
  const clip = action?.clip;
  const frame = still ? clip?.frames?.[0] : action?.frame;
  if (!clip?.heldTool || frame?.tip?.length !== 2 || !frame.tip.every(Number.isFinite)) return null;
  if (frame.foot?.length !== 2 || !frame.foot.every(Number.isFinite)) return null;
  const anchor = clip.anchor ?? [96, 199];
  const scale = clip.scale ?? 1;
  const offset = clip.offset ?? [0, 0];
  return {
    x: bounds.x + ((offset[0] + anchor[0] + (frame.tip[0] - frame.foot[0]) * scale) * bounds.width) / 192,
    y: bounds.y + ((offset[1] + anchor[1] + (frame.tip[1] - frame.foot[1]) * scale) * bounds.height) / 208,
  };
}
