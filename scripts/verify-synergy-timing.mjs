// Isolated live-Phaser wiring checks, not an organic campaign/balance run.
// WEB_AUDIT_HEADLESS=1 node scripts/verify-synergy-timing.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.SYNERGY_OUTPUT ?? 'output/playwright/synergy-timing';
await mkdir(output, { recursive: true });
const audit = { generatedAt: new Date().toISOString(), scope: 'Live scene fixture checks; not campaign win-rate evidence', results: [], failures: [], sourceHashes: {} };
for (const file of ['src/data/synergy.ts', 'src/combat/SynergyManager.ts', 'src/combat/spawnDefResolve.ts', 'src/combat/SpawnPipeline.ts', 'src/combat/DungeonSceneCtx.ts', 'src/scenes/DungeonSceneVisuals.ts', 'src/scenes/DungeonScene.ts', 'src/combat/RoomMechanics.ts', 'src/combat/RoomInput.ts', 'src/combat/SkillPopup.ts', 'src/combat/SkillHUD.ts', 'src/objects/Room.ts', 'scripts/verify-synergy-timing.mjs']) {
  audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const cases = [
  ['neutral', [], 1, 1, 1],
  ['fox-moon', [['gumiho', 4], ['moonlight', 4]], 0.9, 0.8, 0.8],
  ['sea', [['sea', 4]], 0.85, 1, 1],
  ['mask-moon', [['mask', 4], ['moonlight', 4]], 1, 0.8 / 1.15, 0.8],
  ['moon-two', [['moonlight', 2]], 1, 0.9, 0.9],
  ['fox-sea', [['gumiho', 4], ['sea', 4]], 0.9 * 0.85, 1, 1],
  ['moon-six', [['moonlight', 6]], 1, 1, 1],
];
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 0.001, `${label}: ${actual} != ${expected}`);
try {
  for (const [id, tribes, move, interval, skill] of cases) {
    if (process.env.SYNERGY_CASES && !process.env.SYNERGY_CASES.split(',').includes(id)) continue;
    console.log(`${id}: opening`);
    const { context, page, errors } = await openScene('DungeonHomeScene', { width: 390, height: 844 });
    try {
      console.log(`${id}: seeding`);
      await page.evaluate(async tribes => {
        const { getMonstersForTribe } = await import('/src/data/monsters.ts');
        const { defaultOwnedMonster } = await import('/src/data/barracks.ts');
        const { loadGameState, saveGameState } = await import('/src/data/wisdom.ts');
        const roster = ['village_archer', ...tribes.flatMap(([tribe, count]) =>
          Array.from({ length: count }, (_, i) => `${getMonstersForTribe(tribe)[0].id}_qa_${i}`))];
        const gs = loadGameState();
        saveGameState({ ...gs, dmLevel: 40, gold: 99999,
          ownedMonsters: roster.map(id => ({ ...defaultOwnedMonster(id), equippedSkills: ['heavy_strike'] })),
          dungeonSlots: roster.map(id => ({ roomType: 'combat', monsterIds: [id], trapIds: [], roomLevel: 1, hp: 400, maxHp: 400 })),
        });
        const game = window.__phaserGame;
        game.scene.getScenes(true).forEach(s => game.scene.stop(s.scene.key));
        game.registry.set('stageConfig', { stageNumber: 1 });
        game.scene.start('DungeonScene');
      }, tribes);
      await page.waitForFunction(() => window.__phaserGame.scene.isActive('DungeonScene') && window.__phaserGame.scene.getScene('DungeonScene').roomGrid.flat().some(d => d?.monsterSlot === 'village_archer'));
      console.log(`${id}: probing`);
      const result = await page.evaluate(async ({ interval, skill }) => {
        const { runCombat } = await import('/src/scenes/DungeonSceneVisuals.ts');
        const { runExtraMonsterAttacks } = await import('/src/combat/RoomMechanics.ts');
        const { buildRoomMechanicsCtx } = await import('/src/combat/DungeonSceneCtx.ts');
        const { resolveMonsterAttackCooldown } = await import('/src/data/monsters.ts');
        const { INVADER_DEFS } = await import('/src/data/invaders.ts');
        const game = window.__phaserGame;
        game.loop.stop(); // Deterministic boundary probes; no concurrent RAF attacks.
        const ds = game.scene.getScene('DungeonScene');
        ds.setSpeed(1);
        const room = ds.rooms.flat().find(r => r.roomData?.monsterSlot === 'village_archer');
        const data = room.roomData;
        ds.spawnInvader('soldier'); // Real production adapter -> pipeline -> Invader tween.
        const inv = ds.activeInvaders.at(-1);
        const moveSpeed = inv.def.speed;
        const pathDuration = inv.pathTween.totalDuration;
        const pathLength = ds.invaderPath.getLength();
        inv.pathTween.pause();
        inv.setPosition(room.x, room.y);
        inv.hp = inv.maxHp = 1e9;
        ds.roomGrid.flat().forEach(d => { if (d) d.lastAttackTime = 1e9; });
        const base = data.attackCooldown;
        data.lastAttackTime = 0;
        runCombat(ds, base * interval - 0.01);
        const before = data.lastAttackTime;
        runCombat(ds, base * interval + 0.01);
        const after = data.lastAttackTime;
        // Same live adapter must affect extra-slot attacks as well.
        data.monsterSlots = [data.monsterSlot, 'village_archer_qa_extra'];
        const key = `${room.row}_${room.col}_1`;
        ds.extraMonsterCooldowns.clear();
        const extraCd = resolveMonsterAttackCooldown('village_archer', data.type) * interval;
        runExtraMonsterAttacks(buildRoomMechanicsCtx(ds), extraCd - 0.01);
        const extraBefore = ds.extraMonsterCooldowns.has(key);
        runExtraMonsterAttacks(buildRoomMechanicsCtx(ds), extraCd + 0.01);
        const extraAfter = ds.extraMonsterCooldowns.get(key);
        // Empty/trap-room cadence must not inherit guardian bonuses.
        data.monsterSlots = []; data.monsterSlot = null; data.lastAttackTime = 0;
        runCombat(ds, base - 0.01);
        const emptyBefore = data.lastAttackTime;
        data.monsterSlot = 'village_archer'; data.monsterSlots = ['village_archer'];
        // Read the interval supplied by the actual scene update to the room ring.
        let ringMult;
        const updateRing = room.updateAttackCooldown;
        room.updateAttackCooldown = (_now, mult) => { ringMult = mult; };
        ds.waveActive = true;
        ds.update(ds.time.now, 0);
        ds.waveActive = false;
        room.updateAttackCooldown = updateRing;
        const skillCases = [];
        ds.equipmentMap.set('village_archer', { skillCdMult: 0.75 });
        for (const speed of [1, 3]) {
          ds.setSpeed(speed);
          ds.skillCooldowns.clear();
          ds.skillPopup?.destroy(); ds.skillPopup = undefined;
          ds.showSkillPopup(room);
          const texts = ds.skillPopup.list.filter(o => typeof o.text === 'string').map(o => o.text);
          const readyLabel = texts.find(t => t.startsWith('준비 ·'));
          const zones = ds.skillPopup.list.filter(o => o.type === 'Zone' && o.input?.enabled);
          const now = ds.time.now;
          zones.at(-1).emit('pointerdown');
          const popupDuration = ds.skillCooldowns.get(`${room.row}_${room.col}_heavy_strike`) - now;
          ds.targetingSkillId = 'heavy_strike';
          ds.onRoomClick(room);
          const hudDuration = ds.skillHUD.cooldowns.get('heavy_strike') - now;
          const hudTotal = ds.skillHUD.cooldownDurations.get('heavy_strike');
          const targetedDuration = ds.skillCooldowns.get(`${room.row}_${room.col}_heavy_strike`) - now;
          skillCases.push({ speed, readyLabel, popupDuration, targetedDuration, hudDuration, hudTotal });
        }
        ds.setSpeed(1); ds.skillCooldowns.clear(); ds.showSkillPopup(room);
        return { moveSpeed, baseSpeed: INVADER_DEFS.soldier.speed, pathDuration, pathLength, base, before, after,
          extraBefore, extraAfter, extraCd, emptyBefore, ringMult, skillCases,
          active: ds.synergyManager.activeSynergies.map(s => [s.tribe, s.tier.count]) };
      }, { interval, skill });
      console.log(`${id}: checking`);
      assert.equal(result.moveSpeed, Math.round(result.baseSpeed * move), 'movement pipeline');
      near(result.pathDuration, result.pathLength / result.moveSpeed * 1000, 'path tween duration');
      assert.equal(result.before, 0, 'must wait before interval');
      near(result.after, result.base * interval + 0.01, 'primary interval boundary');
      assert.equal(result.extraBefore, false);
      near(result.extraAfter, result.extraCd + 0.01, 'secondary interval boundary');
      assert.equal(result.emptyBefore, 0, 'guardian bonus must not speed empty-room attacks');
      near(result.ringMult, interval, 'scene cooldown ring interval');
      for (const s of result.skillCases) {
        const expected = 8000 * 0.75 * skill / s.speed;
        near(s.popupDuration, expected, 'popup cooldown');
        near(s.targetedDuration, expected, 'targeted cooldown');
        near(s.hudDuration, expected, 'HUD ready time');
        near(s.hudTotal, expected, 'HUD arc duration');
        assert.equal(s.readyLabel, `준비 · ${Number((expected / 1000).toFixed(1))}s`);
      }
      assert.deepEqual(errors, []);
      const screenshot = `${output}/${id}.png`;
      const tooltips = await page.evaluate(() => {
        const ds = window.__phaserGame.scene.getScene('DungeonScene');
        const zones = ds.synergyManager.tooltipZones;
        // Show the final tribe tooltip only (element combo tooltips are unrelated).
        const index = ds.synergyManager.activeSynergies.length - 1;
        if (index >= 0) zones[index].emit('pointerdown');
        window.advanceTime(1000 / 60); // Render the paused fixture's final popup/tooltip.
        return ds.children.list.filter(o => o.depth === 200 && typeof o.text === 'string')
          .map(o => ({ text: o.text, x: o.getBounds().x, right: o.getBounds().right, y: o.getBounds().y, bottom: o.getBounds().bottom }));
      });
      for (const tip of tooltips) assert(tip.x >= 0 && tip.right <= 390 && tip.y >= 0 && tip.bottom <= 844, JSON.stringify(tip));
      await page.screenshot({ path: screenshot, timeout: 30000 });
      audit.results.push({ id, ...result, tooltips, screenshot });
      console.log(`${id}: PASS`);
    } catch (error) {
      audit.failures.push({ id, error: String(error), errors }); console.error(`${id}: ${error}`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/audit.json`, JSON.stringify(audit, null, 2) + '\n');
}
if (audit.failures.length) process.exitCode = 1;
