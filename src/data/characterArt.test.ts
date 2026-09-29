import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { MONSTER_DEFS } from './monsterRegistry';
import {
  CHARACTER_ART, getCharacterArt, getCharacterArtForSpeaker, selectCharacterArtSource,
} from './characterArt';

vi.mock('phaser', () => ({ default: {} }));
import { ensurePortrait, generateMonsterSprite, generatePortrait, generateRoomToken } from '../art/PortraitGenerator';

// The approved first nine keep their order; later ritual-v2 batches append (§37).
const FIRST_NINE = [
  'dokkaebi_warrior', 'gumiho_guardian', 'death_messenger', 'mountain_spirit',
  'village_archer', 'dokkaebi_junior', 'gold_turtle', 'fire_dokkaebi', 'sage',
] as const;
const IDS = Object.keys(CHARACTER_ART) as (keyof typeof CHARACTER_ART)[];
/** A catalog monster that still renders its legacy JPEG (no ritual-v2 entry yet). */
const LEGACY_ONLY = Object.keys(MONSTER_DEFS).find(id => !(id in CHARACTER_ART)) ?? 'missing';

afterEach(() => vi.unstubAllGlobals());

describe('ritual character art', () => {
  it('keeps versioned overrides separate from gameplay definitions', () => {
    expect(IDS.slice(0, FIRST_NINE.length)).toEqual(FIRST_NINE);
    expect(Object.isFrozen(CHARACTER_ART)).toBe(true);
    for (const id of IDS) {
      const art = getCharacterArt(id)!;
      expect(art.monsterId).toBe(MONSTER_DEFS[id].id);
      expect(art.path).toBe(`/assets/monsters/ritual-v2/${id}.webp`);
      expect(art.textureKey).toBe(`monster-ritual-v2-${id}`);
      expect(art.version).toBe('ritual-v2');
      expect(Object.isFrozen(art)).toBe(true);
    }
  });

  // Runtime cutouts are 512² WebP with alpha (VP8X, alpha flag) — §38.
  it.each(IDS)('%s points to a bounded 512px WebP with alpha', id => {
    const bytes = readFileSync(resolve(process.cwd(), `public${CHARACTER_ART[id].path}`));
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 16)).toBe('WEBPVP8X');
    expect(bytes[20] & 0x10).toBe(0x10);
    expect(1 + bytes.readUIntLE(24, 3)).toBe(512);
    expect(1 + bytes.readUIntLE(27, 3)).toBe(512);
    expect(bytes.length).toBeLessThanOrEqual(512 * 1024);
  });

  it.each([undefined, null, {}, '', 'constructor', 'toString', '__proto__', LEGACY_ONLY, 'missing'])
    ('rejects an unknown or inherited override lookup: %s', id => {
      expect(getCharacterArt(id)).toBeNull();
    });

  it('maps only exact story speakers without conflating related characters', () => {
    const pairs = [
      ['도깨비 전사', 'dokkaebi_warrior'], ['구미호', 'gumiho_guardian'],
      ['저승사자', 'death_messenger'], ['산신령', 'mountain_spirit'],
    ] as const;
    for (const [speaker, id] of pairs) expect(getCharacterArtForSpeaker(speaker)).toBe(CHARACTER_ART[id]);
    for (const speaker of ['도깨비 대왕', '구미호 여왕', '저승왕 사자', '산신', '구미호 ', 'constructor', '__proto__']) {
      expect(getCharacterArtForSpeaker(speaker)).toBeNull();
    }
  });

  it('maps the sage only for the exact 신선 도인 speaker label', () => {
    expect(getCharacterArtForSpeaker('신선 도인')).toMatchObject({
      monsterId: 'sage',
      textureKey: 'monster-ritual-v2-sage',
    });
    expect(getCharacterArtForSpeaker('신선 도인 ')).toBeNull();
    expect(getCharacterArtForSpeaker('신선')).toBeNull();
  });

  it.each(IDS)('%s selects loaded override, then legacy, then procedural', id => {
    const art = CHARACTER_ART[id];
    const legacy = `monster-ai-${id}`;
    expect(selectCharacterArtSource(id, key => [art.textureKey, legacy].includes(key)))
      .toEqual({ textureKey: art.textureKey, version: 'ritual-v2' });
    expect(selectCharacterArtSource(id, key => key === legacy))
      .toEqual({ textureKey: legacy, version: 'legacy' });
    expect(selectCharacterArtSource(id, () => false)).toBeNull();
    expect(selectCharacterArtSource(id, () => true, 'festival-skin')).toBeNull();
  });

  it('retains the legacy path for the rest of the catalog and refuses invalid IDs', () => {
    expect(selectCharacterArtSource(LEGACY_ONLY, () => true))
      .toEqual({ textureKey: `monster-ai-${LEGACY_ONLY}`, version: 'legacy' });
    const exists = vi.fn(() => true);
    for (const id of [undefined, {}, 'constructor', 'toString', '__proto__', 'missing']) {
      expect(selectCharacterArtSource(id, exists)).toBeNull();
    }
    expect(exists).not.toHaveBeenCalled();
  });
});

function cachedScene(keys: readonly string[]): Phaser.Scene {
  return { textures: {
    exists: (key: string) => keys.includes(key),
    get: () => ({ getSourceImage: () => ({}) }),
  } } as unknown as Phaser.Scene;
}

describe('derived character textures', () => {
  it('selects the versioned world sprite before an existing procedural cache', () => {
    const id = 'dokkaebi_warrior';
    const scene = cachedScene([CHARACTER_ART[id].textureKey, `sprite-${id}`, `sprite-ritual-v2-${id}`]);
    expect(generateMonsterSprite(scene, id)).toBe(`sprite-ritual-v2-${id}`);
  });

  it.each(IDS)('bakes %s into a transparent 96px ritual world canvas without changing caller display size', id => {
    const sourceImage = {};
    const context = { imageSmoothingEnabled: false, drawImage: vi.fn(), fillRect: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => context };
    vi.stubGlobal('document', { createElement: () => canvas });
    const addCanvas = vi.fn();
    const scene = { textures: {
      exists: (key: string) => key === CHARACTER_ART[id].textureKey || key === `sprite-${id}`,
      get: () => ({ getSourceImage: () => sourceImage }),
      addCanvas,
    } } as unknown as Phaser.Scene;

    expect(generateMonsterSprite(scene, id)).toBe(`sprite-ritual-v2-${id}`);
    expect(canvas.width).toBe(96);
    expect(canvas.height).toBe(96);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(sourceImage, 0, 0, 96, 96);
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(addCanvas).toHaveBeenCalledExactlyOnceWith(`sprite-ritual-v2-${id}`, canvas);
  });

  it('keeps a world sprite procedural when only the legacy illustration is loaded', () => {
    const id = 'gumiho_guardian';
    const scene = cachedScene([`monster-ai-${id}`, `sprite-${id}`, `sprite-ritual-v2-${id}`]);
    expect(generateMonsterSprite(scene, id)).toBe(`sprite-${id}`);
  });

  it('uses versioned portrait and token caches even when legacy caches exist', () => {
    const id = 'dokkaebi_warrior';
    const scene = cachedScene([
      CHARACTER_ART[id].textureKey, `monster-ai-${id}`,
      `portrait-${id}`, `portrait-ritual-v2-${id}`,
      `roomtoken-${id}`, `roomtoken-ritual-v2-${id}`,
    ]);
    expect(generatePortrait(scene, id)).toBe(`portrait-ritual-v2-${id}`);
    expect(generateRoomToken(scene, id)).toBe(`roomtoken-ritual-v2-${id}`);
    expect(ensurePortrait(scene, id)).toBe(true);
  });

  it('falls back to existing legacy caches when the override is not loaded', () => {
    const id = 'dokkaebi_warrior';
    const scene = cachedScene([`monster-ai-${id}`, `portrait-${id}`, `roomtoken-${id}`, `portrait-ritual-v2-${id}`]);
    expect(generatePortrait(scene, id)).toBe(`portrait-${id}`);
    expect(generateRoomToken(scene, id)).toBe(`roomtoken-${id}`);
    expect(generateRoomToken(cachedScene([]), id)).toBeNull();
  });

  it('preserves explicit skin cache keys while new art is loaded', () => {
    const id = 'dokkaebi_warrior';
    const scene = cachedScene([CHARACTER_ART[id].textureKey, `portrait-${id}-festival-skin`]);
    expect(generatePortrait(scene, id, 'festival-skin')).toBe(`portrait-${id}-festival-skin`);
  });

  it('does not report an old portrait as ready when the selected new texture could not be created', () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    const id = 'gumiho_guardian';
    const scene = cachedScene([CHARACTER_ART[id].textureKey, `portrait-${id}`]);
    expect(ensurePortrait(scene, id)).toBe(false);
  });
});
