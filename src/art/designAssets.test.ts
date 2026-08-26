import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSET_BYTE_CEILING = 512 * 1024;

const designAssets = [
  { path: 'public/assets/backgrounds/dokkaebi-lair-shaft.png', width: 768, height: 1280 },
  { path: 'public/assets/backgrounds/battle-ch1.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch2.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch3.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch4.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch5.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch6.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch7.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch8.png', width: 1024, height: 1024 },
  { path: 'public/assets/backgrounds/battle-ch9.png', width: 1024, height: 1024 },
] as const;

function readPngDimensions(path: string): { width: number; height: number } {
  const source = readFileSync(path);
  expect(source.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: source.readUInt32BE(16), height: source.readUInt32BE(20) };
}

describe('project-bound generated design assets', () => {
  it.each(designAssets)('$path has its required PNG dimensions and mobile-safe byte ceiling', asset => {
    const path = resolve(process.cwd(), asset.path);
    expect(readPngDimensions(path)).toEqual({ width: asset.width, height: asset.height });
    expect(statSync(path).size).toBeLessThanOrEqual(ASSET_BYTE_CEILING);
  });

  it('keeps the legacy fallback background files available beside the new assets', () => {
    expect(statSync(resolve(process.cwd(), 'public/assets/backgrounds/dungeon-shaft.png')).isFile()).toBe(true);
    expect(statSync(resolve(process.cwd(), 'public/assets/backgrounds/dungeon-chamber.png')).isFile()).toBe(true);
  });
});
