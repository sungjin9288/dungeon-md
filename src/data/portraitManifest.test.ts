import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONSTER_DEFS } from './monsters';
import { PORTRAIT_IDS } from './portraitManifest';

describe('portrait manifest', () => {
  it('matches the illustrated monster jpg files on disk', () => {
    const assetIds = readdirSync(resolve(process.cwd(), 'public/assets/monsters'))
      .filter(file => file.endsWith('.jpg'))
      .map(file => file.replace(/\.jpg$/, ''))
      .sort();

    expect(PORTRAIT_IDS).toEqual(assetIds);
  });

  it('covers every monster registry id exactly once', () => {
    expect(PORTRAIT_IDS).toEqual(Object.keys(MONSTER_DEFS).sort());
  });

  it('wires the newly illustrated dokkaebi portraits', () => {
    expect(PORTRAIT_IDS).toEqual(expect.arrayContaining([
      'dokkaebi_bomber',
      'dokkaebi_captain',
      'fire_dokkaebi_king',
      'gold_dokkaebi',
      'storm_dokkaebi',
    ]));
  });
});
