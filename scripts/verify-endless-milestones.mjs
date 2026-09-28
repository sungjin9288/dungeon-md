// Isolated live Phaser queue/carry/reset fixtures; no organic endurance claim.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = 'output/playwright/endless-milestones';
await mkdir(output, { recursive: true });
const audit = { checks: [], failures: [], sourceHashes: {}, scope: 'Live queue history, HP dispatch and new-run reset; isolated fixtures' };
for (const file of ['src/data/endlessWave.ts','src/combat/WaveStart.ts','src/combat/DungeonSceneCtx.ts','src/scenes/DungeonScene.ts','src/combat/SpawnPipeline.ts','src/combat/spawnDefResolve.ts','scripts/verify-endless-milestones.mjs']) audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const browser = await chromium.launch({headless:true});
const open = createSceneOpener({browser,base:process.env.WEB_AUDIT_URL??'http://127.0.0.1:8083'});
try {
  const {page,context,errors}=await open('DungeonHomeScene',{width:390,height:844});
  try {
    await page.evaluate(()=>{const g=window.__phaserGame;g.scene.stop('DungeonHomeScene');g.registry.set('stageConfig',{stageNumber:0,endless:true,slots:9});g.scene.start('DungeonScene');});
    await page.waitForFunction(()=>window.__phaserGame.scene.isActive('DungeonScene')&&window.__phaserGame.scene.getScene('DungeonScene').roomGrid.length>0);
    const checks=await page.evaluate(async()=>{
      const {spawnInvaderWithDef}=await import('/src/combat/SpawnPipeline.ts');
      const {buildSpawnPipelineCtx}=await import('/src/combat/DungeonSceneCtx.ts');
      const game=window.__phaserGame;const ds=game.scene.getScene('DungeonScene');
      const checks=[];const check=(id,actual,expected)=>checks.push({id,actual,expected});
      const sum=()=>ds.spawnQueue.reduce((n,e)=>n+e.def.hp,0);
      ds.registry.set('endlessModifier','armored');
      check('new run history zero',ds.endlessPreviousWaveHp,0);
      ds.wave=8;ds.waveActive=false;ds.startWave();
      const wave9=sum();check('wave9 history captured before dispatch',ds.endlessPreviousWaveHp,wave9);
      ds.waveActive=false;ds.startWave();
      check('wave10 exceeds actual prior queue',sum()>=Math.ceil(wave9*1.12),true);
      check('wave10 history stores corrected total',ds.endlessPreviousWaveHp,sum());
      // Force a known high prior total to exercise the deficit branch independent of RNG.
      ds.wave=9;ds.endlessPreviousWaveHp=1e6;ds.waveActive=false;ds.startWave();
      check('live adapter passes prior HP',sum(),1120000);
      const champion=ds.spawnQueue[0].def;
      spawnInvaderWithDef(buildSpawnPipelineCtx(ds),champion);
      check('actual spawned champion HP',ds.activeInvaders.at(-1).maxHp,champion.hp);
      check('actual spawned champion reward',ds.activeInvaders.at(-1).def.reward,champion.reward);
      ds.waveActive=false;ds.startWave();
      const wave11=sum();check('ordinary wave ignores milestone floor',wave11<1120000,true);
      check('ordinary wave replaces history',ds.endlessPreviousWaveHp,wave11);
      ds.waveActive=false;ds.wave=ds.maxWave;ds.startWave();
      check('rejected wave leaves history',ds.endlessPreviousWaveHp,wave11);
      ds.wave=0;ds.waveActive=false;
      return checks;
    });
    for(const c of checks){audit.checks.push(c);assert.deepEqual(c.actual,c.expected,c.id);}
    await page.evaluate(()=>window.__phaserGame.scene.getScene('DungeonScene').scene.restart());
    await page.waitForFunction(()=>window.__phaserGame.scene.getScene('DungeonScene').endlessPreviousWaveHp===0);
    const reset=await page.evaluate(()=>window.__phaserGame.scene.getScene('DungeonScene').endlessPreviousWaveHp);
    audit.checks.push({id:'new run resets history',actual:reset,expected:0});assert.equal(reset,0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}catch(error){audit.failures.push(String(error));console.error(error);}
finally{await browser.close();await writeFile(`${output}/audit.json`,JSON.stringify(audit,null,2)+'\n');}
console.log(`endless milestones: ${audit.checks.length} checks, ${audit.failures.length} failures`);
if(audit.failures.length)process.exitCode=1;
