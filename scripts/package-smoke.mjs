import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function expectRunning(command, args, options) {
  const grouped = process.platform !== 'win32';
  const child = spawn(command, args, { ...options, detached: grouped, stdio: 'inherit' });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const startup = await Promise.race([delay(8_000).then(() => undefined), exited]);
  if (startup) throw new Error(`${command} exited during its startup smoke test (${startup.code ?? startup.signal}).`);
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(-child.pid, 'SIGTERM');
  }
  const stopped = await Promise.race([exited.then(() => true), delay(5_000).then(() => false)]);
  if (!stopped && grouped) {
    process.kill(-child.pid, 'SIGKILL');
    await exited;
  }
}

function findFile(root, predicate) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const item = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(item, predicate);
      if (nested) return nested;
    } else if (predicate(entry.name)) return item;
  }
  return undefined;
}

async function smokeMac(dmg, temporary) {
  const mount = path.join(temporary, 'mount');
  const applications = path.join(temporary, 'Applications');
  mkdirSync(mount);
  mkdirSync(applications);
  execFileSync('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg], { stdio: 'ignore' });
  try {
    const source = path.join(mount, 'PlayPets.app');
    const installed = path.join(applications, 'PlayPets.app');
    cpSync(source, installed, { recursive: true });
    execFileSync('codesign', ['--verify', '--strict', '--deep', installed], { stdio: 'inherit' });
    if (!existsSync(path.join(installed, 'Contents/Resources/THIRD-PARTY-NOTICES.txt')))
      throw new Error('Installed macOS app is missing THIRD-PARTY-NOTICES.txt.');
    await expectRunning(path.join(installed, 'Contents/MacOS/playpets'), [], {
      env: { ...process.env, PLAYPETS_DATA: path.join(temporary, 'data') },
    });
  } finally {
    execFileSync('hdiutil', ['detach', mount], { stdio: 'ignore' });
  }
}

async function smokeLinux(deb, appImage, temporary) {
  execFileSync('sudo', ['apt-get', 'install', '-y', path.resolve(deb)], { stdio: 'inherit' });
  await expectRunning(
    'dbus-run-session',
    ['--', 'xvfb-run', '-a', '-s', '-screen 0 1920x1080x24', '/usr/bin/playpets'],
    { env: { ...process.env, PLAYPETS_DATA: path.join(temporary, 'deb-data') } },
  );
  await expectRunning(
    'dbus-run-session',
    ['--', 'xvfb-run', '-a', '-s', '-screen 0 1920x1080x24', path.resolve(appImage)],
    {
      env: {
        ...process.env,
        APPIMAGE_EXTRACT_AND_RUN: '1',
        PLAYPETS_DATA: path.join(temporary, 'appimage-data'),
      },
    },
  );
}

async function smokeWindows(installer, temporary) {
  const installed = path.join(temporary, 'PlayPets');
  execFileSync(path.resolve(installer), ['/S', `/D=${installed}`], { stdio: 'inherit' });
  const executable = findFile(installed, name => name.toLowerCase() === 'playpets.exe');
  if (!executable) throw new Error('The NSIS installer did not install playpets.exe.');
  const notices = findFile(installed, name => name === 'THIRD-PARTY-NOTICES.txt');
  if (!notices) throw new Error('The NSIS installer did not install THIRD-PARTY-NOTICES.txt.');
  await expectRunning(executable, [], {
    env: { ...process.env, PLAYPETS_DATA: path.join(temporary, 'data') },
  });
  const uninstaller = findFile(installed, name => /^unins.*\.exe$/i.test(name));
  if (!uninstaller) throw new Error('The NSIS installer did not install an uninstaller.');
  execFileSync(uninstaller, ['/S'], { stdio: 'inherit' });
}

const [platform, ...files] = process.argv.slice(2);
const temporary = mkdtempSync(path.join(tmpdir(), 'playpets-package-smoke-'));
try {
  if (platform === 'macos' && files.length === 1) await smokeMac(path.resolve(files[0]), temporary);
  else if (platform === 'linux' && files.length === 2)
    await smokeLinux(path.resolve(files[0]), path.resolve(files[1]), temporary);
  else if (platform === 'windows' && files.length === 1) await smokeWindows(path.resolve(files[0]), temporary);
  else throw new Error('Usage: package-smoke.mjs macos <dmg> | windows <installer> | linux <deb> <AppImage>');
  console.log(`Installed and launched the ${platform} package.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
