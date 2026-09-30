import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState } from '../data/wisdom';
import type { InvasionConfig } from '../data/quests';
import { ACTIVE_SKILLS, type ActiveSkill } from '../data/barracks';
import { TRIBE_SYNERGIES } from '../data/synergy';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import {
  CASUAL,
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
  ZONE_ACCENTS,
} from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { buildStoryInvasionTarget, type StoryInvasionTarget } from '../data/battleForecast';
import { getQuest } from '../data/quests';
import { openSimulationModal } from '../ui/SimulationModal';
import {
  enemyDisplayName,
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
    // The invasion's chapter decides its core (storyInvasionDungeonHp); without
    // it every story invasion from chapter 1 to 8 fought on the same 800 HP.
    const invasionChapter = questId ? getQuest(questId)?.chapter ?? 1 : 1;
    const invasionTarget = cfg ? buildStoryInvasionTarget(cfg, invasionChapter) : null;

    // ─ Dungeon ambient ──────────────────────────────────────────────────────
    applyCasualBackground(this);

    // ─ Cancel command ───────────────────────────────────────────────────────
    const backX = 10;
    const backY = 8;
    const backW = 76;
    const backH = 44;
    const backBg = this.add.graphics();
    const drawBack = (
      fill: number = DUNGEON_UI.STONE,
      border: number = DUNGEON_UI.IRON,
    ): void => {
      backBg.clear();
      backBg.fillStyle(DUNGEON_UI.SOOT, 0.72);
      backBg.fillRoundedRect(backX + 2, backY + 3, backW, backH, 7);
      backBg.fillStyle(fill, 1);
      backBg.fillRoundedRect(backX, backY, backW, backH, 7);
      backBg.fillStyle(DUNGEON_UI.BRASS, 0.72);
      backBg.fillRect(backX, backY + 8, 3, backH - 16);
      backBg.lineStyle(1.5, border, 0.96);
      backBg.strokeRoundedRect(backX, backY, backW, backH, 7);
    };
    drawBack();
    const backBtn = this.add.text(backX + backW / 2, backY + backH / 2, '← 취소', {
      fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
    }).setOrigin(0.5);
    const backZone = this.add.zone(backX, backY, backW, backH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    backZone.on('pointerover', () => {
      backBtn.setColor(DUNGEON_UI_CSS.PARCHMENT);
      drawBack(DUNGEON_UI.STONE_RAISED, DUNGEON_UI.BRASS);
    });
    backZone.on('pointerout', () => {
      backBtn.setColor(DUNGEON_UI_CSS.TEXT);
      drawBack();
    });
    backZone.on('pointerdown', () => this.scene.start('DungeonHomeScene'));

    // ─ TOP: Invasion intelligence ───────────────────────────────────────────
    const wave1 = cfg?.waves?.[0]?.invaders ?? [];
    const visibleInvaders = wave1.slice(0, 2);
    const hiddenInvaderTypes = Math.max(0, wave1.length - visibleInvaders.length);
    const additionalWaves = Math.max(0, (cfg?.waves?.length ?? 0) - 1);
    const iY = 60;
    const iH = cfg
      ? 82 + visibleInvaders.length * 21 + (hiddenInvaderTypes > 0 ? 17 : 0) + (additionalWaves > 0 ? 17 : 0)
      : 120;
    const { panel: ig } = addFramedPanel(this, {
      x: 12,
      y: iY,
      w: CANVAS_WIDTH - 24,
      h: iH,
      radius: 8,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      borderAlpha: 0.96,
      borderWidth: 1.5,
      accentColor: ZONE_ACCENTS.invasion,
      accentAlpha: 1,
      glowColor: ZONE_ACCENTS.invasion,
      glowOpacity: 0.06,
      shadowOpacity: 0.3,
      shadowOffsetY: 3,
    });
    ig.fillStyle(DUNGEON_UI.SOOT, 0.72);
    ig.fillRoundedRect(22, iY + 55, CANVAS_WIDTH - 44, Math.max(42, iH - 67), 5);
    ig.lineStyle(1, DUNGEON_UI.IRON, 0.78);
    ig.strokeRoundedRect(22, iY + 55, CANVAS_WIDTH - 44, Math.max(42, iH - 67), 5);
    this.drawInvasionSeal(36, iY + 27);

    this.add.text(56, iY + 18, cfg?.name ?? '침공 정보 없음', {
      fontFamily: 'sans-serif', fontSize: '17px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
      stroke: '#030504', strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.add.text(56, iY + 40, `침공 작전 · ${questId || '연결된 퀘스트 없음'}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.add.text(30, iY + 67, '선봉 전력', {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.EMBER, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    let ey = iY + 88;
    visibleInvaders.forEach(({ type, count }, index) => {
      this.drawEnemyMarker(36, ey + 1, index);
      this.add.text(51, ey, `${enemyDisplayName(type)}  ×${count}`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      ey += 21;
    });
    if (hiddenInvaderTypes > 0) {
      this.add.text(51, ey, `그 외 ${hiddenInvaderTypes}개 병종`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      ey += 17;
    }
    if (additionalWaves > 0) {
      this.add.text(CANVAS_WIDTH - 30, ey, `후속 웨이브 +${additionalWaves}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    }

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
        const label = `공명 · ${TRIBE_KO[tribe] ?? tribe} ×${count}`;
        const chip = this.add.text(chipX, synY, label, {
          fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
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
      this.add.text(14, synY + 2, '활성 공명 없음', {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
      }).setOrigin(0, 0);
    }

    // ─ SKILLS: Owned active skills — tap for cooldown/desc details ──────────
    const ownedSkills = (gs.ownedActiveSkills ?? [])
      .map(id => ACTIVE_SKILLS.find(s => s.id === id))
      .filter((s): s is ActiveSkill => s != null);
    if (ownedSkills.length > 0) {
      const skillChip = this.add.text(CANVAS_WIDTH - 14, synY, `ACTIVE · 스킬 ${ownedSkills.length}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
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
    const hasBattleTarget = Boolean(invasionTarget?.stage);
    const commandStatus =
      !hasBattleTarget ? '대상 오류' :
      directive.severity === 'ready' ? '출격 가능' :
      directive.severity === 'warning' ? '보강 권장' : '위험';
    const pressureText = directive.pressure > 0
      ? `${defenseTotals.totalPower}/${directive.pressure}`
      : `${defenseTotals.totalPower}`;
    const readinessText = formatDefenseReadinessPercent(directive.readiness);
    const prestigeBattleBonus = formatPrestigeBattleBonus(gs);

    const readinessAccent = !hasBattleTarget
      ? DUNGEON_UI.EMBER
      : directive.severity === 'ready'
      ? DUNGEON_UI.JADE
      : directive.severity === 'warning'
        ? DUNGEON_UI.BRASS_BRIGHT
        : DUNGEON_UI.EMBER;
    const commandBg = this.add.graphics();
    commandBg.fillStyle(DUNGEON_UI.SOOT, 0.82);
    commandBg.fillRoundedRect(12, commandY + 3, CANVAS_WIDTH - 24, commandH, 8);
    commandBg.fillStyle(DUNGEON_UI.STONE, 1);
    commandBg.fillRoundedRect(10, commandY, CANVAS_WIDTH - 20, commandH, 8);
    commandBg.fillStyle(readinessAccent, 0.94);
    commandBg.fillRect(10, commandY + 1, 3, commandH - 2);
    commandBg.lineStyle(1.5, DUNGEON_UI.IRON, 0.96);
    commandBg.strokeRoundedRect(10, commandY, CANVAS_WIDTH - 20, commandH, 8);
    commandBg.fillStyle(DUNGEON_UI.SOOT, 0.74);
    commandBg.fillRoundedRect(18, commandY + 7, CANVAS_WIDTH - 36, 18, 4);
    commandBg.lineStyle(1, readinessAccent, 0.72);
    commandBg.strokeRoundedRect(18, commandY + 7, CANVAS_WIDTH - 36, 18, 4);

    this.add.text(24, commandY + 16, '출격 명령', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5);

    this.add.text(92, commandY + 16, commandStatus, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: !hasBattleTarget ? DUNGEON_UI_CSS.EMBER :
        directive.severity === 'ready' ? DUNGEON_UI_CSS.JADE :
        directive.severity === 'warning' ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0, 0.5);

    this.add.text(CANVAS_WIDTH - 24, commandY + 16, hasBattleTarget
      ? `DEF ${pressureText} · 준비 ${readinessText}`
      : '침공 데이터 확인 필요', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(1, 0.5);

    this.addSecondaryCommand({
      x: 14,
      y: forecastY,
      w: CANVAS_WIDTH - 28,
      h: 44,
      label: '전투 예측',
      detail: '결정론적 전력 분석  ›',
      onPress: () => openSimulationModal(this, gs, invasionTarget),
    });

    const actionY = forecastY + 52;
    if (directive.actionLabel) {
      // Secondary edit/forecast actions stay quiet; launch remains the only dominant CTA.
      this.addSecondaryCommand({
        x: 14,
        y: actionY,
        w: 124,
        h: 48,
        label: getDefenseActionButtonLabel(directive),
        onPress: () => {
          if (directive.actionSlotIdx === undefined) {
            this.scene.start('DungeonHomeScene');
            return;
          }
          this.returnToDungeonRoom(directive.actionSlotIdx);
        },
      });
      addPrimaryActionButton(this, {
        x: 148,
        y: actionY,
        w: 228,
        h: 48,
        label: invasionTarget?.stage ? '침입 방어 시작' : '전투 대상 확인 필요',
        fontSize: '15px',
        fillColor: readinessAccent,
        hoverFillColor: readinessAccent,
        borderColor: directive.severity === 'danger' ? ZONE_ACCENTS.invasion : DUNGEON_UI.BRASS,
        hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
        textColor: CASUAL_CSS.WHITE,
        enabled: hasBattleTarget,
        once: true,
        onPress: () => this.launchBattle(invasionTarget, questId),
      });
    } else {
      addPrimaryActionButton(this, {
        x: CANVAS_WIDTH / 2 - 146,
        y: actionY,
        w: 292,
        h: 48,
        label: invasionTarget?.stage ? '침입 방어 시작' : '전투 대상 확인 필요',
        fillColor: readinessAccent,
        hoverFillColor: readinessAccent,
        borderColor: DUNGEON_UI.BRASS,
        hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
        textColor: CASUAL_CSS.WHITE,
        enabled: hasBattleTarget,
        once: true,
        onPress: () => this.launchBattle(invasionTarget, questId),
      });
    }

    if (prestigeBattleBonus) {
      this.add.text(CANVAS_WIDTH / 2, commandY + 143, prestigeBattleBonus, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: DUNGEON_UI_CSS.BRASS,
      }).setName('prestigeBattleBonus').setOrigin(0.5);
    }

    // Fade in
    if (!getReducedMotion()) this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private drawInvasionSeal(cx: number, cy: number): void {
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.92);
    g.fillCircle(cx, cy, 15);
    g.lineStyle(1.5, ZONE_ACCENTS.invasion, 0.92);
    g.strokeCircle(cx, cy, 15);
    g.lineStyle(2, DUNGEON_UI.EMBER, 0.95);
    g.lineBetween(cx - 7, cy - 8, cx + 7, cy + 8);
    g.lineBetween(cx + 7, cy - 8, cx - 7, cy + 8);
    g.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.94);
    g.fillCircle(cx, cy, 2.5);
  }

  private drawEnemyMarker(cx: number, cy: number, variant: number): void {
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.EMBER, 0.13);
    g.fillCircle(cx, cy, 8);
    g.lineStyle(1.5, DUNGEON_UI.EMBER, 0.9);
    g.strokeCircle(cx, cy, 8);
    if (variant % 3 === 0) {
      g.fillStyle(DUNGEON_UI.EMBER, 0.86);
      g.fillTriangle(cx, cy - 5, cx - 5, cy + 5, cx + 5, cy + 5);
    } else if (variant % 3 === 1) {
      g.lineBetween(cx - 4, cy - 5, cx + 4, cy + 5);
      g.lineBetween(cx + 4, cy - 5, cx - 4, cy + 5);
    } else {
      g.fillStyle(DUNGEON_UI.EMBER, 0.82);
      g.fillRect(cx - 4, cy - 4, 8, 8);
    }
  }

  private addSecondaryCommand(options: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly label: string;
    readonly detail?: string;
    readonly onPress: () => void;
  }): void {
    const { x, y, w, h, label, detail, onPress } = options;
    const bg = this.add.graphics();
    const draw = (active: boolean): void => {
      bg.clear();
      bg.fillStyle(active ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 0.9);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, active ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, active ? 0.88 : 0.76);
      bg.strokeRoundedRect(x, y, w, h, 6);
    };
    draw(false);
    this.add.text(x + 14, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    if (detail) {
      this.add.text(x + w - 12, y + h / 2, detail, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    } else {
      this.add.text(x + w - 12, y + h / 2, '›', {
        fontFamily: 'sans-serif', fontSize: '17px', color: DUNGEON_UI_CSS.BRASS,
      }).setOrigin(1, 0.5);
    }
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onPress);
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
