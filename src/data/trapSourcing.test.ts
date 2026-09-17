import { describe, expect, it } from 'vitest';
import { getAbyssFloorLoot, ABYSS_MAX_FLOOR } from './abyss';
import { DROP_TABLE, MATERIAL_DEFS } from './fusion';
import { FACILITY_DEFS } from './production';
import { isTrapRecipeFusion, TRAP_DEFS, trapMasteryCost, TRAP_MASTERY_MAX } from './traps';

/** Every way a material can enter the player's inventory. */
function obtainableMaterials(): Set<string> {
  const ids = new Set<string>();
  for (const drops of Object.values(DROP_TABLE)) for (const drop of drops) ids.add(drop.id);
  for (let floor = 1; floor <= ABYSS_MAX_FLOOR; floor++) for (const entry of getAbyssFloorLoot(floor)) ids.add(entry.id);
  for (const def of Object.values(FACILITY_DEFS)) if (def.output.kind === 'material') ids.add(def.output.materialId);
  return ids;
}

describe('trap crafting is reachable', () => {
  it('every trap recipe material has at least one source, and is a real material', () => {
    const sources = obtainableMaterials();
    for (const trap of TRAP_DEFS) {
      for (const id of Object.keys(trap.recipe.materials)) {
        expect(MATERIAL_DEFS[id], `${trap.id} → unknown material ${id}`).toBeDefined();
        expect(sources.has(id), `${trap.id} needs ${id}, which nothing drops/produces`).toBe(true);
      }
    }
  });

  it('mastery costs stay on the same materials, so maxing never needs a new source', () => {
    const sources = obtainableMaterials();
    for (const trap of TRAP_DEFS) {
      for (let level = 0; level < TRAP_MASTERY_MAX; level++) {
        for (const id of Object.keys(trapMasteryCost(trap, level))) expect(sources.has(id), `${trap.id} mastery ${level} → ${id}`).toBe(true);
      }
    }
  });

  it('every fusion input is itself craftable, so no trap is stranded behind a missing tier', () => {
    const byId = new Map(TRAP_DEFS.map(trap => [trap.id, trap]));
    for (const trap of TRAP_DEFS) {
      if (!isTrapRecipeFusion(trap.recipe)) continue;
      for (const input of trap.recipe.traps) {
        const def = byId.get(input);
        expect(def, `${trap.id} → unknown input ${input}`).toBeDefined();
        expect(def!.tier).toBe(trap.tier - 1);
      }
    }
  });

  it('boss_essence — the only tier-3 gate — comes from abyss boss floors', () => {
    const bossFloorLoot = getAbyssFloorLoot(10).map(entry => entry.id);
    expect(bossFloorLoot).toContain('boss_essence');
    expect(getAbyssFloorLoot(9).map(entry => entry.id)).not.toContain('boss_essence');
    const tier3 = TRAP_DEFS.filter(trap => trap.tier === 3);
    expect(tier3).toHaveLength(4);
    for (const trap of tier3) expect(Object.keys(trap.recipe.materials)).toContain('boss_essence');
  });
});
