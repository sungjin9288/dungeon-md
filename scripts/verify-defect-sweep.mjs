// Focused presentation wiring guard. Fresh browser saves only; Vite on :8083.
// WEB_AUDIT_HEADLESS=1 node scripts/verify-defect-sweep.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener, inventory, labelClick, logicalClick, namedCenter } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
const output = process.env.DEFECT_OUTPUT ?? 'output/playwright/defect-sweep';
await mkdir(output, { recursive: true });
const audit = { generatedAt: new Date().toISOString(), sourceHashes: {}, results: [], failures: [] };
for (const file of ['src/data/idleIncome.ts', 'src/data/production.ts', 'src/scenes/ProductionScene.ts', 'src/scenes/HomeLifecycle.ts', 'src/ui/HomeResultOverlays.ts', 'src/combat/VisualEffects.ts', 'scripts/verify-defect-sweep.mjs']) {
  audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const economy = {
  dmLevel: 30, notorietyTier: 10, wisdomTree: { goldHands: 5 },
  placedDecorations: ['golden_pot', 'bounty_totem', 'treasure_chest', 'abyss_crystal', 'void_chalice', 'abyss_obelisk'],
  productionFacilities: { mine: 4, herb_garden: 4, weavery: 4, mana_well: 4, treasury: 4 },
  facilityStaff: { treasury: 'dokkaebi_warrior' },
  dungeonSlots: [{ roomType: 'combat', building: 'guardian', monsterIds: ['village_archer'], trapIds: [], roomLevel: 2, hp: 200, maxHp: 200 }],
};
async function texts(page) {
  return page.evaluate(() => {
    const out = [];
    const visit = object => {
      if (typeof object.text === 'string' && object.visible !== false) out.push(object.text);
      object.list?.forEach(visit);
    };
    window.__phaserGame.scene.getScenes(true).forEach(s => s.children.list.forEach(visit));
    return out;
  });
}
async function clickVisibleLabel(page, label) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const state = await inventory(page);
    if (state.scenes.some(s => s.inputs.some(input => input.label?.includes(label)))) {
      await labelClick(page, label, state);
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Overlay input did not become visible: ${label}`);
}
async function run(id, scene, seed, check) {
  if (process.env.DEFECT_CASES && !process.env.DEFECT_CASES.split(',').includes(id)) return;
  const { context, page, errors } = await openScene(scene, { width: 390, height: 844 }, undefined, { seed });
  try {
    await check(page);
    const geometry = await inventory(page);
    const overflow = geometry.scenes.flatMap(s => s.fixedOverflow);
    assert.equal(overflow.length, 0, JSON.stringify(overflow));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    const screenshot = `${output}/${id}.png`;
    await page.screenshot({ path: screenshot });
    audit.results.push({ id, texts: await texts(page), screenshot, sha256: createHash('sha256').update(await readFile(screenshot)).digest('hex') });
    console.log(`${id}: PASS`);
  } catch (error) {
    audit.failures.push({ id, error: String(error), texts: await texts(page), errors });
    console.error(`${id}: ${error}`);
  } finally { await context.close(); }
}
try {
  await run('production-rates', 'ProductionScene', economy, async page => {
    let rendered = await texts(page);
    // Four material facilities with +15%; treasury ×1.5 staff ×1.15 production ×2.35 name.
    assert(rendered.includes('29.9'), 'material status rate must include decoration');
    assert(rendered.includes('1621.5'), 'treasury status rate must include all multipliers');
    assert(rendered.includes('일반 광석 +9.2 / 시간'), 'selected current rate');
    assert(rendered.includes('일반 광석 +11.5 / 시간'), 'selected next-level rate');
    assert(rendered.includes('골드 +1621.5/h'), 'treasury district tile');
    const center = await namedCenter(page, 'production-facility-treasury');
    assert(center);
    await logicalClick(page, center.x, center.y);
    rendered = await texts(page);
    assert(rendered.includes('골드 +1621.5 / 시간'), 'treasury current rate');
    assert(rendered.includes('골드 +2026.9 / 시간'), 'treasury upgrade rate');
  });
  await run('idle-total-rate', 'DungeonHomeScene', economy, async page => {
    const expected = await page.evaluate(async () => {
      const { computeIdleReward } = await import('/src/data/idleIncome.ts');
      const { showIdleIncomePanel } = await import('/src/scenes/HomeLifecycle.ts');
      const scene = window.__phaserGame.scene.getScene('DungeonHomeScene');
      const reward = computeIdleReward(scene.gs, scene.gs.lastIdleCollect + 3_600_000);
      showIdleIncomePanel(scene, reward);
      return { gold: reward.gold, rate: reward.ratePerMin };
    });
    const rendered = await texts(page);
    assert(rendered.some(t => t.startsWith(`총 ${expected.rate.toFixed(1)} 골드/분`)), 'total rate label');
    assert(rendered.includes(`+${expected.gold.toLocaleString('ko-KR')} 황금`));
    assert(expected.rate * 60 - expected.gold >= 0 && expected.rate * 60 - expected.gold < 2);
  });
  for (const [id, dmLevel, tier, xp, slots] of [
    ['level-capped', 4, 5, 400, null],
    ['level-partial-cap', 4, 3, 400, '8 → 9'],
    ['level-multiple', 1, 0, 1000, '3 → 6'],
  ]) {
    await run(id, 'DungeonHomeScene', { dmLevel, dmXP: 0, wisdomTree: { ancestorsWisdom: tier }, activeMainQuestId: '' }, async page => {
      await page.evaluate(async xp => {
        const { checkBattleReturn } = await import('/src/scenes/HomeLifecycle.ts');
        const scene = window.__phaserGame.scene.getScene('DungeonHomeScene');
        scene.registry.set('battleResult', { won: true, goldEarned: 0, dmXP: xp });
        checkBattleReturn(scene);
      }, xp);
      await page.waitForFunction(label => {
        const visit = o => o.text === label || o.list?.some(visit);
        return window.__phaserGame.scene.getScenes(true).some(s => s.children.list.some(visit));
      }, slots ? '방 확장 확인' : '성장 확인');
      await clickVisibleLabel(page, slots ? '방 확장 확인' : '성장 확인');
      await page.waitForFunction(() => {
        const visit = o => o.text?.includes('LEVEL UP') || o.list?.some(visit);
        return window.__phaserGame.scene.getScenes(true).some(s => s.children.list.some(visit));
      });
      await page.waitForTimeout(500);
      const rendered = await texts(page);
      assert(rendered.some(t => t.includes('LEVEL UP')), 'level-up overlay opened');
      assert.equal(rendered.includes('방 슬롯 해금'), Boolean(slots), 'real capped slot delta');
      if (slots) assert(rendered.includes(slots), 'all levels gained must appear in the slot range');
    });
  }
  await run('prebattle-late-pressure', 'DungeonHomeScene', economy, async page => {
    const expected = await page.evaluate(async () => {
      const { MAIN_QUESTS } = await import('/src/data/questData.ts');
      const { estimateInvasionPressure } = await import('/src/ui/PreBattleShared.ts');
      const quest = MAIN_QUESTS.find(q => q.invasionOnComplete?.id === 'INV-009');
      const game = window.__phaserGame;
      game.registry.set('invasionConfig', quest.invasionOnComplete);
      game.registry.set('questId', quest.id);
      game.scene.stop('DungeonHomeScene');
      game.scene.start('PreBattleScene');
      return estimateInvasionPressure(quest.invasionOnComplete);
    });
    await page.waitForFunction(() => window.__phaserGame.scene.isActive('PreBattleScene'));
    await page.waitForTimeout(500);
    assert.equal(expected, 12223);
    assert((await texts(page)).includes(`권장 DEF ${expected}`));
  });
  await run('wisdom-stage-label' , 'DungeonHomeScene', {}, async page => {
    await page.evaluate(async () => {
      const { showWisdomToast } = await import('/src/combat/VisualEffects.ts');
      const { getWisdomBonuses } = await import('/src/data/wisdom.ts');
      showWisdomToast(window.__phaserGame.scene.getScene('DungeonHomeScene'), getWisdomBonuses({ wisdomTree: { celestialBlood: 5 } }));
    });
    await page.waitForTimeout(400);
    const rendered = await texts(page);
    assert(rendered.some(t => t.includes('스테이지 클리어 수정 +5')));
    assert(!rendered.some(t => t.includes('웨이브 수정')));
  });
} finally {
  await browser.close();
  await writeFile(`${output}/audit.json`, JSON.stringify(audit, null, 2) + '\n');
}
if (audit.failures.length) process.exitCode = 1;
