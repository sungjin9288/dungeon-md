// Deterministic live-scene equipment fixtures; no campaign win-rate claim.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSceneOpener } from './lib/web-audit.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs').href);
const output = process.env.SPECIAL_OUTPUT ?? 'output/playwright/equipment-specials';
await mkdir(output, { recursive: true });
const audit = { generatedAt: new Date().toISOString(), checks: [], failures: [], sourceHashes: {} };
for (const file of ['src/data/barracks.ts','src/data/equipmentCombat.ts','src/data/equipmentAuras.ts','src/combat/EquipmentAttacks.ts','src/combat/CombatResolver.ts','src/combat/RoomMechanics.ts','src/combat/RoomTriggers.ts','src/combat/DungeonSceneCtx.ts','src/combat/WaveStart.ts','src/scenes/DungeonScene.ts','scripts/verify-equipment-specials.mjs']) audit.sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const browser = await chromium.launch({ headless: true });
try {
  const open = createSceneOpener({ browser, base: process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083' });
  const { page, context, errors } = await open('DungeonHomeScene', { width:390, height:844 });
  try {
    await page.evaluate(async () => {
      const { loadGameState, saveGameState } = await import('/src/data/wisdom.ts');
      const { defaultOwnedMonster } = await import('/src/data/barracks.ts');
      const ids = ['dokkaebi_warrior','village_archer','fire_dokkaebi'];
      saveGameState({ ...loadGameState(), dmLevel:40, ownedMonsters: ids.map(defaultOwnedMonster),
        dungeonSlots: ids.map(id => ({ roomType:'combat', monsterIds:[id], trapIds:[], roomLevel:1, hp:400, maxHp:400 })) });
      const game=window.__phaserGame; game.scene.getScenes(true).forEach(s=>game.scene.stop(s.scene.key));
      game.registry.set('stageConfig',{ stageNumber:1 }); game.scene.start('DungeonScene');
    });
    await page.waitForFunction(()=>window.__phaserGame.scene.isActive('DungeonScene') && window.__phaserGame.scene.getScene('DungeonScene').roomGrid[0]?.[0]);
    const checks = await page.evaluate(async () => {
      const { runCombat }=await import('/src/scenes/DungeonSceneVisuals.ts');
      const { runExtraMonsterAttacks }=await import('/src/combat/RoomMechanics.ts');
      const { buildRoomMechanicsCtx }=await import('/src/combat/DungeonSceneCtx.ts');
      const { resolveMonsterDef }=await import('/src/data/monsters.ts');
      const { getEquipmentStats }=await import('/src/data/barracks.ts');
      const game=window.__phaserGame; game.loop.stop(); const ds=game.scene.getScene('DungeonScene');ds.setSpeed(1);
      ds.synergyManager.activeSynergies=[];ds.waveAtkMult=1;
      const data=ds.roomGrid[0][0], room=ds.rooms[0][0], source=ds.roomGrid[0][1], distant=ds.roomGrid[0][2];
      ds.roomGrid.flat().forEach(d=>{if(d)d.lastAttackTime=1e9;});
      data.level=1;data.roomTypeDmgMult=1;data.hasFirstStrikeUsed=true;
      const spawn=(offset=0)=>{ds.spawnInvader('soldier');const inv=ds.activeInvaders.at(-1);inv.pathTween.pause();inv.setPosition(room.x+offset,room.y);inv.hp=inv.maxHp=1e9;inv.hasShield=false;return inv;};
      const target=spawn(), other=spawn(200);other.isInvisible=true;
      const checks=[]; const check=(id,actual,expected)=>checks.push({id,actual,expected});
      const hit=(wearer, secondary=false)=>{
        data.monsterSlot=secondary?'dokkaebi_warrior':wearer;
        data.monsterSlots=secondary?['dokkaebi_warrior',wearer]:[wearer];
        const before=target.hp;data.lastAttackTime=0;ds.extraMonsterCooldowns.clear();
        if(secondary)runExtraMonsterAttacks(buildRoomMechanicsCtx(ds),100000);
        else runCombat(ds,100000);
        return before-target.hp;
      };
      for(const secondary of [false,true]){
        const wearer=secondary?'dokkaebi_warrior_qa_extra':'dokkaebi_warrior';
        ds.equipmentMap.clear();ds.equipmentMap.set(wearer,getEquipmentStats('eq_heavenly_blade'));ds.equipmentAttackCounts.clear();
        const otherStart=other.hp;
        for(let i=0;i<4;i++)hit(wearer,secondary);
        check(`blade ${secondary} before fifth`,otherStart-other.hp,0);
        hit(wearer,secondary);
        check(`blade ${secondary} fifth`,otherStart-other.hp,16);
        check(`blade ${secondary} counter`,ds.equipmentAttackCounts.get(wearer),5);
        ds.equipmentMap.set(wearer,getEquipmentStats('eq_celestial_lance'));
        check(`lance ${secondary} normal`,hit(wearer,secondary),35); // round(20*1.45)+round(29*.2)
        target.isMagicImmune=true;
        check(`lance ${secondary} magic immune`,hit(wearer,secondary),29);
        target.isMagicImmune=false;
        // Magic-only boost applies to the actual resolved monster type.
        const mage=secondary?'fire_dokkaebi_qa_extra':'fire_dokkaebi';
        check(`mage type ${secondary}`,resolveMonsterDef(mage).type,'magic');
        ds.equipmentMap.clear();ds.equipmentMap.set(mage,{atkMult:.3});
        const regular=hit(mage,secondary);
        ds.equipmentMap.set(mage,getEquipmentStats('eq_arcane_core'));
        const boosted=hit(mage,secondary);
        const expected=Math.round(resolveMonsterDef(mage).baseDamage*1.3*1.2);
        check(`core ${secondary}`,boosted,expected);
        check(`core ${secondary} increased`,boosted>regular,true);
        target.isMagicImmune=true;
        check(`core ${secondary} magic immune`,hit(mage,secondary),0);
        target.isMagicImmune=false;target.magicImmuneUntil=100001;
        check(`core ${secondary} timed immune`,hit(mage,secondary),0);target.magicImmuneUntil=0;
        ds.equipmentMap.clear();ds.equipmentMap.set(wearer,getEquipmentStats('eq_arcane_core'));
        check(`core ${secondary} physical`,hit(wearer,secondary),26);
        // Both aura producers are extra-slot guardians. Identical auras do not stack.
        source.monsterSlots=[source.monsterSlot,'crown-source'];distant.monsterSlots=[distant.monsterSlot,'aegis-source'];
        ds.equipmentMap.clear();ds.equipmentMap.set('crown-source',getEquipmentStats('eq_guardian_crown'));
        check(`crown ${secondary} adjacent`,hit(wearer,secondary),25);
        source.roomHp=0;check(`crown ${secondary} destroyed`,hit(wearer,secondary),20);source.roomHp=400;
        source.monsterSlots=[source.monsterSlot];distant.monsterSlots.push('crown-source');
        check(`crown ${secondary} far`,hit(wearer,secondary),20);
        source.monsterSlots.push('crown-source');
        ds.equipmentMap.set('aegis-source',getEquipmentStats('eq_divine_aegis'));
        const celestial=secondary?'solar_warrior_qa_extra':'solar_warrior';
        const base=resolveMonsterDef(celestial).baseDamage;
        check(`auras ${secondary} compose`,hit(celestial,secondary),Math.round(base*1.25*1.2));
        source.monsterSlots.push('aegis-copy');ds.equipmentMap.set('aegis-copy',getEquipmentStats('eq_divine_aegis'));
        check(`auras ${secondary} copies`,hit(celestial,secondary),Math.round(base*1.25*1.2));
        check(`aegis ${secondary} noncelestial`,hit(wearer,secondary),25);
      }
      for (const [wearer, expected] of [['ghost_hunter',43],['mask_dancer',50]]) {
        ds.equipmentMap.clear();ds.equipmentMap.set(wearer,getEquipmentStats('eq_celestial_lance'));
        data.whirlwindHitCount=4;
        const before=other.hp;
        check(`row replacement ${wearer} primary holy`,hit(wearer),expected);
        check(`row replacement ${wearer} secondary holy`,before-other.hp,expected);
      }
      ds.equipmentMap.clear();ds.equipmentMap.set('ghost_hunter',getEquipmentStats('eq_heavenly_blade'));
      ds.equipmentAttackCounts.clear();
      for(let i=0;i<5;i++)hit('ghost_hunter');
      check('row replacement counts once per attack',ds.equipmentAttackCounts.get('ghost_hunter'),5);
      ds.equipmentMap.clear();ds.equipmentMap.set('dokkaebi_warrior',getEquipmentStats('eq_heavenly_blade'));
      ds.equipmentAttackCounts.set('dokkaebi_warrior',4);data.type='dragons_lair';target.def={...target.def,isBoss:true};
      const beforeDragon=other.hp;hit('dokkaebi_warrior');
      check('dragon boss bonus does not leak to ordinary proc target',beforeDragon-other.hp,16);
      data.type='guardian';target.def={...target.def,isBoss:false};
      // Actual wave adapter resets all wearer counters, not just the selected room.
      ds.equipmentAttackCounts.set('sentinel',4);ds.wave=0;ds.waveActive=false;ds.startWave();
      check('wave resets counters',ds.equipmentAttackCounts.size,0);
      return checks;
    });
    for(const c of checks){audit.checks.push(c);assert.deepEqual(c.actual,c.expected,JSON.stringify(c));}
    assert.deepEqual(errors,[]);console.log(`special equipment: ${checks.length} PASS`);
    await page.evaluate(()=>window.advanceTime(1000/60));await page.screenshot({path:`${output}/combat.png`});
  }finally{await context.close();}
}catch(error){audit.failures.push(String(error));console.error(error);}
finally{await browser.close();await writeFile(`${output}/audit.json`,JSON.stringify(audit,null,2)+'\n');}
if(audit.failures.length)process.exitCode=1;
