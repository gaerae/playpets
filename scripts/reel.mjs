// Cuts the moving pictures from the takes `SHOT_SCENE=reel pnpm run shots` films into
// scratch/reel/<lang>/ (take.mov and its marks): pnpm run reel   (needs ffmpeg)
// - website/public/shots/<capture version>/<lang>/reel.mp4 and reel.webp (its still) for the landing
// - assets/demo.gif, the README's picture, from the English take

import { spawnSync } from 'node:child_process';
import { access, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reelCuts, reelFilter } from './reel-lib.mjs';
import { CAPTURE_VERSION, SITE_LANGS } from './site-content.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = { width: 1280, fps: 30, fade: 0.4 };
const README = { width: 560, fps: 10, fade: 0.3 };
// The still shown before the film plays: the show, a few seconds in.
const STILL_AFTER_SHOW = 6;

function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (run.error) throw new Error('ffmpeg is needed (brew install ffmpeg)');
  if (run.status !== 0) throw new Error(run.stderr.trim());
}

async function take(lang) {
  const dir = path.join(root, 'scratch/reel', lang);
  const file = path.join(dir, 'take.mov');
  try {
    await access(file);
  } catch {
    return null;
  }
  return { file, marks: JSON.parse(await readFile(path.join(dir, 'marks.json'), 'utf8')) };
}

const shown = file => path.relative(root, file);

for (const lang of SITE_LANGS) {
  const filmed = await take(lang);
  if (!filmed) {
    console.log(`  ${lang}: no take in scratch/reel/${lang}, skipped`);
    continue;
  }
  const dir = path.join(root, 'website/public/shots', CAPTURE_VERSION, lang);
  const { graph, duration } = reelFilter(reelCuts(filmed.marks, 'site'), SITE);
  const film = path.join(dir, 'reel.mp4');
  ffmpeg([
    '-i',
    filmed.file,
    '-filter_complex',
    graph,
    '-map',
    '[film]',
    '-an',
    '-c:v',
    'libx264',
    // Players and browsers want 4:2:0; the fades hand frames on in 4:4:4.
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'slow',
    '-crf',
    '27',
    '-profile:v',
    'high',
    '-movflags',
    '+faststart',
    film,
  ]);
  const show = filmed.marks.findLast(mark => mark.name === 'show').at;
  const still = path.join(dir, 'reel.webp');
  const frame = path.join(os.tmpdir(), `playpets-reel-still-${process.pid}.png`);
  ffmpeg([
    '-ss',
    String(show + STILL_AFTER_SHOW),
    '-i',
    filmed.file,
    '-frames:v',
    '1',
    '-vf',
    `scale=${SITE.width}:-2:flags=lanczos`,
    frame,
  ]);
  // Homebrew's ffmpeg has no WebP encoder; cwebp comes with the art tools (brew install webp).
  const webp = spawnSync('cwebp', ['-quiet', '-q', '82', frame, '-o', still], { encoding: 'utf8' });
  if (webp.error || webp.status !== 0) throw new Error(webp.stderr?.trim() || 'cwebp is needed (brew install webp)');
  await rm(frame, { force: true });
  console.log(`  ${shown(film)} (${duration.toFixed(1)} s) and ${shown(still)}`);

  if (lang !== 'en') continue;
  const short = reelFilter(reelCuts(filmed.marks, 'readme'), README);
  const palette = path.join(os.tmpdir(), `playpets-reel-palette-${process.pid}.png`);
  const gif = path.join(root, 'assets/demo.gif');
  // One palette for the whole picture, weighted to what moves, so the bursts keep their colours. An
  // ordered dither stays put from frame to frame, so the still grass costs nothing after the first frame.
  ffmpeg([
    '-i',
    filmed.file,
    '-filter_complex',
    `${short.graph};[film]palettegen=max_colors=160:stats_mode=diff[palette]`,
    '-map',
    '[palette]',
    palette,
  ]);
  ffmpeg([
    '-i',
    filmed.file,
    '-i',
    palette,
    '-filter_complex',
    `${short.graph};[film][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    '-loop',
    '0',
    gif,
  ]);
  await rm(palette, { force: true });
  console.log(`  ${shown(gif)} (${short.duration.toFixed(1)} s)`);
}
