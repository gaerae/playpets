import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t, { oldKey = false, oldCert = true, key = true, strayCert = false, verifies = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'playpets-msix-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, contents) => {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  const release = 'work/src-tauri/target/x86_64-pc-windows-gnu/release';
  for (const name of ['playpets.exe', 'WebView2Loader.dll', 'bundle/nsis/setup.exe'])
    put(`${release}/${name}`, 'binary');
  put('work/src-tauri/icons/msix/icon.png', 'icon');
  put('work/packaging/licenses/THIRD-PARTY-NOTICES.txt', 'Third-party license fixture');
  put('work/package.json', JSON.stringify({ version: '0.2.0' }));
  // Builds before the key volume kept the key beside the package; newer ones keep it in /keys.
  if (oldKey) {
    put('out/msix-test/PlayPets-test.pfx', 'existing private certificate');
    if (oldCert) put('out/msix-test/PlayPets-test.cer', 'existing public certificate');
  }
  if (key) {
    put('keys/PlayPets-test.pfx', 'existing private certificate');
    put('keys/PlayPets-test.cer', 'existing public certificate');
  }
  // A certificate whose key was removed from the volume by hand.
  if (strayCert) put('keys/PlayPets-test.cer', 'certificate of a removed key');
  for (const name of ['AppxManifest.xml', 'README-test.txt'])
    put(`templates/${name}`, readFileSync(`packaging/windows/msix/${name}`, 'utf8'));
  put(
    'build.sh',
    readFileSync('packaging/windows/build.sh', 'utf8')
      .replaceAll('/work', `${root}/work`)
      .replaceAll('/out', `${root}/out`)
      .replaceAll('/keys', `${root}/keys`)
      .replaceAll('/usr/local/share/playpets-msix', `${root}/templates`),
  );
  put(
    'harness.sh',
    `
rsync() { :; }
npm() { :; }
npx() { :; }
zip() { :; }
makemsix() {
  cp "$3/AppxManifest.xml" "$5"
}
openssl() {
  echo "openssl $*" >> "$TEST_ROOT/calls"
  while [ "$#" -gt 0 ]; do
    case "$1" in -out) echo "new $2" > "$2"; shift;; esac
    shift
  done
}
osslsigncode() {
  echo "osslsigncode $*" >> "$TEST_ROOT/calls"
  if [ "$1" = sign ]; then
    while [ "$#" -gt 0 ]; do
      case "$1" in -in) input="$2"; shift;; -out) output="$2"; shift;; esac
      shift
    done
    cp "$input" "$output"
    echo SIGNED >> "$output"
  else
    echo 'Signature verification: ok'
    echo "$VERIFY_RESULT"
  fi
}
source "$TEST_ROOT/build.sh"
`,
  );
  return {
    root,
    run: publisher =>
      spawnSync('bash', [path.join(root, 'harness.sh')], {
        encoding: 'utf8',
        env: {
          ...process.env,
          TEST_ROOT: root,
          TMPDIR: root,
          MSIX_PUBLISHER: publisher,
          VERIFY_RESULT: verifies ? 'Succeeded' : 'Failed',
        },
      }),
    read: name => readFileSync(path.join(root, name), 'utf8'),
  };
}

test('a Store publisher produces an unsigned MSIX without touching cached test certificates', {
  skip: process.platform === 'win32',
}, t => {
  const f = fixture(t);
  const result = f.run('CN=Store-Publisher');
  assert.equal(result.status, 0, result.stderr);
  const file = path.join(f.root, 'out/msix-store/PlayPets_0.2.0_x64.msix');
  assert.ok(existsSync(file), 'the Store package has a distinct output folder');
  assert.match(readFileSync(file, 'utf8'), /Publisher="CN=Store-Publisher"/);
  assert.doesNotMatch(readFileSync(file, 'utf8'), /SIGNED/);
  assert.equal(existsSync(path.join(f.root, 'calls')), false, 'no certificate or signing commands run');
  assert.equal(f.read('keys/PlayPets-test.pfx'), 'existing private certificate');
  assert.equal(existsSync(path.join(f.root, 'out/msix-store/PlayPets-test.cer')), false);
});

test('the default MSIX build signs with its kept key and hands out only the public certificate', {
  skip: process.platform === 'win32',
}, t => {
  const f = fixture(t);
  const result = f.run('');
  assert.equal(result.status, 0, result.stderr);
  const output = f.read('out/msix-test/PlayPets_0.2.0_x64.msix');
  assert.match(output, /Publisher="CN=PlayPets Test"/);
  assert.match(output, /SIGNED/);
  assert.match(f.read('calls'), /osslsigncode sign -pkcs12 \S+\/keys\/PlayPets-test\.pfx/);
  assert.doesNotMatch(f.read('calls'), /openssl req/, 'the kept key is reused');
  assert.equal(f.read('keys/PlayPets-test.pfx'), 'existing private certificate');
  assert.equal(f.read('out/msix-test/PlayPets-test.cer'), 'existing public certificate');
  assert.equal(existsSync(path.join(f.root, 'out/msix-test/PlayPets-test.pfx')), false);
  assert.equal(existsSync(path.join(f.root, 'out/msix-test/README.txt')), true);
});

test('a key an older build left beside the package moves out of the release folder', {
  skip: process.platform === 'win32',
}, t => {
  const f = fixture(t, { oldKey: true, key: false });
  const result = f.run('');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read('keys/PlayPets-test.pfx'), 'existing private certificate');
  assert.equal(f.read('out/msix-test/PlayPets-test.cer'), 'existing public certificate');
  assert.equal(existsSync(path.join(f.root, 'out/msix-test/PlayPets-test.pfx')), false);
  assert.doesNotMatch(f.read('calls'), /openssl req/, 'testers keep the certificate they trusted');
});

test('the first MSIX build makes a key in the key volume', {
  skip: process.platform === 'win32',
}, t => {
  const f = fixture(t, { key: false });
  const result = f.run('');
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.read('calls'), /openssl req/);
  assert.ok(existsSync(path.join(f.root, 'keys/PlayPets-test.pfx')));
  assert.ok(existsSync(path.join(f.root, 'out/msix-test/PlayPets-test.cer')));
  assert.equal(existsSync(path.join(f.root, 'out/msix-test/PlayPets-test.pfx')), false);
});

test('a certificate left without its key is replaced by one made from the moved key', {
  skip: process.platform === 'win32',
}, t => {
  const f = fixture(t, { oldKey: true, oldCert: false, key: false, strayCert: true });
  const result = f.run('');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read('keys/PlayPets-test.pfx'), 'existing private certificate');
  assert.match(f.read('calls'), /openssl pkcs12 -in \S+\/keys\/PlayPets-test\.pfx/);
  assert.notEqual(f.read('out/msix-test/PlayPets-test.cer'), 'certificate of a removed key');
});

test('a test MSIX whose signature does not verify stops the build', {
  skip: process.platform === 'win32',
}, t => {
  const f = fixture(t, { verifies: false });
  const result = f.run('');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not verify against PlayPets-test\.cer/);
});
