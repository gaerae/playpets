// Draws the PlayPets mascot (assets/mascot.svg) as Codex pets: a v2 sprite sheet (1536×2288,
// 8 columns × 11 rows of 192×208 cells) plus pet.json per coat in release/legacy-pets/<id>/. The face
// reuses the mascot's own SVG paths; the body, paws and tail are drawn here in the same flat
// style. Three coats share the drawing: the orange tabby (the mascot), a grey and a cream cat, so
// these historical reference files remain separate from the accepted production artwork.
// Row order and frame counts follow src/core/animation.js. Run: npm run mascot-pet
// Needs Google Chrome or Playwright's Chromium (browser-lib.mjs drives it headless).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUrlBytes } from './art-lib.mjs';
import { launchBrowser } from './browser-lib.mjs';

// The coats. Eyes, nose, blush and whisker tone stay; fur, stripes, belly, paws and ears change.
const COATS = [
  {
    id: 'tabby',
    displayName: 'Tabby',
    description: 'The PlayPets mascot: a round orange tabby who loves company.',
    colors: { fur: '#F9AE55', stripe: '#EA8434', belly: '#FDE0B5', paw: '#FBC37A', ear: '#F587A0', whisker: '#E58E3E' },
  },
  {
    id: 'smoky',
    displayName: 'Smoky',
    description: 'A calm grey cat from the PlayPets yard. Thinks before it speaks.',
    colors: { fur: '#A3ACB6', stripe: '#7A838E', belly: '#E9ECEF', paw: '#C2C9D1', ear: '#F2A9B8', whisker: '#8B949E' },
  },
  {
    id: 'mochi',
    displayName: 'Mochi',
    description: 'A soft cream cat from the PlayPets yard. Always up for a game.',
    colors: { fur: '#F7E6CF', stripe: '#DDBB93', belly: '#FFFFFF', paw: '#FBD8BF', ear: '#F5A7B7', whisker: '#D2B088' },
  },
];

// Runs inside the page. Everything is in cell coordinates (192×208, ground at y=196).
function drawSheet(coat) {
  const CELL_W = 192;
  const CELL_H = 208;
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * 8;
  canvas.height = CELL_H * 11;
  const ctx = canvas.getContext('2d');

  const C = {
    ...coat,
    eye: '#3A2A1E',
    blush: '#F9C0A8',
    nose: '#E8686D',
    mouth: '#8A5426',
    white: '#FFFFFF',
    sweat: '#7CC4F2',
    star: '#F7C948',
    laptop: '#5B6470',
    screen: '#D6EEFF',
  };

  // The mascot face in its own 1024-unit space (0..1024 wide; ears start at y≈34, chin at y=960).
  const EARS = [
    ['M92 380 L138 70 Q150 34 190 62 L430 232 Z', C.fur],
    ['M932 380 L886 70 Q874 34 834 62 L594 232 Z', C.fur],
    ['M158 330 L184 128 Q190 110 212 126 L368 240 Z', C.ear],
    ['M866 330 L840 128 Q834 110 812 126 L656 240 Z', C.ear],
  ];
  const WHISKERS = [
    'M150 640 Q100 634 62 620',
    'M152 692 Q104 700 68 718',
    'M874 640 Q924 634 962 620',
    'M872 692 Q920 700 956 718',
  ];

  function face(p) {
    // p.eye: open | blink | happy | dizzy | sad ; p.look: {dx,dy} in [-1,1]; p.mouth: smile | o | flat
    const eyeY = 598;
    const pupil = { x: (p.look?.dx ?? 0) * 26, y: (p.look?.dy ?? 0) * 22 };
    for (const [d, color] of EARS) {
      ctx.fillStyle = color;
      ctx.fill(new Path2D(d));
    }
    ctx.fillStyle = C.fur;
    ctx.beginPath();
    ctx.roundRect(64, 208, 896, 752, 200);
    ctx.fill();
    ctx.fillStyle = C.stripe;
    for (const [x, y, h] of [
      [422, 208, 96],
      [562, 208, 96],
      [492, 196, 120],
    ]) {
      ctx.beginPath();
      ctx.roundRect(x, y, 40, h, 20);
      ctx.fill();
    }
    // eyes
    for (const cx of [348, 676]) {
      if (p.eye === 'blink' || p.eye === 'happy') {
        ctx.strokeStyle = C.eye;
        ctx.lineWidth = 26;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (p.eye === 'happy') ctx.arc(cx, eyeY + 20, 58, Math.PI * 1.15, Math.PI * 1.85);
        else ctx.arc(cx, eyeY - 30, 58, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        continue;
      }
      if (p.eye === 'dizzy') {
        ctx.strokeStyle = C.eye;
        ctx.lineWidth = 26;
        ctx.lineCap = 'round';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx - 44 * s, eyeY - 48);
          ctx.lineTo(cx + 44 * s, eyeY + 48);
          ctx.stroke();
        }
        continue;
      }
      ctx.fillStyle = C.eye;
      ctx.beginPath();
      ctx.ellipse(cx + pupil.x, eyeY + pupil.y, 60, p.eye === 'sad' ? 60 : 74, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(cx + 20 + pupil.x * 0.6, eyeY - 26 + pupil.y * 0.6, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(cx - 16 + pupil.x * 0.6, eyeY + 24 + pupil.y * 0.6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (p.eye === 'sad') {
        ctx.strokeStyle = C.mouth;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const dir = cx < 512 ? 1 : -1;
        ctx.moveTo(cx - 70 * dir, eyeY - 120);
        ctx.lineTo(cx + 60 * dir, eyeY - 150);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = C.blush;
    for (const cx of [188, 836]) {
      ctx.beginPath();
      ctx.ellipse(cx, 742, 58, 36, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.nose;
    ctx.fill(new Path2D('M512 682 L544 706 Q512 736 480 706 Z'));
    ctx.strokeStyle = C.mouth;
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    if (p.mouth === 'o') {
      ctx.beginPath();
      ctx.ellipse(512, 780, 30, 38, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.mouth === 'flat') {
      ctx.beginPath();
      ctx.moveTo(452, 770);
      ctx.lineTo(572, 770);
      ctx.stroke();
    } else {
      ctx.stroke(new Path2D('M512 730 Q512 764 478 768 Q444 772 430 748'));
      ctx.stroke(new Path2D('M512 730 Q512 764 546 768 Q580 772 594 748'));
    }
    ctx.strokeStyle = C.whisker;
    ctx.lineWidth = 15;
    for (const d of WHISKERS) ctx.stroke(new Path2D(d));
  }

  // One cat in one cell. Everything optional; defaults are the resting pose.
  function cat(p = {}) {
    const dy = p.dy ?? 0; // vertical offset (negative = up)
    const squash = p.squash ?? 1; // <1 squashes, >1 stretches (about the ground)
    const lean = p.lean ?? 0; // body shear for walking, in px at head height
    const tail = p.tail ?? 0; // -1..1 sway
    const legs = p.legs ?? 0; // walk phase 0..1, 0 = standing
    const headBob = p.headBob ?? 0; // extra lift of the head only (px)
    const headScale = 120 / 1024;

    ctx.save();
    ctx.translate(96 + (p.dx ?? 0), 196 + dy);
    ctx.scale(1 / squash ** 0.5, squash);

    // tail: a short, chubby curl peeking out low behind the rump on the right, like the stub of
    // a round chibi cat. It stays small and close to the body (no long thin line that could read
    // as an arm) and sways a little; a darker tip says "tail".
    const tailPts = [
      [30, -14],
      [54 + tail * 4, -8 - tail * 3],
      [66 + tail * 6, -26 - tail * 6],
      [56 + tail * 7, -38 - tail * 7],
    ];
    const bez = (u, i) => {
      const [p0, p1, p2, p3] = tailPts.map(pt => pt[i]);
      return (1 - u) ** 3 * p0 + 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u * u * p2 + u ** 3 * p3;
    };
    const tailRadius = u => 10 - 3 * u;
    const dot = (u, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bez(u, 0), bez(u, 1), tailRadius(u), 0, Math.PI * 2);
      ctx.fill();
    };
    for (let u = 0; u <= 1; u += 0.02) dot(u, C.fur);
    for (let u = 0.8; u <= 1; u += 0.02) dot(u, C.stripe);
    // back legs / feet
    ctx.fillStyle = C.paw;
    for (const s of [-1, 1]) {
      const ph = (legs + (s > 0 ? 0 : 0.5)) * Math.PI * 2;
      const lift = legs ? Math.max(0, Math.sin(ph)) * 16 : 0;
      const swing = legs ? Math.cos(ph) * 9 : 0;
      ctx.beginPath();
      ctx.ellipse(s * 30 + swing, -8 - lift, 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // body
    ctx.fillStyle = C.fur;
    ctx.beginPath();
    ctx.ellipse(lean * 0.3, -46, 48, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.belly;
    ctx.beginPath();
    ctx.ellipse(lean * 0.3, -40, 30, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    // front paws (angles let a paw wave or type). A raised paw is drawn over the head.
    const paws = raised => {
      for (const s of [-1, 1]) {
        const raise = s < 0 ? (p.pawL ?? 0) : (p.pawR ?? 0); // 0 = down, 1 = fully up
        if (raise > 0.5 !== raised) continue;
        const swing = legs ? Math.sin((legs + (s > 0 ? 0.5 : 0)) * Math.PI * 2) * 8 : 0;
        ctx.save();
        ctx.translate(s * 26 + lean * 0.4, -44);
        ctx.rotate(-s * raise * 2.3);
        ctx.fillStyle = C.fur;
        ctx.beginPath();
        ctx.roundRect(-9, -4, 18, 40, 9);
        ctx.fill();
        ctx.fillStyle = C.paw;
        ctx.beginPath();
        ctx.ellipse(0, 36 + swing * 0.3, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    paws(false);
    // head
    ctx.save();
    ctx.translate(lean, -84 - headBob);
    ctx.rotate(p.tilt ?? 0);
    ctx.scale(headScale, headScale);
    ctx.translate(-512, -584);
    face(p);
    ctx.restore();
    paws(true);
    ctx.restore();

    // extras drawn unsquashed, above the cat
    if (p.sweat) {
      ctx.fillStyle = C.sweat;
      ctx.beginPath();
      ctx.moveTo(150, 60 + dy);
      ctx.quadraticCurveTo(162, 84 + dy, 150, 90 + dy);
      ctx.quadraticCurveTo(138, 84 + dy, 150, 60 + dy);
      ctx.fill();
    }
    if (p.dots != null) {
      ctx.fillStyle = C.mouth;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i <= p.dots ? 1 : 0.25;
        ctx.beginPath();
        ctx.arc(126 + i * 14, 44 + dy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (p.sparkle != null) {
      ctx.fillStyle = C.star;
      for (const [sx, sy, r] of [
        [30, 70, 9],
        [166, 54, 7],
        [150, 120, 6],
      ]) {
        const a = p.sparkle * 0.6 + sx;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const rad = k % 2 ? r * 0.45 : r;
          ctx.lineTo(sx + Math.cos(a + (k * Math.PI) / 4) * rad, sy + dy + Math.sin(a + (k * Math.PI) / 4) * rad);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    if (p.laptop) {
      ctx.fillStyle = C.laptop;
      ctx.beginPath();
      ctx.roundRect(50, 150 + dy, 92, 10, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(58, 116 + dy, 76, 38, 4);
      ctx.fill();
      ctx.fillStyle = C.screen;
      ctx.beginPath();
      ctx.roundRect(63, 120 + dy, 66, 30, 2);
      ctx.fill();
      ctx.fillStyle = C.laptop;
      for (let i = 0; i < p.laptop; i++) ctx.fillRect(70, 126 + dy + i * 7, 20 + ((i * 17) % 28), 3);
    }
  }

  function cell(row, column, draw) {
    ctx.save();
    ctx.translate(column * CELL_W, row * CELL_H);
    ctx.beginPath();
    ctx.rect(0, 0, CELL_W, CELL_H);
    ctx.clip();
    draw();
    ctx.restore();
  }

  const breathe = i => Math.sin((i / 6) * Math.PI * 2);
  // row 0: idle (6) — breathing, the tail swaying, an ear twitch, a blink at the end
  for (let i = 0; i < 6; i++)
    cell(0, i, () =>
      cat({
        squash: 1 + breathe(i) * 0.02,
        headBob: Math.max(0, breathe(i)) * 2,
        tail: Math.sin((i / 6) * Math.PI * 2 + 0.6) * 0.9,
        tilt: i === 2 ? -0.04 : 0,
        eye: i === 5 ? 'blink' : 'open',
      }),
    );
  // rows 1-2: walking right / left (8) — a bounce, legs swinging, body leaning in, tail wagging
  for (const [row, dir] of [
    [1, 1],
    [2, -1],
  ])
    for (let i = 0; i < 8; i++) {
      const ph = i / 8;
      const bounce = Math.abs(Math.sin(ph * Math.PI * 2));
      cell(row, i, () =>
        cat({
          legs: ph,
          dy: -bounce * 9,
          squash: 1 + bounce * 0.03,
          lean: dir * 9,
          headBob: bounce * 3,
          tail: Math.sin(ph * Math.PI * 2 + 1) * 1.1,
          look: { dx: dir * 0.9, dy: 0.15 },
          tilt: dir * (0.07 + bounce * 0.03),
          pawL: 0.12 + Math.max(0, Math.sin(ph * Math.PI * 2)) * 0.2,
          pawR: 0.12 + Math.max(0, -Math.sin(ph * Math.PI * 2)) * 0.2,
        }),
      );
    }
  // row 3: wave (4) — the paw swings wide, the head leans the other way
  for (let i = 0; i < 4; i++)
    cell(3, i, () =>
      cat({
        pawR: 1 - (i % 2) * 0.3,
        eye: i === 3 ? 'happy' : 'open',
        tilt: -0.08 + (i % 2) * 0.04,
        tail: 0.6 - (i % 2) * 0.4,
        headBob: (i % 2) * 2,
      }),
    );
  // row 4: jump (5) — crouch, rise, peak, fall, land
  const jump = [
    { dy: 0, squash: 0.86, eye: 'open', tail: -0.4 },
    { dy: -26, squash: 1.1, eye: 'open', mouth: 'o', tail: 0.4 },
    { dy: -44, squash: 1.0, eye: 'happy', mouth: 'o', pawL: 0.95, pawR: 0.95, tail: 0.9 },
    { dy: -20, squash: 1.05, eye: 'open', pawL: 0.4, pawR: 0.4, tail: 0.2 },
    { dy: 0, squash: 0.86, eye: 'happy', tail: -0.3 },
  ];
  jump.forEach((p, i) => {
    cell(4, i, () => cat(p));
  });
  // row 5: error (8) — a shake, dizzy eyes, a sweat drop
  for (let i = 0; i < 8; i++)
    cell(5, i, () =>
      cat({
        dx: (i % 2 ? 1 : -1) * (i < 6 ? 5 : 1),
        tilt: (i % 2 ? 1 : -1) * (i < 6 ? 0.05 : 0.01),
        eye: i < 6 ? 'dizzy' : 'sad',
        mouth: 'flat',
        sweat: i % 3 !== 2,
        tail: -0.6,
      }),
    );
  // row 6: waiting (6) — looking up, the tail flicking, dots filling in
  for (let i = 0; i < 6; i++)
    cell(6, i, () =>
      cat({
        look: { dx: 0.5, dy: -0.9 },
        dots: i % 4 === 3 ? -1 : i % 4,
        tail: i % 3 === 0 ? 0.9 : -0.2,
        tilt: 0.06,
        headBob: i % 2,
      }),
    );
  // row 7: working (6) — typing on a laptop, eyes down, a glance now and then
  for (let i = 0; i < 6; i++)
    cell(7, i, () =>
      cat({
        laptop: 1 + (i % 3),
        look: { dx: (i % 2) * 0.4 - 0.2, dy: i === 4 ? 0.2 : 0.8 },
        pawL: 0.3 + (i % 2) * 0.14,
        pawR: 0.44 - (i % 2) * 0.14,
        headBob: (i % 2) * 1.5,
        tail: Math.sin((i / 6) * Math.PI * 2) * 0.4,
      }),
    );
  // row 8: done (6) — happy, sparkles, a bounce
  for (let i = 0; i < 6; i++) {
    const b = Math.abs(Math.sin((i / 6) * Math.PI));
    cell(8, i, () =>
      cat({
        eye: 'happy',
        dy: -b * 12,
        squash: 1 + b * 0.04,
        sparkle: i,
        pawL: 0.9,
        pawR: 0.9,
        tail: 0.9,
        headBob: b * 2,
      }),
    );
  }
  // rows 9-10: looking in 16 directions. Direction 0 is up, 4 right, 8 down, 12 left (animation.js lookFrame).
  for (let d = 0; d < 16; d++) {
    const a = (d / 16) * Math.PI * 2;
    cell(9 + Math.floor(d / 8), d % 8, () =>
      cat({ look: { dx: Math.sin(a), dy: -Math.cos(a) }, tilt: Math.sin(a) * 0.06 }),
    );
  }
  return canvas.toDataURL('image/png');
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  for (const coat of COATS) {
    const out = `release/legacy-pets/${coat.id}`;
    const dataUrl = await page.evaluate(drawSheet, coat.colors);
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'spritesheet.png'), dataUrlBytes(dataUrl));
    await writeFile(
      path.join(out, 'pet.json'),
      `${JSON.stringify(
        {
          id: `playpets-${coat.id}`,
          displayName: coat.displayName,
          kind: 'animal',
          description: coat.description,
          spriteVersionNumber: 2,
          spritesheetPath: 'spritesheet.png',
          source: { name: 'PlayPets', url: 'https://github.com/gaerae/playpets', creator: 'gaerae', license: 'MIT' },
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Wrote ${out}/spritesheet.png and pet.json`);
  }
} finally {
  await browser.close();
}
