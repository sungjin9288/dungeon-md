import { lstat, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_RUNTIME_BYTES = 512 * 1024;
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

function assertContained(base, candidate, message) {
  const relative = path.relative(base, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(message);
  }
}

export function parseCharacterArtExportArgs(argv, root) {
  const values = new Map();
  const allowedFlags = new Set(['--ids', '--master-dir']);

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowedFlags.has(flag)) throw new Error(`unknown flag: ${flag}`);
    if (values.has(flag)) throw new Error(`duplicate flag: ${flag}`);
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    values.set(flag, value);
  }

  if (!values.has('--ids')) throw new Error('--ids is required');
  if (!values.has('--master-dir')) throw new Error('--master-dir is required');

  const ids = values.get('--ids').split(',');
  if (ids.some(id => id.length === 0)) throw new Error('empty character id');
  for (const id of ids) {
    if (!ID_PATTERN.test(id)) throw new Error(`unsafe character id: ${id}`);
  }
  if (new Set(ids).size !== ids.length) throw new Error('duplicate character id');

  const allowedMasterRoot = path.resolve(root, 'output/character-art/ritual-v2');
  const masterDir = path.resolve(root, values.get('--master-dir'));
  assertContained(
    allowedMasterRoot,
    masterDir,
    'master directory is outside the character-art source root',
  );

  return { ids, masterDir };
}

export async function loadKnownMonsterIds(root) {
  const source = await readFile(path.join(root, 'src/data/monstersTypes.ts'), 'utf8');
  const match = source.match(/export type MonsterId\s*=\s*([\s\S]*?);/);
  if (!match) throw new Error('could not read authoritative MonsterId inventory');
  const ids = [...match[1].matchAll(/'([a-z][a-z0-9_]*)'/g)].map(result => result[1]);
  if (ids.length === 0) throw new Error('authoritative MonsterId inventory is empty');
  return new Set(ids);
}

export function validateKnownCharacterArtIds(ids, knownIds) {
  for (const id of ids) {
    if (!knownIds.has(id)) throw new Error(`unknown character id: ${id}`);
  }
}

export async function preflightCharacterArtMasters(ids, masterDir, allowedMasterRoot, repositoryRoot) {
  const realAllowedRoot = await realpath(allowedMasterRoot);
  if (repositoryRoot) {
    const realRepositoryRoot = await realpath(repositoryRoot);
    assertContained(
      realRepositoryRoot,
      realAllowedRoot,
      'character-art source root real path is outside the repository',
    );
  }
  const realMasterDir = await realpath(masterDir);
  assertContained(
    realAllowedRoot,
    realMasterDir,
    'master directory real path is outside the character-art source root',
  );

  const masters = [];
  for (const id of ids) {
    const masterPath = path.resolve(masterDir, `${id}-master.png`);
    assertContained(masterDir, masterPath, `master path is outside the selected directory: ${id}`);
    const realMasterPath = await realpath(masterPath);
    assertContained(realMasterDir, realMasterPath, `master file real path is outside the selected directory: ${id}`);
    const info = await stat(realMasterPath);
    if (!info.isFile()) throw new Error(`master is not a regular file: ${masterPath}`);
    const bytes = await readFile(realMasterPath);
    if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error(`master has invalid PNG signature: ${masterPath}`);
    }
    masters.push({ id, masterPath, bytes });
  }
  return masters;
}

async function inspectOutputTarget(outputPath, outputRoot, realOutputRoot) {
  const resolvedOutput = path.resolve(outputPath);
  assertContained(outputRoot, resolvedOutput, `output path is outside the runtime directory: ${outputPath}`);
  const realParent = await realpath(path.dirname(resolvedOutput));
  assertContained(realOutputRoot, realParent, `output parent real path is outside the runtime directory: ${outputPath}`);

  try {
    const linkInfo = await lstat(resolvedOutput);
    if (linkInfo.isSymbolicLink()) throw new Error(`output target is a symlink: ${resolvedOutput}`);
    if (!linkInfo.isFile()) throw new Error(`output target is not a regular file: ${resolvedOutput}`);
    const realOutput = await realpath(resolvedOutput);
    assertContained(realOutputRoot, realOutput, `output real path is outside the runtime directory: ${resolvedOutput}`);
    return { outputPath: resolvedOutput, existingBytes: await readFile(realOutput) };
  } catch (error) {
    if (error?.code === 'ENOENT') return { outputPath: resolvedOutput, existingBytes: null };
    throw error;
  }
}

export async function preflightCharacterArtOutputTargets(ids, outputRoot, repositoryRoot) {
  const resolvedRoot = path.resolve(outputRoot);
  const realOutputRoot = await realpath(resolvedRoot);
  if (repositoryRoot) {
    const realRepositoryRoot = await realpath(repositoryRoot);
    assertContained(
      realRepositoryRoot,
      realOutputRoot,
      'runtime root real path is outside the repository',
    );
  }
  const targets = [];
  for (const id of ids) {
    targets.push(await inspectOutputTarget(
      path.join(resolvedRoot, `${id}.png`),
      resolvedRoot,
      realOutputRoot,
    ));
  }
  return targets;
}

export function validateRuntimePng(bytes, id) {
  if (bytes.length > MAX_RUNTIME_BYTES) throw new Error(`${id} exceeds runtime byte budget`);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${id} has invalid PNG signature`);
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${id} is missing IHDR`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 512 || height !== 512) throw new Error(`${id} must be 512x512`);
  if (bytes[24] !== 8 || bytes[25] !== 6) throw new Error(`${id} must be 8-bit RGBA`);
}

export async function planCharacterArtOutputWrites(exports, outputRoot, repositoryRoot) {
  const targets = await preflightCharacterArtOutputTargets(
    exports.map(item => item.id),
    outputRoot,
    repositoryRoot,
  );
  return exports.map((item, index) => {
    const target = targets[index];
    if (target.existingBytes && !target.existingBytes.equals(item.bytes)) {
      throw new Error(`existing output differs: ${target.outputPath}`);
    }
    return {
      ...item,
      outputPath: target.outputPath,
      status: target.existingBytes ? 'unchanged' : 'create',
    };
  });
}

export async function writeCharacterArtOutputs(plan) {
  for (const item of plan) {
    if (item.status === 'create') await writeFile(item.outputPath, item.bytes, { flag: 'wx' });
  }
}
