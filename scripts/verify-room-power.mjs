// Section 3-3: isolated saved fixtures, live combat and growth recommendation UI.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.ROOM_POWER_OUTPUT ?? 'output/playwright/room-power';
await mkdir(output, { recursive: true });
const audit = { checks: [], failures: [], sourceHashes: {}, scope: 'Isolated comparative power and live room-level damage; not campaign win-rate evidence' };
for (const file of ['src/data/rooms.ts', 'src/data/dungeonMetrics.ts', 'src/data/reinforcementRecommendations.ts', 'src/combat/CombatResolver.ts', 'src/combat/RoomMechanics.ts', 'src/ui/BarracksGrowthHall.ts', 'scripts/verify-room-power.mjs']) {
  audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const browser = await chromium.launch({ headless: true });
const open = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
const check = (id, actual, expected) => { audit.checks.push({ id, actual, expected }); assert.deepEqual(actual, expected, id); };
try {
  const { context, page, errors } = await open('DungeonHomeScene', { width: 390, height: 844 });
  try {
    const projections = await page.evaluate(async () => {
      const { loadGameState, saveGameState } = await import('/src/data/wisdom.ts');
      const { defaultOwnedMonster } = await import('/src/data/barracks.ts');
      const { calculateRoomMetrics, calculateDungeonMetrics } = await import('/src/data/dungeonMetrics.ts');
      const { rankGrowthRecommendations } = await import('/src/data/reinforcementRecommendations.ts');
      const ids = ['dokkaebi_warrior', 'dokkaebi_warrior_high'];
      const gs = { ...loadGameState(), dmLevel: 40, homeGold: 100, ownedEquipment: [], craftedEquipment: [],
        ownedMonsters: ids.map(id => ({ ...defaultOwnedMonster(id), xp: 80 })),
        dungeonSlots: ids.map((id, i) => ({ roomType: 'combat', monsterIds: [id], trapIds: [], roomLevel: i ? 5 : 1, hp: 450, maxHp: 450 })) };
      saveGameState(gs);
      const game = window.__phaserGame;
      game.scene.stop('DungeonHomeScene'); game.scene.start('BarracksScene');
      return { rooms: gs.dungeonSlots.map(slot => calculateRoomMetrics(gs, slot).threatScore),
        total: calculateDungeonMetrics(gs).threatScore,
        ranks: rankGrowthRecommendations(gs).map(item => ({ id: item.monsterId, delta: item.estimatedPowerDelta })) };
    });
    check('saved fixture room scores', projections.rooms, [23, 88]);
    check('dungeon score sums the same rooms', projections.total, 111);
    check('growth ranking sees Lv5 contribution', projections.ranks, [{ id: 'dokkaebi_warrior_high', delta: 4 }, { id: 'dokkaebi_warrior', delta: 1 }]);
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('BarracksScene'));
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => {
      const texts = [];
      const visit = obj => { if (typeof obj.text === 'string') texts.push(obj.text); if (Array.isArray(obj.list)) obj.list.forEach(visit); };
      window.__phaserGame.scene.getScene('BarracksScene').children.list.forEach(visit);
      return texts;
    });
    check('growth panel renders actual high-room projection', text.some(t => t.includes('전력 88→92 예상')), true);
    check('growth panel selects second room', text.some(t => t.includes('방 #2')), true);
    await page.screenshot({ path: `${output}/barracks.png` });
    await page.evaluate(() => {
      const game = window.__phaserGame;
      game.scene.stop('BarracksScene'); game.registry.set('stageConfig', { stageNumber: 1 }); game.scene.start('DungeonScene');
    });
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('DungeonScene') && window.__phaserGame.scene.getScene('DungeonScene').roomGrid[0]?.[0]);
    const hits = await page.evaluate(async () => {
      const { runCombat } = await import('/src/scenes/DungeonSceneVisuals.ts');
      const { runExtraMonsterAttacks } = await import('/src/combat/RoomMechanics.ts');
      const { buildRoomMechanicsCtx } = await import('/src/combat/DungeonSceneCtx.ts');
      const game = window.__phaserGame; game.loop.stop();
      const ds = game.scene.getScene('DungeonScene'); ds.setSpeed(1);
      ds.synergyManager.activeSynergies = []; ds.waveAtkMult = 1;
      ds.equipmentMap.clear(); ds.guardianAtkMult.clear();
      const data = ds.roomGrid[0][0], room = ds.rooms[0][0];
      ds.roomGrid.flat().forEach(d => { if (d) d.lastAttackTime = 1e9; });
      data.roomTypeDmgMult = 1; data.hasFirstStrikeUsed = true;
      ds.spawnInvader('soldier'); const target = ds.activeInvaders.at(-1);
      target.pathTween.pause(); target.setPosition(room.x, room.y); target.hp = target.maxHp = 1e9; target.hasShield = false;
      const hits = [];
      for (const secondary of [false, true]) {
        data.monsterSlots = secondary ? ['dokkaebi_warrior', 'dokkaebi_warrior_high'] : ['dokkaebi_warrior'];
        for (const level of [1, 2, 3, 4, 5]) {
          data.level = level; data.lastAttackTime = 0; ds.extraMonsterCooldowns.clear();
          const before = target.hp;
          if (secondary) runExtraMonsterAttacks(buildRoomMechanicsCtx(ds), 100000);
          else runCombat(ds, 100000);
          hits.push({ secondary, level, damage: before - target.hp });
        }
      }
      return hits;
    });
    for (const hit of hits) check(`live damage ${hit.secondary ? 'extra' : 'primary'} Lv${hit.level}`, hit.damage, [20, 28, 39, 55, 77][hit.level - 1]);
    check('browser errors', errors, []);
  } finally { await context.close(); }
} catch (error) { audit.failures.push(String(error)); console.error(error); }
finally { await browser.close(); await writeFile(`${output}/audit.json`, JSON.stringify(audit, null, 2) + '\n'); }
console.log(`room power: ${audit.checks.length} checks, ${audit.failures.length} failures`);
if (audit.failures.length) process.exitCode = 1;
