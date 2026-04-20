import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState } from '../data/wisdom';
import type { InvasionConfig } from '../data/quests';
import type { InvaderType } from '../data/invaders';
import { MONSTER_DEFS } from '../data/monsters';
import { getMonsterAtk, ACTIVE_SKILLS } from '../data/barracks';
import { MONSTER_EMOJI, MONSTER_NAME } from '../data/monsterDisplay';
import { TRIBE_SYNERGIES } from '../data/synergy';

// Map invasion invader type names → DungeonScene InvaderType
const INVASION_TYPE_MAP: Record<string, InvaderType> = {
  peasant_soldier: 'peasant',
  shield_knight:   'knight',
  shadow_thief:    'shadow_ninja',
  field_medic:     'shaman',
};

const ENEMY_EMOJI: Record<string, string> = {
  peasant_soldier: '👤', shield_knight:     '🛡️',
  shadow_thief:    '🗡️', field_medic:      '💊',
  // Chapter 8 invasion types
  void_soldier:    '🌑', abyss_berserker:   '💜',
  primordial_guard: '⛓️', primordial_titan: '🌌',
};
const ENEMY_NAME: Record<string, string> = {
  peasant_soldier:  '농민병사',    shield_knight:     '방패기사',
  shadow_thief:     '그림자도적',  field_medic:       '야전 의무병',
  // Chapter 8 invasion types
  void_soldier:     '공허 병사',   abyss_berserker:   '심연 광전사',
  primordial_guard: '원초 수문장', primordial_titan:  '원초신',
};

export class PreBattleScene extends Phaser.Scene {
  constructor() { super({ key: 'PreBattleScene' }); }

  create(): void {
    const cfg     = this.registry.get('invasionConfig') as InvasionConfig | undefined;
    const questId = this.registry.get('questId')        as string        | undefined;
    const gs      = loadGameState();

    // ─ Dark background ───────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x080400, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.lineStyle(1, 0x1a0f00, 0.5);
    for (let y = 0; y < CANVAS_HEIGHT; y += 24) bg.lineBetween(0, y, CANVAS_WIDTH, y);
    for (let x = 0; x < CANVAS_WIDTH; x += 48) bg.lineBetween(x, 0, x, CANVAS_HEIGHT);

    // ─ Back button ───────────────────────────────────────────────────────────
    const backBtn = this.add.text(14, 14, '← 취소', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#664422',
    }).setInteractive();
    backBtn.on('pointerdown', () => this.scene.start('DungeonHomeScene'));

    // ─ TOP: Invasion Info ─────────────────────────────────────────────────────
    const iY = 44, iH = cfg ? 60 + (cfg.waves[0]?.invaders.length ?? 0) * 22 + (cfg.waves.length > 1 ? 22 : 0) + 38 : 120;
    const ig = this.add.graphics();
    ig.fillStyle(0x1a0800, 1);
    ig.fillRoundedRect(12, iY, CANVAS_WIDTH - 24, iH, 8);
    ig.lineStyle(2, 0x8b0000, 0.8);
    ig.strokeRoundedRect(12, iY, CANVAS_WIDTH - 24, iH, 8);
    ig.lineStyle(1, 0x4a2200, 0.5);
    ig.lineBetween(24, iY + 66, CANVAS_WIDTH - 24, iY + 66);

    this.add.text(CANVAS_WIDTH / 2, iY + 18, `⚔️  ${cfg?.name ?? '침략'}`, {
      fontFamily: 'Georgia, serif', fontSize: '17px', color: '#ff5555', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(CANVAS_WIDTH / 2, iY + 42, `스토리 침략 — 메인 퀘스트 ${questId ?? ''}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#886644',
    }).setOrigin(0.5);

    this.add.text(22, iY + 76, '예상 적군:', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8921a',
    });

    let ey = iY + 96;
    const wave1 = cfg?.waves?.[0]?.invaders ?? [];
    wave1.forEach(({ type, count }) => {
      this.add.text(30, ey, `${ENEMY_EMOJI[type] ?? '👥'}  ${ENEMY_NAME[type] ?? type}  ×${count}`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0e6c8',
      });
      ey += 22;
    });
    if ((cfg?.waves?.length ?? 0) > 1) {
      this.add.text(30, ey, `+ ${cfg!.waves.length - 1}개 추가 웨이브`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#664422',
      });
      ey += 20;
    }
    this.add.text(CANVAS_WIDTH / 2, ey + 10, '⚠️  이 침략은 건너뛸 수 없습니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ff6655',
    }).setOrigin(0.5);

    // ─ MIDDLE: Deployed Defenders ─────────────────────────────────────────────
    const dY = iY + iH + 16, dH = 180;
    const dg = this.add.graphics();
    dg.fillStyle(0x0f0a04, 1);
    dg.fillRoundedRect(12, dY, CANVAS_WIDTH - 24, dH, 8);
    dg.lineStyle(1.5, 0xc8921a, 0.4);
    dg.strokeRoundedRect(12, dY, CANVAS_WIDTH - 24, dH, 8);
    dg.lineStyle(1, 0x3a2810, 0.5);
    dg.lineBetween(24, dY + 34, CANVAS_WIDTH - 24, dY + 34);

    this.add.text(CANVAS_WIDTH / 2, dY + 16, '배치된 수호자', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8921a', fontStyle: 'bold',
    }).setOrigin(0.5);

    const SLOTS = 3;
    const slotW = Math.floor((CANVAS_WIDTH - 48) / SLOTS);
    for (let i = 0; i < SLOTS; i++) {
      const sx = 24 + i * slotW;
      const sy = dY + 44;
      const mon = gs.ownedMonsters[i];

      dg.fillStyle(mon ? 0x2a1a08 : 0x0f0a04, 1);
      dg.fillRoundedRect(sx, sy, slotW - 6, 116, 6);
      dg.lineStyle(1, mon ? 0x664400 : 0x2a1a00, 0.5);
      dg.strokeRoundedRect(sx, sy, slotW - 6, 116, 6);

      if (mon) {
        this.add.text(sx + (slotW - 6) / 2, sy + 28, MONSTER_EMOJI[mon.id] ?? '👾', {
          fontFamily: 'sans-serif', fontSize: '26px',
        }).setOrigin(0.5);
        this.add.text(sx + (slotW - 6) / 2, sy + 64, MONSTER_NAME[mon.id] ?? mon.id, {
          fontFamily: 'Georgia, serif', fontSize: '9px', color: '#f0e6c8',
        }).setOrigin(0.5);
        this.add.text(sx + (slotW - 6) / 2, sy + 80, `Lv.${mon.level}`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#c8921a',
        }).setOrigin(0.5);
        const monDef = MONSTER_DEFS[mon.id as keyof typeof MONSTER_DEFS];
        const atk = monDef ? getMonsterAtk(monDef.baseDamage, mon.level, mon.spentSkills) : 100;
        this.add.text(sx + (slotW - 6) / 2, sy + 96, `ATK: ${atk}`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#806040',
        }).setOrigin(0.5);

        // Tap card → info popup
        const hitZone = this.add.zone(sx, sy, slotW - 6, 116).setOrigin(0).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
          this.children.getByName('monInfoOv')?.destroy();

          const ov = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
            .setName('monInfoOv').setDepth(200);
          const equippedIds = (mon.equippedSkills ?? []).slice(0, 2);
          const skillExtraH = equippedIds.length === 0 ? 0 : equippedIds.length === 1 ? 14 : 28;
          const popH = 200 + skillExtraH;
          const ovBg = this.add.graphics();
          ovBg.fillStyle(0x0f0a04, 0.96);
          ovBg.fillRoundedRect(-130, -popH / 2, 260, popH, 8);
          ovBg.lineStyle(1.5, 0xc8921a, 0.85);
          ovBg.strokeRoundedRect(-130, -popH / 2, 260, popH, 8);
          ov.add(ovBg);

          const topY = -popH / 2 + 20;
          ov.add(this.add.text(0, topY, `${MONSTER_EMOJI[mon.id] ?? '👾'}  ${MONSTER_NAME[mon.id] ?? mon.id}`, {
            fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0e6c8', fontStyle: 'bold',
          }).setOrigin(0.5));
          ov.add(this.add.text(0, topY + 28, `Lv.${mon.level}  |  ATK ${atk}`, {
            fontFamily: 'sans-serif', fontSize: '12px', color: '#c8921a',
          }).setOrigin(0.5));
          if (monDef) {
            ov.add(this.add.text(0, topY + 52, `종족: ${monDef.tribe ?? '없음'}  |  유형: ${monDef.type}`, {
              fontFamily: 'sans-serif', fontSize: '10px', color: '#886644',
            }).setOrigin(0.5));
          }
          let skillY = topY + 74;
          equippedIds.forEach(skillId => {
            const sk = ACTIVE_SKILLS.find(s => s.id === skillId);
            if (!sk) return;
            ov.add(this.add.text(0, skillY, `${sk.icon ?? '⚡'} ${sk.name}  (쿨 ${sk.cooldown}s)`, {
              fontFamily: 'sans-serif', fontSize: '10px', color: '#88aaff',
            }).setOrigin(0.5));
            skillY += 15;
            if (sk.desc) {
              ov.add(this.add.text(0, skillY, sk.desc, {
                fontFamily: 'sans-serif', fontSize: '9px', color: '#556699',
                wordWrap: { width: 230 },
              }).setOrigin(0.5));
              skillY += 14;
            }
          });
          const rarityLabels = ['일반', '고급', '희귀', '영웅', '전설'];
          const rarity = mon.rarity ?? 0;
          ov.add(this.add.text(0, skillY + 6, `희귀도: ${rarityLabels[rarity] ?? '일반'}`, {
            fontFamily: 'sans-serif', fontSize: '10px', color: rarity >= 3 ? '#ffcc44' : '#886644',
          }).setOrigin(0.5));
          ov.add(this.add.text(0, popH / 2 - 14, '탭하여 닫기', {
            fontFamily: 'sans-serif', fontSize: '9px', color: '#443322',
          }).setOrigin(0.5));

          this.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 180 });

          const dismissZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            .setOrigin(0).setInteractive().setDepth(199);
          dismissZone.once('pointerdown', () => { ov.destroy(); dismissZone.destroy(); });
        });
      } else {
        this.add.text(sx + (slotW - 6) / 2, sy + 58, '+', {
          fontFamily: 'sans-serif', fontSize: '22px', color: '#3a2810',
        }).setOrigin(0.5).setAlpha(0.4);
        this.add.text(sx + (slotW - 6) / 2, sy + 88, '빈 슬롯', {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#2a1808',
        }).setOrigin(0.5);
      }
    }

    // ─ SYNERGY: Active tribe combos from first 3 monsters ──────────────────
    const TRIBE_KO: Record<string, string> = {
      dokkaebi: '도깨비', gumiho: '구미호', sansin: '산신',
      sea: '해신', underworld: '저승', mask: '탈', moonlight: '달빛', dragon: '용',
    };
    const tribeCount: Record<string, number> = {};
    gs.ownedMonsters.slice(0, SLOTS).forEach(m => {
      const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
      const tribe = def?.tribe;
      if (tribe) tribeCount[tribe] = (tribeCount[tribe] ?? 0) + 1;
    });
    const activeSynergies = Object.entries(tribeCount).filter(([, c]) => c >= 2);
    const synY = dY + dH + 8;
    if (activeSynergies.length > 0) {
      let chipX = 14;
      activeSynergies.forEach(([tribe, count]) => {
        const label = `✨ ${TRIBE_KO[tribe] ?? tribe} ×${count}`;
        const chip = this.add.text(chipX, synY, label, {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#ffdd88',
          backgroundColor: '#2a1800', padding: { x: 8, y: 4 },
        });
        chip.setInteractive({ useHandCursor: true });
        chip.on('pointerdown', () => {
          this.children.getByName('synTooltip')?.destroy();

          const syn = TRIBE_SYNERGIES.find(s => s.tribe === tribe);
          if (!syn) return;

          const activeTier = [...syn.tiers].reverse().find(t => t.count <= count);
          const nextTiers  = syn.tiers.filter(t => t.count > count);

          const lines: string[] = [];
          if (activeTier) {
            lines.push(`✨ ${activeTier.name} (×${activeTier.count})`);
            lines.push(activeTier.desc);
          }
          if (nextTiers.length > 0) lines.push('──────────────');
          nextTiers.forEach(t => lines.push(`ⓘ ×${t.count}: ${t.name} — ${t.desc}`));

          const popH = 24 + lines.length * 18 + 10;
          const popW = 240;
          const ov = this.add.container(CANVAS_WIDTH / 2, synY - 10)
            .setName('synTooltip').setDepth(200);

          const bg = this.add.graphics();
          bg.fillStyle(0x1a1000, 0.97);
          bg.fillRoundedRect(-popW / 2, -popH, popW, popH, 6);
          bg.lineStyle(1, 0xcc9900, 0.7);
          bg.strokeRoundedRect(-popW / 2, -popH, popW, popH, 6);
          ov.add(bg);

          lines.forEach((line, i) => {
            const color = i === 0 ? '#ffdd88' : line.startsWith('ⓘ') ? '#886644' : '#ddccaa';
            const fs = i === 0 ? '12px' : '10px';
            ov.add(this.add.text(0, -popH + 14 + i * 18, line, {
              fontFamily: 'sans-serif', fontSize: fs, color,
            }).setOrigin(0.5, 0));
          });

          this.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 150 });

          const closeZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            .setOrigin(0).setInteractive().setDepth(199);
          closeZone.once('pointerdown', () => { ov.destroy(); closeZone.destroy(); });
        });
        chipX += chip.width + 8;
      });
    } else {
      this.add.text(CANVAS_WIDTH / 2, synY + 2, '시너지 없음', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#443322',
      }).setOrigin(0.5);
    }

    // ─ BOTTOM: Start Button ──────────────────────────────────────────────────
    const startY = dY + dH + 38;
    const startBtn = this.add.text(CANVAS_WIDTH / 2, startY, '⚔️   방어 시작', {
      fontFamily: 'Georgia, serif', fontSize: '17px', color: '#f0e6c8', fontStyle: 'bold',
      backgroundColor: '#8b0000', padding: { x: 36, y: 14 },
    }).setOrigin(0.5).setInteractive();

    this.tweens.add({
      targets: startBtn, alpha: { from: 0.82, to: 1.0 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    startBtn.on('pointerdown', () => this.launchBattle(cfg, questId));

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private launchBattle(cfg: InvasionConfig | undefined, questId: string | undefined): void {
    if (!cfg) return;

    // Convert InvasionConfig → StageConfig format that DungeonScene understands
    const waveSpecs = cfg.waves.map(w => ({
      wave:        w.waveNumber,
      clearReward: 120,
      invaders:    w.invaders.map(inv => ({
        // Use explicit mapping first; if missing, pass through as-is (Ch8+ types match InvaderType directly)
        type:       (INVASION_TYPE_MAP[inv.type] ?? inv.type) as InvaderType,
        count:      inv.count,
        spawnDelay: 2200,
      })),
    }));

    this.registry.set('stageConfig', {
      id:         999,
      chapter:    1,
      koreanName: cfg.name,
      dungeonHp:  800,
      startGold:  400,
      waves:      waveSpecs,
    });
    this.registry.set('returnTo',  'DungeonHomeScene');
    this.registry.set('questId',   questId ?? '');
    this.registry.remove('invasionConfig');  // don't re-trigger on restart

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene');
    });
  }
}
