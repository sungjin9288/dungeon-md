// Nested modal / selection / result state audit.
//
// verify-web-surfaces.mjs covers each surface's INITIAL state. This script drives
// one step deeper: it opens the confirm / picker / detail / result layer that sits
// on top of a surface and measures the same geometry there.
//
// Shares scripts/lib/web-audit.mjs with the surface harness on purpose, so the
// two report overflow and touch targets against the identical 390x844 logical
// frame and stay comparable.
//
// Layout note: main.ts uses Phaser.Scale.FIT with a fixed 390x844 logical canvas,
// so a different browser viewport rescales/letterboxes but does not reflow the
// layout. Width defaults to 390 for that reason; MODAL_WIDTHS can override.
//
// npm run dev, then:
//   WEB_AUDIT_HEADLESS=1 node scripts/verify-modal-states.mjs
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createSceneOpener, inventory, labelClick, logicalClick, storage, namedCenter } from './lib/web-audit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083';
const shots = resolve(root, 'tools/screenshots');
const sha = value => createHash('sha256').update(value).digest('hex');

const widths = (process.env.MODAL_WIDTHS ?? '390').split(',').map(Number);
const viewportFor = width => ({ 360: 800, 390: 844, 430: 932 }[width] ?? 844);

/**
 * Each case opens `scene`, runs `steps`, then audits the resulting state.
 * A step addressed by `name` uses the object's explicit Phaser name; a step
 * addressed by `label` falls back to the text rendered on the control.
 */
const CASES = [
  { id: 'shop-skin-preview', scene: 'ShopScene', steps: [{ label: '미리보기' }], expect: '외형 검수대 미리보기' },
  { id: 'shop-purchase-confirm', scene: 'ShopScene', steps: [{ label: '구매' }], expect: '구매 확인' },
  { id: 'codex-monster-detail', scene: 'CodexScene', steps: [{ name: 'codex-detail-open' }], expect: '수호자 상세' },
  { id: 'codex-invader-tab', scene: 'CodexScene', steps: [{ name: 'codex-tab-invaders' }], expect: '침략자 기록' },
  { id: 'codex-lineage-pin', scene: 'CodexScene', steps: [{ name: 'codex-detail-open' }, { name: 'codex-lineage-pin' }], expect: '수호자 상세 계보 스트립 · 목표 핀 토글 후 토스트' },
  { id: 'home-lineage-goal-chip', scene: 'DungeonHomeScene', seed: { lineageGoal: 'fox_warrior' }, steps: [], expect: '홈 지시 헤더에 📌 여우 전사 목표 칩 (방 작업이 카드를 차지해도 보임)' },
  { id: 'wisdom-branch-confirm', scene: 'AncestralWisdomScene', steps: [{ name: 'wisdom-branch-goldHands' }], expect: '가지 강화 확인' },
  { id: 'achievement-record', scene: 'AchievementScene', steps: [{ name: 'achievement-record-dm_lv5' }], expect: '업적 기록 상세' },
  { id: 'abyss-floor-order', scene: 'AbyssScene', steps: [{ name: 'abyss-floor-1' }, { name: 'abyss-order' }], expect: '심연 층 지시' },
  { id: 'production-facility-order', scene: 'ProductionScene', steps: [{ name: 'production-facility-mine' }, { name: 'production-order' }], expect: '생산 지시' },
  {
    id: 'production-staff-picker', scene: 'ProductionScene', seed: { dmLevel: 10, productionFacilities: { mine: 1, treasury: 1 } },
    steps: [{ name: 'production-facility-treasury' }, { name: 'production-staff' }], expect: '근무 배정 피커 (적성 표시 · 해제/닫기)',
  },
  {
    id: 'production-staff-assigned', scene: 'ProductionScene', seed: { dmLevel: 10, productionFacilities: { mine: 1, treasury: 1 } },
    steps: [{ name: 'production-facility-treasury' }, { name: 'production-staff' }, { name: 'production-staff-dokkaebi_warrior' }], expect: '근무 배정 후 명령판 (산출 ×1.5 영수증)',
  },
  { id: 'decoration-relic-select', scene: 'DecorationScene', steps: [{ name: 'decoration-relic-golden_pot' }], expect: '유물 선택' },
  { id: 'fusion-material-picker', scene: 'FusionScene', steps: [{ label: '재료 1' }], expect: '재료 선택 피커' },
  { id: 'fusion-absorb-tab', scene: 'FusionScene', steps: [{ label: '흡수' }], expect: '흡수 탭' },
  { id: 'summon-rate-detail', scene: 'SummonScene', steps: [{ label: '확률 상세' }], expect: '확률 상세' },
  { id: 'barracks-manage', scene: 'BarracksScene', steps: [{ label: '관리' }], expect: '수호자 관리' },
  {
    id: 'barracks-bond-tab', scene: 'BarracksScene', seed: { monsterAffinity: { dokkaebi_warrior: 44 }, materials: { herb: 3 }, homeGold: 1000 },
    steps: [{ name: 'barracks-card-dokkaebi_warrior' }, { name: 'monster-detail-tab-bond' }], expect: '수호자 상세 교감 탭 (친밀도 바 · 간식/대화/합동 훈련)',
  },
  {
    id: 'barracks-bond-action', scene: 'BarracksScene', seed: { monsterAffinity: { dokkaebi_warrior: 44 }, materials: { herb: 3 }, homeGold: 1000 },
    steps: [{ name: 'barracks-card-dokkaebi_warrior' }, { name: 'monster-detail-tab-bond' }, { name: 'monster-bond-treat' }], expect: '간식 후 교감 52 · 우정 도달 · 이야기 해금 · 토스트',
  },
  { id: 'forge-disassemble-tab', scene: 'ForgeScene', steps: [{ label: '분해' }], expect: '분해 탭' },
  {
    id: 'forge-trap-tab', scene: 'ForgeScene', seed: { dmLevel: 20, materials: { iron_shard: 12, herb: 9, old_cloth: 8 }, trapStock: { spike_trap: 1, poison_trap: 1 }, trapMastery: { spike_trap: 2 } },
    steps: [{ label: '함정' }], expect: '함정 탭 (재고·숙련·제작/강화 행 3개 + 페이지)',
  },
  {
    id: 'forge-trap-fuse-result', scene: 'ForgeScene', seed: { dmLevel: 20, materials: { iron_shard: 12, herb: 9, old_cloth: 8 }, trapStock: { spike_trap: 1, poison_trap: 1 } },
    steps: [{ label: '함정' }, { label: '다음' }, { label: '다음' }, { label: '제작' }], expect: '2티어 융합(독가시 벽, 3페이지 첫 행) 후 토스트 · 재고 갱신',
  },
  // Forecast tray: the day's three visitor cards, and the same tray once the
  // name has grown enough for the sign-raising control to appear.
  { id: 'home-forecast-tray', scene: 'DungeonHomeScene', steps: [{ label: '오늘의 손님' }], expect: '오늘의 손님 카드 3장' },
  {
    id: 'home-forecast-tray-raise', scene: 'DungeonHomeScene', seed: { notoriety: 500 },
    steps: [{ label: '오늘의 손님' }], expect: '간판 올리기 버튼이 있는 손님 트레이',
  },

  // Resource-gated confirm / result layers. The default fixture holds zero
  // currency, so these seed only the resource that unlocks the gate.
  {
    id: 'shop-purchase-result', scene: 'ShopScene', seed: { gems: 5000 },
    steps: [{ label: '구매' }, { label: '구매' }], expect: '구매 확정 후 영수증',
  },
  {
    // `wisdom-upgrade` only exists once the branch is affordable, so the
    // zero-crystal fixture cannot reach this confirm layer at all.
    id: 'wisdom-upgrade-result', scene: 'AncestralWisdomScene', seed: { soulCrystals: 500 },
    steps: [{ name: 'wisdom-branch-goldHands' }, { name: 'wisdom-upgrade' }], expect: '가지 강화 확정 후 기록',
  },
  {
    // With highestFloor 5 the list pages to the frontier, so floor 6 is the
    // reachable node rather than floor 1.
    id: 'abyss-sweep-result', scene: 'AbyssScene', seed: { abyss: { highestFloor: 5, keys: 9 } },
    steps: [{ name: 'abyss-floor-6' }, { name: 'abyss-order' }], expect: '심연 소탕 영수증',
  },
];

const audit = {
  generatedAt: new Date().toISOString(), base,
  scope: `${CASES.length} nested modal/selection/result states, one step past each surface's initial state. Shares the surface harness geometry module. Not a full gameplay or campaign E2E.`,
  geometryMethod: 'scripts/lib/web-audit.mjs — world bounds transformed by the camera matrix and cumulative container scroll factors, measured against one 390x844 logical frame. Overlap candidates and 10/11px text are review candidates, not automatic failures.',
  layoutNote: 'Phaser.Scale.FIT with a fixed 390x844 logical canvas: other viewports rescale rather than reflow, so width 390 is representative for layout defects.',
  sourceHashes: {}, results: [], failures: [],
};

await mkdir(shots, { recursive: true });
for (const path of ['scripts/lib/web-audit.mjs', 'scripts/verify-modal-states.mjs']) {
  audit.sourceHashes[path] = sha(await readFile(resolve(root, path)));
}

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });

async function runStep(page, step) {
  if (step.name) {
    const state = await inventory(page);
    const input = state.scenes.flatMap(scene => scene.inputs).find(entry => entry.name === step.name);
    if (input) {
      await logicalClick(page, input.bounds.x + input.bounds.width / 2, input.bounds.y + input.bounds.height / 2);
      return;
    }
    // Inputs inside a masked viewport (the barracks roster) are not in `inputs`; click them by name.
    const center = await namedCenter(page, step.name);
    if (!center) throw new Error(`missing input name: ${step.name}`);
    await logicalClick(page, center.x, center.y);
    return;
  }
  await labelClick(page, step.label);
}

try {
  for (const width of widths) {
    const viewport = { width, height: viewportFor(width) };
    for (const testCase of CASES) {
      if (process.env.MODAL_CASES && !process.env.MODAL_CASES.split(',').includes(testCase.id)) continue;
      const { context, page, errors } = await openScene(testCase.scene, viewport, undefined, { seed: testCase.seed });
      try {
        const before = await inventory(page);
        const saveBefore = await storage(page);
        for (const step of testCase.steps) await runStep(page, step);
        const after = await inventory(page);
        const saveAfter = await storage(page);

        const screenshot = `tools/screenshots/modal-${testCase.id}-${width}x${viewport.height}.png`;
        await page.screenshot({ path: resolve(root, screenshot) });
        const png = await readFile(resolve(root, screenshot));

        const flat = key => after.scenes.reduce((sum, scene) => sum + scene[key].length, 0);
        const record = {
          id: testCase.id, scene: testCase.scene, expect: testCase.expect, viewport,
          activeScenes: after.activeScenes,
          // A modal is expected to add objects; an unchanged count means the
          // trigger did not actually open anything.
          visibleTextBefore: before.scenes.reduce((sum, scene) => sum + scene.visibleTextCount, 0),
          visibleTextAfter: after.scenes.reduce((sum, scene) => sum + scene.visibleTextCount, 0),
          inputsAfter: after.scenes.reduce((sum, scene) => sum + scene.visibleInputCount, 0),
          fixedOverflow: flat('fixedOverflow'),
          scrollBoundaryPartials: flat('scrollBoundaryPartials'),
          undersizedTargets: flat('undersizedTargets'),
          textBelow10: flat('textBelow10'),
          renderedTextBelow10: flat('renderedTextBelow10'),
          overlapCandidates: flat('overlapCandidates'),
          overflowDetail: after.scenes.flatMap(scene => scene.fixedOverflow.map(text => ({ scene: scene.scene, text: text.text, bounds: text.bounds }))),
          undersizedDetail: after.scenes.flatMap(scene => scene.undersizedTargets.map(input => ({ scene: scene.scene, label: input.label, target: input.logicalTarget }))),
          seeded: testCase.seed ? Object.keys(testCase.seed) : null,
          saveNeutral: saveBefore === saveAfter,
          errors, screenshot, sha256: sha(png),
        };
        audit.results.push(record);

        if (record.fixedOverflow || record.undersizedTargets || record.textBelow10 || errors.length) {
          audit.failures.push({ id: testCase.id, reason: 'modal state gate', fixedOverflow: record.fixedOverflow, undersizedTargets: record.undersizedTargets, textBelow10: record.textBelow10, errors });
        }
        process.stdout.write(`${testCase.id} ${width}: text ${record.visibleTextBefore}→${record.visibleTextAfter}, overflow=${record.fixedOverflow}, small=${record.undersizedTargets}, tiny=${record.textBelow10}, overlaps=${record.overlapCandidates}, errors=${errors.length}\n`);
      } catch (error) {
        audit.failures.push({ id: testCase.id, viewport, reason: String(error) });
        process.stderr.write(`${testCase.id}: ${error}\n`);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  audit.summary = {
    cases: audit.results.length,
    fixedOverflow: audit.results.reduce((sum, item) => sum + item.fixedOverflow, 0),
    undersizedTargets: audit.results.reduce((sum, item) => sum + item.undersizedTargets, 0),
    textBelow10: audit.results.reduce((sum, item) => sum + item.textBelow10, 0),
    overlapCandidates: audit.results.reduce((sum, item) => sum + item.overlapCandidates, 0),
    errors: audit.results.reduce((sum, item) => sum + item.errors.length, 0),
    hardFailures: audit.failures.length,
  };
  await writeFile(resolve(root, 'tools/modal-state-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(audit.summary)}\n`);
if (audit.failures.length) process.exitCode = 1;
