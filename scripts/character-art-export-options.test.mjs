import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadKnownMonsterIds,
  parseCharacterArtExportArgs,
  planCharacterArtOutputWrites,
  preflightCharacterArtMasters,
  preflightCharacterArtOutputTargets,
  validateKnownCharacterArtIds,
  validateRuntimePng,
  validateRuntimeWebp,
  writeCharacterArtOutputs,
} from './character-art-export-options.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function runtimePng({ width = 512, height = 512, bitDepth = 8, colorType = 6 } = {}) {
  const bytes = Buffer.alloc(33);
  PNG_SIGNATURE.copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = bitDepth;
  bytes[25] = colorType;
  return bytes;
}

test('requires an explicit batch and master directory', () => {
  assert.throws(() => parseCharacterArtExportArgs([], '/repo'), /--ids is required/);
  assert.throws(
    () => parseCharacterArtExportArgs(['--ids', 'sage'], '/repo'),
    /--master-dir is required/,
  );
});

test('rejects unsafe, empty and duplicate IDs', () => {
  const prefix = ['--master-dir', 'output/character-art/ritual-v2', '--ids'];
  assert.throws(() => parseCharacterArtExportArgs([...prefix, '../sage'], '/repo'), /unsafe character id/);
  assert.throws(() => parseCharacterArtExportArgs([...prefix, 'sage,,gold_turtle'], '/repo'), /empty character id/);
  assert.throws(() => parseCharacterArtExportArgs([...prefix, 'sage,sage'], '/repo'), /duplicate character id/);
});

test('rejects duplicate and unknown flags', () => {
  assert.throws(() => parseCharacterArtExportArgs([
    '--ids', 'sage', '--ids', 'gold_turtle',
    '--master-dir', 'output/character-art/ritual-v2',
  ], '/repo'), /duplicate flag: --ids/);
  assert.throws(() => parseCharacterArtExportArgs([
    '--ids', 'sage', '--master-dir', 'output/character-art/ritual-v2', '--all',
  ], '/repo'), /unknown flag: --all/);
});

test('rejects a lexical master directory escape', () => {
  assert.throws(() => parseCharacterArtExportArgs([
    '--ids', 'sage', '--master-dir', '../ritual-v2',
  ], '/repo'), /master directory is outside/);
});

test('resolves a named batch without broadening it', () => {
  assert.deepEqual(parseCharacterArtExportArgs([
    '--ids', 'sage,gold_turtle', '--master-dir', 'output/character-art/ritual-v2',
  ], '/repo'), {
    ids: ['sage', 'gold_turtle'],
    masterDir: '/repo/output/character-art/ritual-v2',
  });
});

test('loads the authoritative MonsterId union and rejects unknown registry IDs', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'character-art-known-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/data'), { recursive: true });
  await writeFile(path.join(root, 'src/data/monstersTypes.ts'), [
    "export type MonsterId =",
    "  | 'sage'",
    "  | 'gold_turtle';",
  ].join('\n'));

  const knownIds = await loadKnownMonsterIds(root);
  assert.deepEqual([...knownIds], ['sage', 'gold_turtle']);
  assert.doesNotThrow(() => validateKnownCharacterArtIds(['sage'], knownIds));
  assert.throws(
    () => validateKnownCharacterArtIds(['sage', 'not_a_monster'], knownIds),
    /unknown character id: not_a_monster/,
  );
});

test('rejects a master file whose real path escapes through a symlink', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'character-art-master-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const masterDir = path.join(root, 'output/character-art/ritual-v2');
  const outside = path.join(root, 'outside');
  await mkdir(masterDir, { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(outside, 'sage-master.png'), runtimePng());
  await symlink(path.join(outside, 'sage-master.png'), path.join(masterDir, 'sage-master.png'));

  await assert.rejects(
    preflightCharacterArtMasters(['sage'], masterDir, masterDir),
    /master file real path is outside/,
  );
});

test('rejects an allowed master root that resolves outside the repository', async t => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'character-art-master-root-'));
  t.after(async () => (await import('node:fs/promises')).rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'repo');
  const outside = path.join(base, 'outside');
  const masterRoot = path.join(root, 'output/character-art/ritual-v2');
  await mkdir(path.dirname(masterRoot), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(outside, 'sage-master.png'), runtimePng());
  await symlink(outside, masterRoot);

  await assert.rejects(
    preflightCharacterArtMasters(['sage'], masterRoot, masterRoot, root),
    /source root real path is outside the repository/,
  );
});

test('validates the runtime PNG signature, dimensions, RGBA and byte budget', () => {
  assert.doesNotThrow(() => validateRuntimePng(runtimePng(), 'sage'));
  assert.throws(() => validateRuntimePng(Buffer.alloc(33), 'sage'), /invalid PNG signature/);
  const missingHeader = runtimePng();
  missingHeader.fill(0, 12, 16);
  assert.throws(() => validateRuntimePng(missingHeader, 'sage'), /missing IHDR/);
  assert.throws(() => validateRuntimePng(runtimePng({ width: 511 }), 'sage'), /must be 512x512/);
  assert.throws(() => validateRuntimePng(runtimePng({ colorType: 2 }), 'sage'), /must be 8-bit RGBA/);
  assert.throws(() => validateRuntimePng(Buffer.alloc(512 * 1024 + 1), 'sage'), /byte budget/);
});

test('preflights the whole batch before writing and rejects different existing bytes', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'character-art-plan-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const outputRoot = path.join(root, 'public/assets/monsters/ritual-v2');
  await mkdir(outputRoot, { recursive: true });
  const first = path.join(outputRoot, 'sage.webp');
  const second = path.join(outputRoot, 'gold_turtle.webp');
  await writeFile(second, Buffer.from('different'));

  await assert.rejects(planCharacterArtOutputWrites([
    { id: 'sage', outputPath: first, bytes: runtimePng() },
    { id: 'gold_turtle', outputPath: second, bytes: runtimePng() },
  ], outputRoot), /existing output differs: .*gold_turtle\.webp/);
  await assert.rejects(readFile(first), { code: 'ENOENT' });
});

test('reports identical outputs as no-write and creates new outputs exclusively', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'character-art-write-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const outputRoot = path.join(root, 'public/assets/monsters/ritual-v2');
  await mkdir(outputRoot, { recursive: true });
  const bytes = runtimePng();
  const unchanged = path.join(outputRoot, 'sage.webp');
  const fresh = path.join(outputRoot, 'gold_turtle.webp');
  await writeFile(unchanged, bytes);

  const plan = await planCharacterArtOutputWrites([
    { id: 'sage', outputPath: unchanged, bytes },
    { id: 'gold_turtle', outputPath: fresh, bytes },
  ], outputRoot);
  assert.deepEqual(plan.map(item => item.status), ['unchanged', 'create']);

  await writeCharacterArtOutputs(plan);
  assert.deepEqual(await readFile(unchanged), bytes);
  assert.deepEqual(await readFile(fresh), bytes);

  const raced = path.join(outputRoot, 'village_archer.webp');
  const racedPlan = await planCharacterArtOutputWrites([
    { id: 'village_archer', outputPath: raced, bytes },
  ], outputRoot);
  await writeFile(raced, Buffer.from('race winner'));
  await assert.rejects(writeCharacterArtOutputs(racedPlan), { code: 'EEXIST' });
  assert.deepEqual(await readFile(raced), Buffer.from('race winner'));
});

test('rejects output symlinks even when their targets are contained', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'character-art-output-link-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const outputRoot = path.join(root, 'public/assets/monsters/ritual-v2');
  await mkdir(outputRoot, { recursive: true });
  const target = path.join(outputRoot, 'target.webp');
  const linked = path.join(outputRoot, 'sage.webp');
  await writeFile(target, runtimePng());
  await symlink(target, linked);

  await assert.rejects(planCharacterArtOutputWrites([
    { id: 'sage', outputPath: linked, bytes: runtimePng() },
  ], outputRoot), /output target is a symlink/);
});

test('rejects a runtime output root that resolves outside the repository', async t => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'character-art-output-root-'));
  t.after(async () => (await import('node:fs/promises')).rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'repo');
  const outside = path.join(base, 'outside');
  const outputRoot = path.join(root, 'public/assets/monsters/ritual-v2');
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await mkdir(outside);
  await symlink(outside, outputRoot);

  await assert.rejects(
    preflightCharacterArtOutputTargets(['sage'], outputRoot, root),
    /runtime root real path is outside the repository/,
  );
});

test('validateRuntimeWebp accepts a 512² extended WebP with alpha and rejects the rest (§38)', () => {
  const webp = ({ size = 512, alpha = true, chunk = 'VP8X', bytes = 64 } = {}) => {
    const b = Buffer.alloc(bytes);
    b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write(chunk, 12, 'ascii');
    b[20] = alpha ? 0x10 : 0; b.writeUIntLE(size - 1, 24, 3); b.writeUIntLE(size - 1, 27, 3);
    return b;
  };
  assert.doesNotThrow(() => validateRuntimeWebp(webp(), 'sage'));
  assert.throws(() => validateRuntimeWebp(Buffer.alloc(64), 'sage'), /invalid WebP signature/);
  assert.throws(() => validateRuntimeWebp(webp({ chunk: 'VP8 ' }), 'sage'), /missing VP8X/);
  assert.throws(() => validateRuntimeWebp(webp({ alpha: false }), 'sage'), /alpha channel/);
  assert.throws(() => validateRuntimeWebp(webp({ size: 511 }), 'sage'), /must be 512x512/);
  assert.throws(() => validateRuntimeWebp(webp({ bytes: 512 * 1024 + 1 }), 'sage'), /byte budget/);
});
