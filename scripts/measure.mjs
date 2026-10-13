// CPU of the app in six states, on this machine: npm run measure (macOS and Linux).
// Runs the release binary with a throwaway data folder and three copies of the test pet, holds
// each state 30 s and measures seconds 4 to 16 of it (the first seconds settle a change), summing
// the app process and the WebKit processes it started. Numbers are % of one core.
//   yard+desktop strolling | yard+desktop still | desktop only | all hidden | yard only |
//   yard only with its sounds playing
// Compare numbers from the same machine only; docs/standards/performance.md lists the last ones.

import { execSync, spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFixturePet } from '../tests/support/fixture-pet.mjs';

if (process.platform === 'win32') {
  console.error('npm run measure reads CPU time with ps: macOS and Linux only. On Windows, watch Task Manager.');
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const binary = process.env.PLAYPETS_BINARY || path.join(here, '../src-tauri/target/e2e/playpets');
const data = await mkdtemp(path.join(os.tmpdir(), 'playpets-measure-'));
const codexHome = path.join(data, 'codex');
await writeFixturePet(codexHome);

const HOLD = 30;
const PHASES = {
  P1: 'yard + desktop, strolling',
  P2: 'yard + desktop, still',
  P3: 'desktop only (yard hidden)',
  P4: 'all hidden',
  P5: 'yard only',
  P6: 'yard only, sounds playing',
};
const scenario = `(async()=>{const P=window.playPets;const log=m=>window.__TAURI__.core.invoke('call',{name:'e2eLog',args:[m]});
const w=ms=>new Promise(r=>setTimeout(r,ms));
const b=await P.bootstrap();for(let i=0;i<3;i++)await P.addPet(b.data.assets[0].id);
await P.toggleDesktop();await P.toggleDesktopWander();log('P1');
await w(${HOLD}*1000);await P.toggleDesktopWander();log('P2');
await w(${HOLD}*1000);await P.windowHide();log('P3');
await w(${HOLD}*1000);await P.toggleDesktop();log('P4');
await w(${HOLD}*1000);await P.openChat((await P.bootstrap()).data.pets[0].id);log('P5');
await w(${HOLD}*1000);await P.setSound(true,40);document.dispatchEvent(new PointerEvent('pointerdown'));
const a=new AudioContext();await a.resume().catch(()=>{});log('audio:'+a.state);a.close();log('P6');
await w(${HOLD}*1000);log('END');})()`;

// CPU seconds so far of every process, from ps.
function snapshot() {
  const rows = new Map();
  for (const line of execSync('ps -ax -o pid=,time=,command=').toString().trim().split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const parts = m[2].replace('-', ':').split(':').map(Number);
    const seconds = parts.reduce((total, p) => total * 60 + p, 0);
    rows.set(Number(m[1]), { cpu: seconds, cmd: m[3] });
  }
  return rows;
}
const WEBKIT = /com\.apple\.WebKit\.(WebContent|GPU)|WebKit(Web|GPU)Process/;
const before = snapshot();
const child = spawn(binary, [], {
  env: { ...process.env, PLAYPETS_DATA: data, CODEX_HOME: codexHome, PLAYPETS_LANG: 'en', PLAYPETS_E2E_EVAL: scenario },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const ours = snap => [...snap].filter(([pid, p]) => pid === child.pid || (!before.has(pid) && WEBKIT.test(p.cmd)));
const results = [];
child.stdout.on('data', chunk => {
  for (const line of chunk.toString().split('\n')) {
    const phase = line.match(/^\[e2e\] (\S+)/)?.[1];
    if (!phase) continue;
    if (!PHASES[phase] && phase !== 'END') {
      console.log(phase);
      continue;
    }
    if (phase === 'END') {
      child.kill('SIGTERM');
      continue;
    }
    setTimeout(() => {
      const start = snapshot();
      const t0 = Date.now();
      setTimeout(() => {
        const end = snapshot();
        const seconds = (Date.now() - t0) / 1000;
        const used = ours(end).reduce((sum, [pid, p]) => sum + (start.has(pid) ? p.cpu - start.get(pid).cpu : 0), 0);
        const total = (100 * used) / seconds;
        results.push([PHASES[phase], total]);
        console.log(`${PHASES[phase].padEnd(28)} ${total.toFixed(1).padStart(5)}%`);
      }, 12_000);
    }, 4_000);
  }
});
child.on('exit', () => {
  if (results.length < 6) console.error('The run ended early; see the output above.');
  process.exit(results.length === 6 ? 0 : 1);
});
setTimeout(() => child.kill('SIGTERM'), (10 + 6 * HOLD + 20) * 1000);
