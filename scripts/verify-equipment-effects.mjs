// Live Phaser fixtures for the approved section 3-2 equipment effects.
// WEB_AUDIT_HEADLESS=1 node scripts/verify-equipment-effects.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.EQUIPMENT_OUTPUT ?? 'output/playwright/equipment-effects';
await mkdir(output, { recursive: true });
const audit = { generatedAt: new Date().toISOString(), scope: 'Isolated live Phaser fixtures; not organic campaign balance evidence', checks: [], failures: [], sourceHashes: {} };
for (const file of ['src/data/barracks.ts', 'src/data/equipmentCombat.ts', 'src/data/equipmentAuras.ts', 'src/combat/EquipmentAttacks.ts', 'src/combat/WaveStart.ts', 'src/data/equipmentDefense.ts', 'src/data/roomSlotTransactions.ts', 'src/combat/CombatResolver.ts', 'src/combat/RoomMechanics.ts', 'src/combat/RoomTriggers.ts', 'src/combat/DungeonLayout.ts', 'src/combat/GameplayInit.ts', 'src/combat/DungeonSceneInit.ts', 'src/combat/DungeonSceneCtx.ts', 'src/combat/RoomDurability.ts', 'src/combat/BossBehaviors.ts', 'src/combat/LateBossBehaviors.ts', 'src/scenes/DungeonSceneVisuals.ts', 'src/scenes/DungeonScene.ts', 'src/objects/Room.ts', 'src/ui/ForgeShared.ts', 'src/ui/MonsterDetailShared.ts', 'src/ui/ForgeWorkbench.ts', 'src/ui/ForgeTabs.ts', 'src/ui/ForgeCraftFx.ts', 'src/scenes/ForgeScene.ts', 'scripts/verify-equipment-effects.mjs']) {
  audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
const check = (id, actual, expected) => {
  audit.checks.push({ id, actual, expected });
  if (typeof expected === 'number') assert(Math.abs(actual - expected) < .001, `${id}: ${actual} != ${expected}`);
  else assert.deepEqual(actual, expected, id);
};
try {
  const { context, page, errors } = await openScene('DungeonHomeScene', { width: 390, height: 844 });
  try {
    page.on('console', msg => { if (msg.type() === 'error') console.error(msg.text()); });
    console.log('equipment: seeding real saved loadout');
    await page.evaluate(async () => {
      const { loadGameState, saveGameState } = await import('/src/data/wisdom.ts');
      const { defaultOwnedMonster } = await import('/src/data/barracks.ts');
      const gs = loadGameState();
      saveGameState({ ...gs, dmLevel: 40, gold: 99999,
        ownedMonsters: [
          { ...defaultOwnedMonster('dokkaebi_warrior'), equipment: 'eq_dragon_fang' },
          { ...defaultOwnedMonster('dokkaebi_warrior_qa_extra'), equipment: 'eq_boss_amulet' },
          defaultOwnedMonster('village_archer'),
        ],
        dungeonSlots: [{ roomType: 'combat', monsterIds: ['dokkaebi_warrior', 'dokkaebi_warrior_qa_extra'], trapIds: [], roomLevel: 5, hp: 400, maxHp: 400 },
          { roomType: 'combat', monsterIds: ['village_archer'], trapIds: [], roomLevel: 1, hp: 400, maxHp: 400 }],
      });
      const game = window.__phaserGame;
      game.scene.getScenes(true).forEach(s => game.scene.stop(s.scene.key));
      game.registry.set('stageConfig', { stageNumber: 1 }); game.scene.start('DungeonScene');
    });
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('DungeonScene') && window.__phaserGame.scene.getScene('DungeonScene').roomGrid.flat().some(d => d?.monsterSlot === 'dokkaebi_warrior'));
    console.log('equipment: probing primary, extra, armor, boss and durability adapters');
    const r = await page.evaluate(async () => {
      const { runCombat } = await import('/src/scenes/DungeonSceneVisuals.ts');
      const { runExtraMonsterAttacks } = await import('/src/combat/RoomMechanics.ts');
      const { buildRoomMechanicsCtx, buildBossCtx, buildBattleEventCtx } = await import('/src/combat/DungeonSceneCtx.ts');
      const { triggerJudgment } = await import('/src/combat/BossBehaviors.ts');
      const { triggerSpectralBolt, triggerWhirlwind } = await import('/src/combat/RoomTriggers.ts');
      const { getEquipmentStats } = await import('/src/data/barracks.ts');
      const { resolveMonsterAttackCooldown } = await import('/src/data/monsters.ts');
      const game = window.__phaserGame; game.loop.stop();
      const ds = game.scene.getScene('DungeonScene'); ds.setSpeed(1);
      const room = ds.rooms.flat().find(r => r.roomData?.monsterSlot === 'dokkaebi_warrior');
      const data = room.roomData, primary = 'dokkaebi_warrior', extra = 'dokkaebi_warrior_qa_extra';
      const initialMap = [ds.equipmentMap.get(primary)?.bossDmgBonus, ds.equipmentMap.get(extra)?.bossDmgBonus];
      data.hasFirstStrikeUsed = true; data.level = 1; ds.synergyManager.activeSynergies = [];
      ds.roomGrid.flat().forEach(d => { if (d && d !== data) d.lastAttackTime = 1e9; });
      ds.spawnInvader('soldier');
      const inv = ds.activeInvaders.at(-1); inv.pathTween.pause(); inv.setPosition(room.x, room.y);
      inv.hp = inv.maxHp = 1e9; inv.hasShield = false;
      {
        const strike = (id, flags, secondary = false) => {
          const wearer = secondary ? extra : primary;
          ds.equipmentMap.set(wearer, getEquipmentStats(id));
          inv.def = { ...inv.def, isBoss: false, isMiniBoss: false, ...flags };
          const before = inv.hp;
          if (secondary) {
            data.monsterSlots = [primary, extra]; ds.extraMonsterCooldowns.clear();
            runExtraMonsterAttacks(buildRoomMechanicsCtx(ds), 100000);
          } else {
            data.monsterSlots = [primary]; data.lastAttackTime = 0;
            runCombat(ds, 100000);
          }
          return before - inv.hp;
        };
        const damage = [];
        for (const secondary of [false, true]) {
          const base = strike(null, {}, secondary);
          for (const id of ['eq_dragon_fang', 'eq_boss_amulet']) {
            for (const flags of [{}, { isBoss: true }, { isMiniBoss: true }]) damage.push({ secondary, id, flags, base, hit: strike(id, flags, secondary) });
          }
        }
        const timing = [];
        ds.equipmentMap.set(primary, getEquipmentStats('eq_moonstone_pendant'));
        ds.equipmentMap.set(extra, getEquipmentStats('eq_moonstone_pendant'));
        const synergy = ds.synergyManager.getGuardianAttackIntervalMult();
        for (const speed of [1, 3]) {
          ds.setSpeed(speed); data.monsterSlots = [primary]; data.lastAttackTime = 0;
          const cd = data.attackCooldown * synergy / 1.2;
          runCombat(ds, cd - .01); const before = data.lastAttackTime;
          runCombat(ds, cd + .01); const after = data.lastAttackTime;
          data.monsterSlots = [primary, extra]; ds.extraMonsterCooldowns.clear();
          const extraCd = resolveMonsterAttackCooldown(extra, data.type) * synergy / 1.2 / speed;
          runExtraMonsterAttacks(buildRoomMechanicsCtx(ds), extraCd - .01);
          const extraBefore = ds.extraMonsterCooldowns.size;
          runExtraMonsterAttacks(buildRoomMechanicsCtx(ds), extraCd + .01);
          const extraAfter = ds.extraMonsterCooldowns.get(`${room.row}_${room.col}_1`);
          let ring; const original = room.updateAttackCooldown;
          room.updateAttackCooldown = (_now, mult) => { ring = mult; };
          ds.waveActive = true; ds.update(ds.time.now, 0); ds.waveActive = false;
          room.updateAttackCooldown = original;
          timing.push({ speed, cd, before, after, extraCd, extraBefore, extraAfter, ring, synergy });
        }
        ds.setSpeed(1);
        // AoE replacement basics must classify each target, not inherit the first target's boss flag.
        ds.spawnInvader('soldier');
        const ordinary = ds.activeInvaders.at(-1); ordinary.pathTween.pause(); ordinary.setPosition(room.x + 10, room.y);
        ordinary.hp = ordinary.maxHp = 1e9; ordinary.hasShield = false;
        inv.def = { ...inv.def, isBoss: true, isMiniBoss: false };
        const area = [];
        for (const name of ['spectral', 'whirlwind']) {
          const before = [inv.hp, ordinary.hp]; const ctx = buildRoomMechanicsCtx(ds);
          if (name === 'spectral') triggerSpectralBolt(ctx, room.x, room.y, room.row, 100, getEquipmentStats('eq_boss_amulet'));
          else triggerWhirlwind(ctx, room.row, 100, room.x, room.y, getEquipmentStats('eq_boss_amulet'));
          area.push({ name, boss: before[0] - inv.hp, ordinary: before[1] - ordinary.hp });
        }
        const armor = [];
        data.monsterSlots = [primary];
        for (const id of ['eq_spirit_robe', 'eq_divine_aegis', 'eq_ore_plate', 'eq_abyss_mail']) {
          ds.equipmentMap.set(primary, getEquipmentStats(id)); room.setRoomHpSnapshot(1000, 1000); room.damageRoomHp(100);
          armor.push({ id, hp: room.structuralHp, dataHp: data.roomHp });
        }
        ds.equipmentMap.set(primary, getEquipmentStats('eq_divine_aegis'));
        ds.equipmentMap.set(extra, getEquipmentStats('eq_abyss_mail'));
        data.monsterSlots = [primary, extra]; room.setRoomHpSnapshot(1000, 1000); room.damageRoomHp(100);
        const stacked = room.structuralHp;
        room.healRoomHp(20); const healed = [room.structuralHp, data.roomHp];
        room.setRoomHpSnapshot(1000, 1000);
        triggerJudgment({ ...buildBossCtx(ds), roomGrid: ds.roomGrid.map((row, r) => row.map((d, c) => r === room.row && c === room.col ? d : null)) });
        const judgment = [room.structuralHp, data.roomHp];
        const coreBefore = ds.dungeonHp;
        ds.dungeonTrapSlots[0].hp = ds.dungeonTrapSlots[0].maxHp = 200;
        buildBattleEventCtx(ds).applyRoomSlotDamage(.5);
        const persisted = ds.dungeonTrapSlots[0].hp;
        data.monsterSlot = null; data.monsterSlots = [];
        ds.dungeonTrapSlots[0].hp = 200;
        buildBattleEventCtx(ds).applyRoomSlotDamage(.5);
        const absentWearer = ds.dungeonTrapSlots[0].hp;
        const coreAfter = ds.dungeonHp;
        data.monsterSlot = primary; data.monsterSlots = [primary, extra];
        // Actual registered swap callback, preserving the old room's extra slot.
        const otherRoom = ds.rooms.flat().find(r => r.roomData?.monsterSlot === 'village_archer');
        ds.equipmentMap.set(primary, getEquipmentStats('eq_abyss_mail'));
        ds.equipmentMap.delete(extra);
        ds.swapManager.callbacks.executeSwap(room.row, room.col, otherRoom.row, otherRoom.col);
        room.setRoomHpSnapshot(1000, 1000); otherRoom.setRoomHpSnapshot(1000, 1000);
        room.damageRoomHp(100); otherRoom.damageRoomHp(100);
        const swap = { oldHp: room.structuralHp, newHp: otherRoom.structuralHp,
          oldIds: data.monsterSlots, newIds: otherRoom.roomData.monsterSlots };
        return { initialMap, damage, timing, area, armor, stacked, healed, judgment, persisted, absentWearer, coreBefore, coreAfter, swap };
      }
    });
    check('saved equipment map', r.initialMap, [.25, .4]);
    for (const d of r.damage) {
      const mult = (d.id === 'eq_dragon_fang' ? 1.4 : 1) * (d.flags.isBoss || d.flags.isMiniBoss ? (d.id === 'eq_dragon_fang' ? 1.25 : 1.4) : 1);
      // Primary rounds damage before the equipment boss multiplier; Invader rounds the final hit.
      const expected = d.secondary ? Math.round(d.base * mult) : Math.round(Math.round(d.base * (d.id === 'eq_dragon_fang' ? 1.4 : 1)) * (d.flags.isBoss || d.flags.isMiniBoss ? (d.id === 'eq_dragon_fang' ? 1.25 : 1.4) : 1));
      check(`damage ${JSON.stringify(d)}`, d.hit, expected);
    }
    for (const t of r.timing) {
      check(`primary early ${t.speed}`, t.before, 0); check(`primary ready ${t.speed}`, t.after, t.cd + .01);
      check(`extra early ${t.speed}`, t.extraBefore, 0); check(`extra ready ${t.speed}`, t.extraAfter, t.extraCd + .01);
      check(`ring ${t.speed}`, t.ring, t.synergy / 1.2);
    }
    for (const a of r.area) { check(`${a.name} boss`, a.boss, 140); check(`${a.name} ordinary`, a.ordinary, 100); }
    const hp = { eq_spirit_robe: 915, eq_divine_aegis: 925, eq_ore_plate: 910, eq_abyss_mail: 930 };
    for (const a of r.armor) { check(a.id, a.hp, hp[a.id]); check(`${a.id} HP state`, a.dataHp, a.hp); }
    check('strongest armor', r.stacked, 930); check('heal sync', r.healed, [950, 950]); check('judgment armor and HP sync', r.judgment, [650, 650]);
    check('persistent armor', r.persisted, 130); check('absent wearer', r.absentWearer, 100); check('armor excludes core', r.coreAfter, r.coreBefore);
    check('swap old room loses armor', r.swap.oldHp, 900); check('swap new room receives armor', r.swap.newHp, 930);
    check('swap preserves extra slot', r.swap.oldIds, ['village_archer', 'dokkaebi_warrior_qa_extra']);
    check('swap replaces primary slot', r.swap.newIds, ['dokkaebi_warrior']);
    check('browser errors', errors, []);
    audit.fixture = r;
    await page.evaluate(() => window.advanceTime(1000 / 60));
    await page.screenshot({ path: `${output}/combat.png` });
    console.log(`equipment: ${audit.checks.length} checks passed`);
  } finally { await context.close(); }
  console.log('equipment: forge labels and legacy inventory');
  const { context: forgeContext, page: forgePage, errors: forgeErrors } = await openScene('DungeonHomeScene', { width: 390, height: 844 });
  try {
    await forgePage.evaluate(async () => {
      const { loadGameState, saveGameState } = await import('/src/data/wisdom.ts');
      const { BLUEPRINT_DEFS } = await import('/src/data/fusion.ts');
      const defs = Object.values(BLUEPRINT_DEFS).filter(b => ['eq_dragon_fang', 'eq_moonstone_pendant', 'eq_divine_aegis', 'eq_guardian_crown', 'eq_heavenly_blade', 'eq_arcane_core', 'eq_celestial_lance'].includes(b.resultId));
      const gs = loadGameState();
      saveGameState({ ...gs, blueprints: defs.map(b => b.id), materials: Object.fromEntries(defs.flatMap(b => Object.keys(b.materials).map(id => [id, 999]))),
        craftedEquipment: [...defs].sort((a, b) => ['eq_dragon_fang', 'eq_divine_aegis', 'eq_guardian_crown', 'eq_moonstone_pendant', 'eq_heavenly_blade', 'eq_arcane_core', 'eq_celestial_lance'].indexOf(a.resultId) - ['eq_dragon_fang', 'eq_divine_aegis', 'eq_guardian_crown', 'eq_moonstone_pendant', 'eq_heavenly_blade', 'eq_arcane_core', 'eq_celestial_lance'].indexOf(b.resultId)).map(b => ({ id: b.resultId, name: b.name, type: b.type, rarity: b.rarity, emoji: b.emoji, stats: { atkMult: .4 } })),
      });
      window.__phaserGame.scene.getScenes(true).forEach(s => window.__phaserGame.scene.stop(s.scene.key));
      window.__phaserGame.scene.start('ForgeScene');
    });
    await forgePage.waitForFunction(() => window.__phaserGame.scene.isActive('ForgeScene'));
    for (const id of ['eq_dragon_fang', 'eq_moonstone_pendant', 'eq_divine_aegis', 'eq_guardian_crown', 'eq_heavenly_blade', 'eq_arcane_core', 'eq_celestial_lance']) {
      const labels = await forgePage.evaluate(async id => {
        const { BLUEPRINT_DEFS } = await import('/src/data/fusion.ts');
        const fs = window.__phaserGame.scene.getScene('ForgeScene');
        fs.children.list.filter(o => o.depth === 50 && o.type === 'Container').forEach(o => o.destroy());
        const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === id);
        fs.confirmCraft(bp.id);
        const modal = fs.children.list.find(o => o.depth === 50 && o.type === 'Container');
        if (!modal) throw new Error(`missing forge confirm ${id}`);
        modal.setAlpha(1);
        return modal.list.filter(o => typeof o.text === 'string').map(o => ({ text: o.text, x: o.getBounds().x, right: o.getBounds().right }));
      }, id);
      const expected = { eq_dragon_fang: '보스 기본피해 +25%', eq_moonstone_pendant: '기본공속 +20%', eq_divine_aegis: '천상 ATK +20%', eq_guardian_crown: '인접 ATK +25%', eq_heavenly_blade: '5타 전체 50%', eq_arcane_core: '마법 기본피해 +20%', eq_celestial_lance: '추가 마법피해 +20%' }[id];
      check(`forge ${id} current effect`, labels.some(l => l.text.includes(expected)), true);
      for (const label of labels) assert(label.x >= 0 && label.right <= 390, `forge label offscreen: ${JSON.stringify(label)}`);
      await forgePage.screenshot({ path: `${output}/forge-${id}.png` });
    }
    const detail = await forgePage.evaluate(async () => {
      const { getEquipmentDisplay } = await import('/src/ui/MonsterDetailShared.ts');
      const { loadGameState } = await import('/src/data/wisdom.ts');
      return getEquipmentDisplay(loadGameState(), 'eq_dragon_fang').desc;
    });
    check('monster detail uses current effects', detail, 'ATK +40% · 보스 기본피해 +25%');
    const inventory = await forgePage.evaluate(() => {
      const fs = window.__phaserGame.scene.getScene('ForgeScene');
      fs.children.list.filter(o => o.depth === 50 && o.type === 'Container').forEach(o => o.destroy());
      fs.activeTab = 'dismantle'; fs.drawTabBar(); fs.renderContent();
      return fs.contentContainer.list.filter(o => typeof o.text === 'string').map(o => o.text);
    });
    check('legacy inventory uses current boss effect', inventory.some(t => t.includes('보스 기본피해 +25%')), true);
    check('inventory third effect visible', inventory.some(t => t.includes('천상 ATK +20%')), true);
    check('forge browser errors', forgeErrors, []);
    await forgePage.screenshot({ path: `${output}/forge-inventory.png` });
    for (const id of ['eq_divine_aegis', 'eq_guardian_crown']) {
      await forgePage.evaluate(async id => {
        const { BLUEPRINT_DEFS } = await import('/src/data/fusion.ts');
        const fs = window.__phaserGame.scene.getScene('ForgeScene');
        fs.children.list.filter(o => o.depth === 60 && o.type === 'Container').forEach(o => o.destroy());
        fs.executeCraft(Object.values(BLUEPRINT_DEFS).find(b => b.resultId === id).id);
      }, id);
      await forgePage.waitForFunction(() => window.__phaserGame.scene.getScene('ForgeScene').children.list.some(o => o.depth === 60 && o.list?.some(t => t.text === '단조 완료')));
      const texts = await forgePage.evaluate(() => {
        const modal = window.__phaserGame.scene.getScene('ForgeScene').children.list.find(o => o.depth === 60 && o.list?.some(t => t.text === '단조 완료'));
        return modal.list.filter(o => typeof o.text === 'string').map(o => ({ text: o.text, x:o.getBounds().x, right:o.getBounds().right }));
      });
      const expected = id === 'eq_divine_aegis' ? '천상 ATK +20%' : '인접 ATK +25%';
      check(`craft complete ${id} third effect`, texts.some(t=>t.text === expected), true);
      for (const t of texts) assert(t.x >= 0 && t.right <= 390, JSON.stringify(t));
      await forgePage.screenshot({ path: `${output}/complete-${id}.png` });
    }

  } finally { await forgeContext.close(); }
} catch (error) { audit.failures.push(String(error)); console.error(error); }
finally {
  await browser.close();
  await writeFile(`${output}/audit.json`, JSON.stringify(audit, null, 2) + '\n');
}
if (audit.failures.length) process.exitCode = 1;
