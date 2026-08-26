import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState } from '../data/wisdom';
import type { InvasionConfig } from '../data/quests';
import { ACTIVE_SKILLS, type ActiveSkill } from '../data/barracks';
import { TRIBE_SYNERGIES } from '../data/synergy';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { buildStoryInvasionTarget, type StoryInvasionTarget } from '../data/battleForecast';
import { openSimulationModal } from '../ui/SimulationModal';
import {
  ENEMY_EMOJI,
  ENEMY_NAME,
  ACCENT,
  TRIBE_KO,
  getMonsterDef,
  getDefenseActionButtonLabel,
  formatDefenseReadinessPercent,
  formatPrestigeBattleBonus,
} from '../ui/PreBattleShared';
import { buildDefenseLoadout } from '../ui/PreBattleDefenseUI';
import { getReducedMotion } from '../utils/reducedMotion';

export class PreBattleScene extends Phaser.Scene {
  constructor() { super({ key: 'PreBattleScene' }); }

  create(): void {
    const cfg     = this.registry.get('invasionConfig') as InvasionConfig | undefined;
    const questId = this.registry.get('questId')        as string        | undefined;
    const gs      = loadGameState();
    const invasionTarget = cfg ? buildStoryInvasionTarget(cfg) : null;

    // ─ Dark dungeon ambient (torchlit gradient + drifting ember motes) ───────
    applyCasualBackground(this);

    // ─ Back button — cream candy pill ────────────────────────────────────────
    const backX = 10;
    const backY = 8;
    const backW = 76;
    const backH = 44;
    const backBg = this.add.graphics();
    const drawBack = (fill: number = CASUAL.PANEL, border: number = CASUAL.EDGE): void => {
      backBg.clear();
      backBg.fillStyle(CASUAL.EDGE, 1);
      backBg.fillRoundedRect(backX, backY + 3, backW, backH, 13);
      backBg.fillStyle(fill, 1);
      backBg.fillRoundedRect(backX, backY, backW, backH, 13);
      backBg.fillStyle(0xffffff, 0.12);
      backBg.fillRoundedRect(backX + 4, backY + 4, backW - 8, 7, 3);
      backBg.lineStyle(2, border, 1);
      backBg.strokeRoundedRect(backX, backY, backW, backH, 13);
    };
    drawBack();
    const backBtn = this.add.text(backX + backW / 2, backY + backH / 2, '← 취소', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5);
    const backZone = this.add.zone(backX, backY, backW, backH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    backZone.on('pointerover', () => {
      backBtn.setColor(CASUAL_CSS.INK_SOFT);
      drawBack(CASUAL.PANEL_SOFT, CASUAL.GOLD_DK);
    });
    backZone.on('pointerout', () => {
      backBtn.setColor(CASUAL_CSS.INK);
      drawBack();
    });
    backZone.on('pointerdown', () => this.scene.start('DungeonHomeScene'));

    // ─ TOP: Invasion Info ─────────────────────────────────────────────────────
    const iY = 44, iH = cfg ? 60 + (cfg.waves[0]?.invaders.length ?? 0) * 22 + (cfg.waves.length > 1 ? 22 : 0) + 38 : 120;
    const { panel: ig } = addFramedPanel(this, {
      x: 12,
      y: iY,
      w: CANVAS_WIDTH - 24,
      h: iH,
      radius: 12,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: ACCENT.coral,
      accentAlpha: 1,
      glowColor: ACCENT.coral,
      glowOpacity: 0.12,
      shadowOpacity: 0.28,
      shadowOffsetY: 4,
    });
    // soft inner cream tray under the enemy roster
    ig.fillStyle(CASUAL.PANEL_SOFT, 0.92);
    ig.fillRoundedRect(22, iY + 54, CANVAS_WIDTH - 44, Math.max(36, iH - 68), 8);
    ig.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.7);
    ig.strokeRoundedRect(22, iY + 54, CANVAS_WIDTH - 44, Math.max(36, iH - 68), 8);

    this.add.text(CANVAS_WIDTH / 2, iY + 18, `🚨  ${cfg?.name ?? '침략 알림'}`, {
      fontFamily: 'sans-serif', fontSize: '17px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(CANVAS_WIDTH / 2, iY + 42, `스토리 침략 — 메인 퀘스트 ${questId ?? ''}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(22, iY + 76, '예상 적군:', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    });

    let ey = iY + 96;
    const wave1 = cfg?.waves?.[0]?.invaders ?? [];
    wave1.forEach(({ type, count }) => {
      this.add.text(30, ey, `${ENEMY_EMOJI[type] ?? '👥'}  ${ENEMY_NAME[type] ?? type}  ×${count}`, {
        fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK, fontStyle: 'bold',
      });
      ey += 22;
    });
    if ((cfg?.waves?.length ?? 0) > 1) {
      this.add.text(30, ey, `+ ${cfg!.waves.length - 1}개 추가 웨이브`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      });
      ey += 20;
    }
    this.add.text(CANVAS_WIDTH / 2, ey + 10, '⚠️  이 침략은 건너뛸 수 없습니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5);

    // ─ MIDDLE: Dungeon defense loadout ───────────────────────────────────────
    const { defenseRooms, defenseTotals, directive, dY, dH } = buildDefenseLoadout(this, {
      gs,
      cfg,
      invasionPanelBottom: iY + iH + 16,
      onReturnToDungeonRoom: (slotIdx: number) => this.returnToDungeonRoom(slotIdx),
    });

    // ─ SYNERGY: Active tribe combos from deployed dungeon monsters ──────────
    const tribeCount: Record<string, number> = {};
    defenseRooms.flatMap(room => room.monsterIds).forEach(monsterId => {
      const def = getMonsterDef(monsterId);
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
          fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
          backgroundColor: CASUAL_CSS.PANEL_SOFT, padding: { x: 8, y: 17 },
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
          bg.fillStyle(CASUAL.PANEL, 0.97);
          bg.fillRoundedRect(-popW / 2, -popH, popW, popH, 6);
          bg.lineStyle(1, ACCENT.gold, 0.7);
          bg.strokeRoundedRect(-popW / 2, -popH, popW, popH, 6);
          ov.add(bg);

          lines.forEach((line, i) => {
            const color = i === 0 ? CASUAL_CSS.GOLD : line.startsWith('ⓘ') ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.INK;
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
      this.add.text(14, synY + 2, '시너지 없음', {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
      }).setOrigin(0, 0);
    }

    // ─ SKILLS: Owned active skills — tap for cooldown/desc details ──────────
    const ownedSkills = (gs.ownedActiveSkills ?? [])
      .map(id => ACTIVE_SKILLS.find(s => s.id === id))
      .filter((s): s is ActiveSkill => s != null);
    if (ownedSkills.length > 0) {
      const skillChip = this.add.text(CANVAS_WIDTH - 14, synY, `🎯 스킬 ×${ownedSkills.length}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
        backgroundColor: CASUAL_CSS.PANEL_SOFT, padding: { x: 8, y: 17 },
      }).setOrigin(1, 0);
      skillChip.setInteractive({ useHandCursor: true });
      skillChip.on('pointerdown', () => {
        this.children.getByName('skillTooltip')?.destroy();

        const lines: Array<{ text: string; kind: 'title' | 'name' | 'desc' }> = [
          { text: '🎯 보유 액티브 스킬', kind: 'title' },
        ];
        ownedSkills.forEach(s => {
          lines.push({ text: `${s.icon} ${s.name} · 쿨다운 ${s.cooldown}s`, kind: 'name' });
          lines.push({ text: s.desc, kind: 'desc' });
        });

        const popH = 14 + lines.length * 17 + 10;
        const popW = 260;
        const ov = this.add.container(CANVAS_WIDTH / 2, synY - 10)
          .setName('skillTooltip').setDepth(200);

        const bg = this.add.graphics();
        bg.fillStyle(CASUAL.PANEL, 0.97);
        bg.fillRoundedRect(-popW / 2, -popH, popW, popH, 6);
        bg.lineStyle(1, ACCENT.sky, 0.7);
        bg.strokeRoundedRect(-popW / 2, -popH, popW, popH, 6);
        ov.add(bg);

        lines.forEach((line, i) => {
          const color = line.kind === 'title' ? CASUAL_CSS.GOLD
            : line.kind === 'name' ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT;
          const fs = line.kind === 'title' ? '12px' : '10px';
          ov.add(this.add.text(0, -popH + 12 + i * 17, line.text, {
            fontFamily: 'sans-serif', fontSize: fs, color,
            fontStyle: line.kind === 'desc' ? 'normal' : 'bold',
          }).setOrigin(0.5, 0));
        });

        this.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 150 });

        const closeZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
          .setOrigin(0).setInteractive().setDepth(199);
        closeZone.once('pointerdown', () => { ov.destroy(); closeZone.destroy(); });
      });
    }

    // ─ BOTTOM: Battle Command Frame ──────────────────────────────────────────
    const commandY = dY + dH + 70;
    const commandH = 160;
    const forecastY = commandY + 27;
    const commandStatus =
      directive.severity === 'ready' ? '출격 가능' :
      directive.severity === 'warning' ? '보강 권장' : '위험';
    const pressureText = directive.pressure > 0
      ? `${defenseTotals.totalPower}/${directive.pressure}`
      : `${defenseTotals.totalPower}`;
    const readinessText = formatDefenseReadinessPercent(directive.readiness);
    const prestigeBattleBonus = formatPrestigeBattleBonus(gs);

    const commandBg = this.add.graphics();
    // chunky cream command tray
    commandBg.fillStyle(CASUAL.SHADOW, 0.22);
    commandBg.fillRoundedRect(10, commandY + 4, CANVAS_WIDTH - 20, commandH, 14);
    commandBg.fillStyle(CASUAL.PANEL, 1);
    commandBg.fillRoundedRect(10, commandY, CANVAS_WIDTH - 20, commandH, 14);
    commandBg.fillStyle(0xffffff, 0.14);
    commandBg.fillRoundedRect(16, commandY + 5, CANVAS_WIDTH - 32, 5, 3);
    commandBg.lineStyle(3, CASUAL.EDGE, 1);
    commandBg.strokeRoundedRect(10, commandY, CANVAS_WIDTH - 20, commandH, 14);
    // status strip (soft cream sub-band)
    commandBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    commandBg.fillRoundedRect(18, commandY + 7, CANVAS_WIDTH - 36, 15, 7);
    commandBg.lineStyle(1.5, directive.accent, 0.85);
    commandBg.strokeRoundedRect(18, commandY + 7, CANVAS_WIDTH - 36, 15, 7);

    this.add.text(24, commandY + 10, '출격 명령', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);

    this.add.text(92, commandY + 10, commandStatus, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: directive.severity === 'ready' ? CASUAL_CSS.GREEN :
        directive.severity === 'warning' ? CASUAL_CSS.GOLD : CASUAL_CSS.RED,
    }).setOrigin(0, 0.5);

    this.add.text(CANVAS_WIDTH - 24, commandY + 10, `DEF ${pressureText} · 준비 ${readinessText}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(1, 0.5);

    addPrimaryActionButton(this, {
      x: 14,
      y: forecastY,
      w: CANVAS_WIDTH - 28,
      h: 44,
      label: '⚗  전투 예측',
      fontSize: '12px',
      fillColor: CASUAL.PANEL_SOFT,
      hoverFillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      hoverBorderColor: CASUAL.GOLD_DK,
      textColor: CASUAL_CSS.INK,
      onPress: () => openSimulationModal(this, gs, invasionTarget),
    });

    const actionY = forecastY + 52;
    if (directive.actionLabel) {
      // Secondary edit/forecast actions stay quiet; launch remains the only dominant CTA.
      addPrimaryActionButton(this, {
        x: 14,
        y: actionY,
        w: 124,
        h: 48,
        label: getDefenseActionButtonLabel(directive),
        fontSize: '13px',
        fillColor: CASUAL.PANEL,
        hoverFillColor: CASUAL.PANEL_SOFT,
        borderColor: CASUAL.EDGE,
        hoverBorderColor: CASUAL.GOLD_DK,
        textColor: CASUAL_CSS.INK,
        onPress: () => {
          if (directive.actionSlotIdx === undefined) {
            this.scene.start('DungeonHomeScene');
            return;
          }
          this.returnToDungeonRoom(directive.actionSlotIdx);
        },
      });
      // primary "방어 시작" → bright candy button (GREEN normal, RED if risky)
      addPrimaryActionButton(this, {
        x: 148,
        y: actionY,
        w: 228,
        h: 48,
        label: '🛡️  방어 시작',
        fontSize: '15px',
        fillColor: directive.severity === 'danger' ? CASUAL.RED : CASUAL.GREEN,
        hoverFillColor: directive.severity === 'danger' ? CASUAL.RED : CASUAL.GREEN,
        borderColor: directive.severity === 'danger' ? CASUAL.RED_DK : CASUAL.GREEN_DK,
        hoverBorderColor: directive.severity === 'danger' ? CASUAL.RED_DK : CASUAL.GREEN_DK,
        textColor: CASUAL_CSS.WHITE,
        enabled: Boolean(invasionTarget?.stage),
        once: true,
        onPress: () => this.launchBattle(invasionTarget, questId),
      });
    } else {
      // primary "방어 시작!" → bright GREEN candy button
      addPrimaryActionButton(this, {
        x: CANVAS_WIDTH / 2 - 146,
        y: actionY,
        w: 292,
        h: 48,
        label: '🛡️   방어 시작!',
        fillColor: CASUAL.GREEN,
        hoverFillColor: CASUAL.GREEN,
        borderColor: CASUAL.GREEN_DK,
        hoverBorderColor: CASUAL.GREEN_DK,
        textColor: CASUAL_CSS.WHITE,
        enabled: Boolean(invasionTarget?.stage),
        once: true,
        onPress: () => this.launchBattle(invasionTarget, questId),
      });
    }

    if (prestigeBattleBonus) {
      this.add.text(CANVAS_WIDTH / 2, commandY + 143, prestigeBattleBonus, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: CASUAL_CSS.GOLD,
      }).setName('prestigeBattleBonus').setOrigin(0.5);
    }

    // Fade in
    if (!getReducedMotion()) this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private returnToDungeonRoom(slotIdx: number): void {
    this.registry.set('preBattleEditReturn', true);
    this.registry.set('focusRoomSlotIdx', slotIdx);
    this.scene.start('DungeonHomeScene');
  }

  private launchBattle(target: StoryInvasionTarget | null, questId: string | undefined): void {
    if (!target?.stage) return;

    this.registry.set('stageConfig', target.stage);
    this.registry.set('returnTo',  'DungeonHomeScene');
    this.registry.set('questId',   questId ?? '');
    this.registry.remove('invasionConfig');  // don't re-trigger on restart

    if (getReducedMotion()) {
      this.scene.start('DungeonScene');
      return;
    }
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene');
    });
  }
}
