// Run with Vite on :8083. Uses only fresh browser saves and writes QA artifacts.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const base = `${process.env.GAME_URL ?? 'http://127.0.0.1:8083'}/?skipTutorial=1&scene=DungeonHomeScene`;
const report = { generatedAt: new Date().toISOString(), sourceHashes: {}, screenshots: [], viewports: [], definitions: [], races: [], lifecycle: [], errors: [] };
for (const file of ['src/scenes/CinematicScene.ts', 'src/data/cinematics.ts', 'src/data/storyTransactions.ts', 'scripts/verify-cinematic.mjs']) {
  report.sourceHashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
}
async function screenshot(page, name) {
  const relative = `tools/screenshots/cinematic-${name}.png`;
  await page.screenshot({ path: path.join(root, relative) });
  const png = await readFile(path.join(root, relative));
  report.screenshots.push({ path: relative, sha256: createHash('sha256').update(png).digest('hex'), width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
}
async function open(motion, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: motion });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', e => { if(e.type()==='error') report.errors.push(e.text()); });
  await page.goto(base);
  await page.waitForFunction(() => window.__phaserGame?.scene.isActive('DungeonHomeScene'));
  await page.waitForTimeout(360);
  await page.evaluate(() => {
    const game=window.__phaserGame;
    game.scene.getScenes(true).forEach(s=>game.scene.stop(s.scene.key));
    window.__routes=[];
    window.__nextData={ marker:'cinematic-context', nested:{ wave:19 } };
    game.scene.add('CinematicAuditNext', { create(data) { window.__routes.push({data,same:data===window.__nextData}); } });
    window.__writes=0;
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value) { if(key==='dungeonGameState') window.__writes++; return original.call(this,key,value); };
  });
  return {context,page};
}
async function start(page,id,next='CinematicAuditNext') {
  await page.evaluate(({id,next})=>{
    const game=window.__phaserGame;
    game.scene.getScenes(true).forEach(s=>game.scene.stop(s.scene.key));
    game.scene.start('CinematicScene',{cinematicId:id,nextScene:next,nextData:window.__nextData});
  },{id,next});
  await page.waitForTimeout(170);
}
async function state(page) {
  return page.evaluate(()=>{
    const s=window.__phaserGame.scene.getScene('CinematicScene');
    const objects=[];
    function walk(o){objects.push(o); if(o.list) o.list.forEach(walk);}
    s.children.list.forEach(walk);
    const texts=objects.filter(o=>typeof o.text==='string'&&o.visible).map(o=>({name:o.name,text:o.text,size:parseFloat(o.style.fontSize),...o.getBounds()}));
    const inputs=objects.filter(o=>o.input?.enabled).map(o=>({name:o.name,...o.getBounds()}));
    const overlaps=[];
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
      const a=texts[i],b=texts[j];
      if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1) overlaps.push([a.text,b.text]);
    }
    return {phase:s.phase,index:s.lineIndex,speaker:s.speakerText?.text,dialogue:s.dialogueText?.text,emojiX:s.speakerEmoji?.x,active:window.__phaserGame.scene.isActive('CinematicScene'),timers:s.time._active.length,tweens:s.tweens.getTweens().length,children:s.children.list.length,inputs,texts,overlaps,overflow:texts.filter(t=>t.x<0||t.y<0||t.x+t.width>390||t.y+t.height>844),sub11:texts.filter(t=>t.size<11),smallTargets:inputs.filter(t=>t.width<44||t.height<44),routes:window.__routes,writes:window.__writes};
  });
}
async function click(page,x=195,y=763,delay=195) { await page.mouse.click(x,y); await page.waitForTimeout(delay); }
try {
  await mkdir(path.join(root, 'tools/screenshots'), { recursive: true });
  for(const motion of ['reduce','no-preference']) {
    const {context,page}=await open(motion);
    const defs=await page.evaluate(async()=>(await import('/src/data/cinematics.ts')).CINEMATICS);
    for(const def of defs){
      const before = await page.evaluate(() => ({ writes: window.__writes, routes: window.__routes.length }));
      await start(page,def.id);
      const entered=await page.evaluate(()=>({save:localStorage.getItem('dungeonGameState'),writes:window.__writes}));
      assert.equal(entered.writes, before.writes + 1, 'unseen cinematic writes once on entry');
      assert.equal(JSON.parse(entered.save).cinematicSeen.filter(id => id === def.id).length, 1);
      const reached=[];
      for(let i=0;i<def.lines.length;i++) {
        if(motion==='no-preference') await click(page);
        const s=await state(page),line=def.lines[i];
        assert.equal(s.index,i,`${motion}/${def.id} index`);
        assert.equal(s.dialogue,line.text,`${motion}/${def.id}/${i} text`);
        assert.equal(s.speaker,line.speaker);
        assert.equal(s.emojiX,line.side==='left'?126:264);
        assert.deepEqual(s.overlaps,[]); assert.deepEqual(s.overflow,[]); assert.deepEqual(s.sub11,[]); assert.deepEqual(s.smallTargets,[]);
        reached.push({index:i,side:line.side,pause:line.pause??0});
        if(motion==='reduce'&&def.id==='ch1_opening'&&(i===0||i===2)) await screenshot(page, `${i===0?'left':'right'}-final-390x844`);
        if(motion==='reduce'&&def.id==='void_sovereign_boss_intro'&&i===4) await screenshot(page, 'finale-final-390x844');
        await click(page,195,763,motion==='reduce'?160:310);
      }
      const ended=await page.evaluate(()=>({save:localStorage.getItem('dungeonGameState'),writes:window.__writes,routes:window.__routes}));
      assert.equal(entered.save,ended.save); assert.equal(entered.writes,ended.writes);
      assert.equal(ended.routes.at(-1).same,true);
      assert.equal(ended.routes.length, before.routes + 1, 'one destination launch per completed cinematic');
      report.definitions.push({motion,id:def.id,reached,seenOnceOnEntry:true,saveNeutralAfterEntry:true,nextDataIdentity:true,routeCount:ended.routes.length-before.routes});
    }
    if (motion === 'no-preference') {
      await start(page, 'ch1_opening');
      await page.waitForTimeout(defs[0].lines[0].text.length * 28 + 120);
      const natural = await state(page);
      assert.equal(natural.phase, 'ready');
      assert.equal(natural.dialogue, defs[0].lines[0].text);
      assert.equal(natural.timers, 0);
      report.races.push({ motion, naturalTypewriterCompletion: true });
    }
    // Manual advance cancels a pending pause from the previous line.
    await start(page,'death_emissary_boss_intro');
    await page.evaluate(()=>window.__phaserGame.scene.getScene('CinematicScene').showLine(2));
    await page.waitForTimeout(150);
    if(motion==='no-preference')await click(page);
    await click(page,195,763,motion==='reduce'?170:310);
    let s=await state(page);assert.equal(s.index,3);
    if(motion==='no-preference')assert.equal(s.phase,'typing');
    await page.waitForTimeout(260);
    s=await state(page);assert.equal(s.active,true);assert.equal(s.index,3);
    report.races.push({motion,manualCancelsPreviousPause:true});
    // Two same-frame advance events admit one line; skip cancels its transition.
    await start(page,'ch1_opening');
    if(motion==='no-preference')await click(page);
    await page.evaluate(()=>{ const s=window.__phaserGame.scene.getScene('CinematicScene'); s.onTap();s.onTap(); });
    await page.waitForTimeout(170);
    assert.equal((await state(page)).index,1);
    await page.evaluate(()=>{const s=window.__phaserGame.scene.getScene('CinematicScene');s.finish();s.finish();s.onTap();});
    await page.waitForTimeout(230);
    assert.equal((await state(page)).active,false);
    report.races.push({motion,duplicateAdvanceAndFinish:true});
    // Auto-pause naturally routes once, without manual final advance.
    await start(page,'stage10_boss_intro');
    if(motion==='no-preference')await click(page);
    await click(page,195,763,motion==='reduce'?160:310);
    if(motion==='no-preference')await click(page);
    const beforeRoutes=await page.evaluate(()=>window.__routes.length);
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(()=>window.__routes.length),beforeRoutes+1);
    assert.equal((await state(page)).active,false);
    report.races.push({motion,autoPauseRoutesOnce:true});
    // Early skip must cancel typing and pending callbacks.
    await start(page,'ch1_opening');
    const count=await page.evaluate(()=>window.__routes.length);
    await click(page,318,49,220);
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(()=>window.__routes.length),count+1);
    assert.equal((await state(page)).timers,0);
    for(let i=0;i<3;i++){
      const writes = await page.evaluate(() => window.__writes);
      await start(page,'ch1_opening');
      assert.equal(await page.evaluate(() => window.__writes), writes, 'seen restart must not save again');
      if(motion==='no-preference')await click(page);
      const snap=await state(page);
      report.lifecycle.push({motion,cycle:i,children:snap.children,inputs:snap.inputs.length,timers:snap.timers,tweens:snap.tweens});
    }
    const save=await page.evaluate(()=>localStorage.getItem('dungeonGameState'));
    await start(page,'missing-definition');
    assert.equal(await page.evaluate(()=>localStorage.getItem('dungeonGameState')),save);
    assert.equal((await state(page)).active,false);
    await page.evaluate(()=>{
      const game=window.__phaserGame;game.scene.getScenes(true).forEach(s=>game.scene.stop(s.scene.key));game.scene.start('CinematicScene', {});
    });
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(()=>window.__phaserGame.scene.isActive('StageSelectScene')),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('dungeonGameState')),save);
    report.races.push({motion,earlySkip:true,missingDefinitionAndData:true});
    await context.close();
  }
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const { context, page } = await open('reduce', viewport);
    await start(page, 'ch1_opening');
    for (const index of [0, 2]) {
      await page.evaluate(index => window.__phaserGame.scene.getScene('CinematicScene').showLine(index), index);
      await page.waitForTimeout(140);
      const snap = await state(page);
      assert.deepEqual(snap.overlaps, []); assert.deepEqual(snap.overflow, []);
      assert.deepEqual(snap.sub11, []); assert.deepEqual(snap.smallTargets, []);
      const canvas = await page.locator('canvas').boundingBox();
      report.viewports.push({ viewport, index, canvas, logicalScale: canvas.width / 390, textCount: snap.texts.length, dialogueSize: snap.texts.find(t => t.name === 'cinematic-dialogue').size, inputs: snap.inputs, overflow: snap.overflow, overlaps: snap.overlaps });
      if (viewport.width !== 390) await screenshot(page, `${index === 0 ? 'left' : 'right'}-final-${viewport.width}x${viewport.height}`);
    }
    await context.close();
  }
  // A truly fresh SceneManager has no retained cinematic payload.
  const fresh = await open('reduce');
  await fresh.page.evaluate(() => window.__phaserGame.scene.start('CinematicScene'));
  await fresh.page.waitForTimeout(220);
  assert.equal(await fresh.page.evaluate(() => window.__phaserGame.scene.isActive('StageSelectScene')), true);
  assert.equal(await fresh.page.evaluate(() => window.__writes), 0);
  await fresh.context.close();
  report.races.push({ freshMissingPayload: true, seenSaveNeutral: true });
  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(path.join(root, 'tools/cinematic-audit.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, definitions: report.definitions.length,
  reachedLines: report.definitions.reduce((sum, def) => sum + def.reached.length, 0),
  viewports: report.viewports.length, races: report.races, lifecycle: report.lifecycle,
  errors: report.errors, failure: report.failure }, null, 2));

