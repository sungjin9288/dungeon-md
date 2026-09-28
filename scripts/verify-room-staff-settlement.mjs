// Isolated save, real home placement inputs, injected elapsed time/storage faults.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inventory, namedCenter, namedClick, logicalClick, labelClick } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const routes = (process.env.WEB_AUDIT_ROUTES ?? 'tray,picker,assign,remove,build,upgrade').split(',');
assert(routes.every(r => ['tray','picker','assign','remove','build','upgrade'].includes(r)));
const output = process.env.WEB_AUDIT_OUTPUT ?? `output/playwright/room-staff-settlement/${Date.now()}`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/started.json`, '{}', { flag: 'wx' });
const audit = { checks: [], errors: [], failures: [], hashes: {}, captures: {}, routes, scope: 'Isolated saves. Real Home room card/tray/detail/picker pointer inputs. One-hour clock and storage fault fixtures injected after Home creation. No user save/native access.' };
const hash = data => createHash('sha256').update(data).digest('hex');
for (const path of ['src/data/roomSlotTransactions.ts', 'src/ui/DungeonPlacementTray.ts', 'src/ui/RoomPickerModals.ts', 'src/ui/RoomDetailFeedback.ts', 'src/scenes/DungeonHomeScene.ts', 'scripts/verify-room-staff-settlement.mjs', 'dist/index.html']) audit.hashes[path] = hash(await readFile(path));
const check = (id, actual, expected) => { audit.checks.push({ id, actual, expected }); assert.deepEqual(actual, expected, id); };
const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: process.env.WEB_AUDIT_MOTION === '1' ? 'no-preference' : 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => audit.errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') audit.errors.push(m.text()); });
    const capture = async name => {
      await page.screenshot({ path: `${output}/${route}-${name}.png` });
      audit.captures[`${route}-${name}`] = await inventory(page);
    };
    const snapshot = () => page.evaluate(() => {
      const s = window.__phaserGame.scene.getScene('DungeonHomeScene');
      return { saved: JSON.parse(localStorage.getItem('dungeonGameState')), live: JSON.parse(JSON.stringify(s.gs)), writes: window.__writes ?? 0, picker: Boolean(s.roomDetailState.monsterPickerContainer) };
    });
    const press = async name => {
      const c = await namedCenter(page, name); assert(c, `Missing ${name}`);
      assert(c.x >= 0 && c.x < 390 && c.y >= 0 && c.y < 844, `Offscreen ${name}`);
      await logicalClick(page, c.x, c.y);
    };
    try {
      await page.addInitScript(route => {
        if (!localStorage.getItem('dungeonGameState')) localStorage.setItem('dungeonGameState', JSON.stringify({
          tutorialStage: 99, activeMainQuestId: 'MQ-003', questProgress: { 'MQ-003': { objectives: { O1: 0 }, completed: false } },
          dmLevel: route === 'upgrade' ? 3 : 1, homeGold: 5000, lastIdleCollect: Date.now(), notorietyTier: 1,
          ownedMonsters: [{ id: 'dokkaebi_warrior', level: 1, xp: 0, skillPoints: 0, spentSkills: {} }],
          productionFacilities: { mine: 1, treasury: 1 }, facilityStaff: ['tray', 'picker'].includes(route) ? { treasury: 'dokkaebi_warrior' } : {},
          dungeonSlots: [route === 'build' ? { roomLevel: 0, monsterIds: [], trapIds: [], hp: 0, maxHp: 0 } : { roomType: 'combat', building: 'guardian', roomLevel: 1, monsterIds: route === 'remove' ? ['dokkaebi_warrior'] : [], trapIds: [], hp: 200, maxHp: 200 }],
        }));
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === 'dungeonGameState' && window.__reject) throw new DOMException('Synthetic full storage', 'QuotaExceededError');
          const result = original.call(this, key, value);
          if (key === 'dungeonGameState' && window.__count) window.__writes = (window.__writes ?? 0) + 1;
          return result;
        };
      }, route);
      await page.goto(process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8084', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
      await namedClick(page, 'home-room-card-0');
      if (route === 'build') check('undesigned room has no upgrade command', await namedCenter(page, 'placement-room-upgrade'), null);
      if (route === 'picker') {
        await labelClick(page, '상세');
        await capture('detail');
        // The directive is inside the masked detail viewport; the generic label
        // inventory excludes it. Its observed fixture position is (312, 470).
        await logicalClick(page, 312, 470);
        await page.waitForFunction(() => !!window.__phaserGame.scene.getScene('DungeonHomeScene').roomDetailState.monsterPickerContainer);
      }
      await page.evaluate(() => {
        const s = window.__phaserGame.scene.getScene('DungeonHomeScene');
        s.gs = { ...s.gs, lastIdleCollect: Date.now() - 3600000 };
        localStorage.setItem('dungeonGameState', JSON.stringify(s.gs));
        window.__count = true; window.__reject = true;
      });
      const before = await snapshot();
      const name = route === 'picker' ? 'room-picker-monster-dokkaebi_warrior' : route === 'build' ? 'placement-building-guardian' : route === 'upgrade' ? 'placement-room-upgrade' : 'placement-monster-dokkaebi_warrior';
      await press(name);
      const failed = await snapshot();
      check(`${route}: failed save unchanged`, failed.saved, before.saved);
      check(`${route}: failed live unchanged`, failed.live, before.live);
      check(`${route}: failed writes zero`, failed.writes, 0);
      check(`${route}: picker retained`, failed.picker, before.picker);
      const messages = await page.evaluate(() => {
        const found = []; const visit = o => { if (o.text) found.push(o.text); if (o.list) o.list.forEach(visit); };
        window.__phaserGame.scene.getScene('DungeonHomeScene').children.list.forEach(visit); return found;
      });
      check(`${route}: retry feedback`, messages.includes('저장 실패 · 다시 시도해주세요'), true);
      await capture('failure');
      await page.evaluate(() => { window.__reject = false; });
      await press(name); await page.waitForTimeout(500);
      const after = await snapshot(), s = after.saved;
      const hours = (s.lastIdleCollect - before.saved.lastIdleCollect) / 3600000;
      check(`${route}: clock advanced`, hours >= 1 && hours < 1.1, true);
      const old = before.saved, built = old.dungeonSlots.filter(slot => slot.roomType);
      const guardians = built.reduce((n, slot) => n + slot.monsterIds.filter(Boolean).length, 0) + Object.keys(old.facilityStaff).length;
      const rawRate = built.length ? 1 + 3 * built.length + 2 * built.reduce((n, slot) => n + Math.max(0, slot.roomLevel - 1), 0) + 1.5 * guardians : 0;
      const treasuryRate = old.facilityStaff.treasury ? 150 : 100;
      const paid = Math.floor(rawRate * (1 + old.dmLevel * 0.04) * 60 * hours + 1e-9) + Math.floor(treasuryRate * hours + 1e-9);
      check(`${route}: old-rate gold minus command cost`, s.homeGold - old.homeGold, paid - (route === 'upgrade' ? 150 : 0));
      check(`${route}: ore paid`, (s.materials.common_ore ?? 0) - (before.saved.materials.common_ore ?? 0), Math.floor(2 * hours + 1e-9));
      check(`${route}: staffing removed`, s.facilityStaff, {});
      if (route === 'build') check('room constructed', s.dungeonSlots[0].building, 'guardian');
      else if (route === 'upgrade') check('room upgraded once', s.dungeonSlots[0].roomLevel, 2);
      else if (route === 'remove') check('guardian removed', s.dungeonSlots[0].monsterIds.filter(Boolean), []);
      else check(`${route}: guardian placed`, s.dungeonSlots[0].monsterIds[0], 'dokkaebi_warrior');
      check(`${route}: one successful write`, after.writes, 1);
      check(`${route}: memory equals saved`, after.live, s);
      await capture('success');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
      const loaded = (await snapshot()).saved;
      check(`${route}: reload preserves result`, [loaded.homeGold, loaded.materials, loaded.facilityStaff, loaded.dungeonSlots, loaded.lastIdleCollect, loaded.idleRemainder], [s.homeGold, s.materials, s.facilityStaff, s.dungeonSlots, s.lastIdleCollect, s.idleRemainder]);
    } catch (e) { await capture('unexpected').catch(() => {}); throw e; }
    finally { await context.close(); }
  }
  check('browser errors', audit.errors, []);
} catch (e) { audit.failures.push(String(e)); console.error(e); }
finally { await browser.close(); await writeFile(`${output}/audit.json`, `${JSON.stringify(audit, null, 2)}\n`); }
console.log(`Room staffing settlement: ${audit.checks.length} checks, ${audit.failures.length} failures; ${output}`);
if (audit.failures.length) process.exitCode = 1;
