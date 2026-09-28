// Section 3-4: isolated purchases, mixed-slot display, prestige and actual core HP.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = 'output/playwright/wisdom-overflow';
await mkdir(output, { recursive: true });
const audit = { checks: [], failures: [], sourceHashes: {}, scope: 'Isolated saved fixtures, UI purchases and live core HP; not campaign balance evidence' };
for (const file of ['src/data/wisdom.ts','src/ui/AncestralWisdomShared.ts','src/scenes/AncestralWisdomScene.ts','src/scenes/DungeonScene.ts','src/combat/VisualEffects.ts','scripts/verify-wisdom-overflow.mjs']) audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const browser = await chromium.launch({ headless: true });
const open = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
const check = (id, actual, expected) => { audit.checks.push({id, actual, expected}); assert.deepEqual(actual, expected, id); };
try {
  const { context, page, errors } = await open('AncestralWisdomScene', {width:390,height:844}, undefined,
    {seed:{dmLevel:8,soulCrystals:145,wisdomTree:{ancestorsWisdom:0}}});
  try {
    const press = async name => {
      await page.evaluate(name => {
        const scene=window.__phaserGame.scene.getScene('AncestralWisdomScene');
        let found; const visit=obj=>{if(obj.name===name)found=obj;if(Array.isArray(obj.list))obj.list.forEach(visit);};
        scene.children.list.forEach(visit); if(!found?.input?.enabled)throw new Error(`Missing enabled ${name}`);
        found.emit('pointerdown');
      },name); await page.waitForTimeout(350);
    };
    const texts = () => page.evaluate(() => {
      const list=[];const visit=o=>{if(typeof o.text==='string')list.push(o.text);if(Array.isArray(o.list))o.list.forEach(visit);};
      window.__phaserGame.scene.getScene('AncestralWisdomScene').children.list.forEach(visit);return list;
    });
    const select = async()=>{await press('wisdom-lineage-conquest');await press('wisdom-branch-ancestorsWisdom');};
    const saved = ()=>page.evaluate(async()=>{
      const {loadGameState,getWisdomBonuses,getUnlockedSlotCount}=await import('/src/data/wisdom.ts');const s=loadGameState();
      return {tier:s.wisdomTree.ancestorsWisdom,crystals:s.soulCrystals,slots:getUnlockedSlotCount(s),hp:getWisdomBonuses(s).dungeonMaxHpBonus};
    });
    await select();
    check('DM8 next HP label',(await texts()).includes('다음 · 방 슬롯 +0 · 던전 HP +20'),true);
    await page.screenshot({path:`${output}/capped-before.png`});
    await press('wisdom-upgrade');
    check('confirm states real effect',(await texts()).includes('해방 · 방 슬롯 +0 · 던전 HP +20'),true);
    await page.screenshot({path:`${output}/confirm.png`});
    await press('wisdom-confirm');
    check('first purchase',{...(await saved())},{tier:1,crystals:140,slots:9,hp:20});
    for(let tier=2;tier<=5;tier++){await press('wisdom-upgrade');await press('wisdom-confirm');}
    check('full purchase',{...(await saved())},{tier:5,crystals:0,slots:9,hp:100});
    await page.screenshot({path:`${output}/capped-max.png`});
    // Scene reentry reads the persisted purchase without reseeding browser storage.
    await page.evaluate(()=>window.__phaserGame.scene.getScene('AncestralWisdomScene').scene.restart());
    await page.waitForTimeout(350);
    check('scene reentry preserves purchase',await saved(),{tier:5,crystals:0,slots:9,hp:100});
    await page.evaluate(async()=>{
      const {loadGameState,saveGameState}=await import('/src/data/wisdom.ts');
      saveGameState({...loadGameState(),dmLevel:5,soulCrystals:100,wisdomTree:{ancestorsWisdom:3}});
      window.__phaserGame.scene.getScene('AncestralWisdomScene').scene.restart();
    });await page.waitForTimeout(250);await select();
    check('mixed current',(await texts()).includes('현재 · 방 슬롯 +3 · 던전 HP +0'),true);
    check('mixed next',(await texts()).includes('다음 · 방 슬롯 +3 · 던전 HP +20'),true);
    await page.screenshot({path:`${output}/mixed.png`});
    await press('wisdom-upgrade');
    await page.evaluate(async()=>{const {loadGameState,saveGameState}=await import('/src/data/wisdom.ts');saveGameState({...loadGameState(),dmLevel:8});});
    await press('wisdom-confirm');
    check('changed effect rejected',await saved(),{tier:3,crystals:100,slots:9,hp:60});
    check('changed effect receipt',(await texts()).some(t=>t.includes('저장 상태 변경 감지')),true);
    const startBattle = async(tier,prestige=false)=>{
      await page.evaluate(async({tier,prestige})=>{
        const {loadGameState,saveGameState,startPrestige}=await import('/src/data/wisdom.ts');
        let s={...loadGameState(),dmLevel:8,wisdomTree:{ancestorsWisdom:tier,ironWalls:5,dungeonFortress:5}};
        if(prestige)s=startPrestige(s);saveGameState(s);
        const g=window.__phaserGame;g.scene.getScenes(true).forEach(s=>g.scene.stop(s.scene.key));g.registry.set('stageConfig',{stageNumber:1});g.scene.start('DungeonScene');
      },{tier,prestige});
      await page.waitForFunction(()=>window.__phaserGame.scene.isActive('DungeonScene')&&window.__phaserGame.scene.getScene('DungeonScene').roomGrid.length > 0);
      return page.evaluate(()=>{const ds=window.__phaserGame.scene.getScene('DungeonScene');return {hp:ds.maxHp,extra:ds.wisdomBonuses.extraSlots,bonus:ds.wisdomBonuses.dungeonMaxHpBonus,fortress:ds.wisdomBonuses.fortressHp,decor:ds.decorationBonuses.dungeonHpPct};});
    };
    const base=await startBattle(0), overflow=await startBattle(5), prestige=await startBattle(5,true);
    check('fixture decoration baseline',base.decor,0);
    check('live core HP adds overflow',overflow.hp-base.hp,100);
    check('live bonuses compose',[overflow.bonus,overflow.fortress,overflow.extra],[200,250,0]);
    check('prestige core HP retained',prestige.hp,overflow.hp);
    check('prestige saved effect',(await saved()).hp,200);
    check('browser errors',errors,[]);
  }finally{await context.close();}
}catch(error){audit.failures.push(String(error));console.error(error);}
finally{await browser.close();await writeFile(`${output}/audit.json`,JSON.stringify(audit,null,2)+'\n');}
console.log(`wisdom overflow: ${audit.checks.length} checks, ${audit.failures.length} failures`);
if(audit.failures.length)process.exitCode=1;
