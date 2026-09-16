// Run with: node --test scripts/check-portraits.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const soi = [0xff, 0xd8];
const sof = [0xff, 0xc0, 0, 17, 8, 1, 0, 1, 0, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0];
const sos = [0xff, 0xda, 0, 12, 3, 1, 0, 2, 17, 3, 17, 0, 63, 0];
const eoi = [0xff, 0xd9];
const jpeg = Buffer.from([...soi, ...sof, ...sos, 0, ...eoi]);

function check(files) {
  const root = mkdtempSync(join(tmpdir(), 'portrait-check-'));
  try {
    for (const dir of ['scripts', 'src/data', 'public/assets/monsters']) mkdirSync(join(root, dir), { recursive: true });
    copyFileSync(new URL('./check-portraits.mjs', import.meta.url), join(root, 'scripts/check-portraits.mjs'));
    writeFileSync(join(root, 'src/data/monstersTypes.ts'), "export type MonsterId = 'fixture';");
    for (const [name, bytes] of Object.entries(files)) writeFileSync(join(root, 'public/assets/monsters', name), bytes);
    const result = spawnSync(process.execPath, [join(root, 'scripts/check-portraits.mjs')], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.stderr, '');
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts a real portrait and a structurally complete JPEG fixture', () => {
  const real = readFileSync(new URL('../public/assets/monsters/abyss_mage.jpg', import.meta.url));
  for (const bytes of [real, jpeg]) assert.equal(check({ 'fixture.jpg': bytes }).status, 0);
});

test('accepts escaped entropy bytes, restart markers and multiple scans', () => {
  const progressiveSof = [...sof];
  progressiveSof[1] = 0xc2;
  const bytes = Buffer.from([
    ...soi, ...progressiveSof, ...sos, 0, 0xff, 0x00, 0xff, 0xd0,
    0xff, 0xc4, 0, 2, ...sos, 0, ...eoi,
  ]);
  assert.equal(check({ 'fixture.jpg': bytes }).status, 0);
});

const badComponentCount = [...sof];
badComponentCount[9] = 0;
const mismatchedComponents = [...sof];
mismatchedComponents[9] = 2;
const zeroWidth = [...sof];
zeroWidth[7] = 0;
const zeroPrecision = [...sof];
zeroPrecision[4] = 0;
for (const [name, bytes] of Object.entries({
  'SOF without SOS or EOI': [...soi, ...sof],
  'SOS without EOI': [...soi, ...sof, ...sos, 0],
  'EOI without SOS': [...soi, ...sof, ...eoi],
  'zero SOF components': [...soi, ...badComponentCount, ...sos, 0, ...eoi],
  'mismatched SOF length': [...soi, ...mismatchedComponents, ...sos, 0, ...eoi],
  'zero width': [...soi, ...zeroWidth, ...sos, 0, ...eoi],
  'zero precision': [...soi, ...zeroPrecision, ...sos, 0, ...eoi],
  'truncated marker': [...soi, 0xff, 0xc0],
  'truncated SOS': [...soi, ...sof, 0xff, 0xda, 0, 12, 3],
  'malformed SOS length': [...soi, ...sof, 0xff, 0xda, 0, 6, 3, 0, 63, 0, ...eoi],
  'SOS without SOF': [...soi, ...sos, 0, ...eoi],
  'trailing marker fill without EOI': [...soi, ...sof, ...sos, 0, 0xff, 0xff],
  'garbage before SOF': [...soi, 0, ...sof, ...sos, 0, ...eoi],
  'renamed PNG': [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10],
})) {
  test(`rejects ${name}`, () => {
    const result = check({ 'fixture.jpg': Buffer.from(bytes) });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /실제 JPEG가 아닌/);
  });
}

test('preserves lowercase extension, missing, orphan, size and dimension checks', () => {
  const wrongSize = Buffer.from(jpeg);
  wrongSize[9] = 0;
  wrongSize[10] = 128;
  for (const [files, diagnostic] of [
    [{ 'fixture.jpg': jpeg, 'extra.JPG': jpeg }, /소문자 \.jpg/],
    [{ 'fixture.JPG': jpeg }, /누락된 몬스터/],
    [{ 'fixture.jpg': jpeg, 'unknown.jpg': jpeg }, /MonsterId 아닌/],
    [{ 'fixture.jpg': Buffer.alloc(150 * 1024 + 1) }, /150KB 초과/],
    [{ 'fixture.jpg': wrongSize }, /256x256가 아닌/],
  ]) {
    const result = check(files);
    assert.equal(result.status, 1);
    assert.match(result.stdout, diagnostic);
  }
});
