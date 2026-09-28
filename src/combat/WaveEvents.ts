/**
 * Wave event display & wave preview panel — extracted from DungeonScene.
 *
 * Each function receives a WaveEventContext that provides read/write
 * access to wave multiplier state and scene rendering capabilities.
 */
import Phaser from 'phaser';
import { rollWaveEvent, type WaveEventDef } from '../data/waveEvents';
import { INVADER_DEFS, type InvaderDef, type InvaderType } from '../data/invaders';
import type { WaveSpec } from '../data/stages';
import type { DungeonTheme } from '../themes/themes';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  COLORS,
  CASUAL,
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
} from '../constants/colors';
import { logger } from '../utils/logger';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from '../ui/GameUiPrimitives';
import { WAVE_EVENT_HEAL, waveEventMults } from './waveEventMults';
import { getReducedMotion } from '../utils/reducedMotion';

const OVERLAY_PANEL_FILL = DUNGEON_UI.STONE;
const PREVIEW_PANEL_FILL = DUNGEON_UI.STONE;
const PREVIEW_ROW_FILL = DUNGEON_UI.SOOT;

// ─── WaveEventContext ──────────────────────────────────────────────────────

export interface WaveEventContext {
  readonly scene: Phaser.Scene;
  readonly wave: number;
  readonly maxWave: number;
  readonly isEndless: boolean;
  readonly waveConfigs: WaveSpec[];
  readonly theme: DungeonTheme;
  readonly synergyHasMoonlightHealUp: boolean;
  readonly maxHp: number;
  readonly stageNumber: number;

  // wave event multiplier state (read/write)
  waveGoldMult: number;
  waveHpMult: number;
  waveAtkMult: number;
  waveSpdMult: number;
  waveFogOverlay: Phaser.GameObjects.Graphics | undefined;
  pendingWaveMults: { gold: number; hp: number; atk: number; spd: number } | undefined;
  dungeonHp: number;

  // callbacks
  startWave(): void;
  setRegistryHp(hp: number): void;
}

// ─── tryShowWaveEvent ──────────────────────────────────────────────────────

/**
 * Name of the pre-wave overlays (wave event card, scout report). One at a time:
 * a second tap on "침입 방어 개시" stacked briefings, re-rolled the wave event
 * (whose multipliers apply on show) and could start the wave twice.
 */
export const WAVE_BRIEFING_NAME = 'wave-briefing';

/** Full-screen dim that also swallows taps, so nothing under the briefing is pressed. */
function addBlockingDim(scene: Phaser.Scene, ov: Phaser.GameObjects.Container, alpha: number): Phaser.GameObjects.Graphics {
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, alpha);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  ov.add(dim);
  return dim;
}

export function tryShowWaveEvent(ctx: WaveEventContext): void {
  if (ctx.scene.children.getByName(WAVE_BRIEFING_NAME)) return;
  const nextWave = ctx.wave + 1;
  const evt = rollWaveEvent(nextWave, ctx.maxWave, ctx.stageNumber);

  if (evt) {
    showWaveEvent(ctx, evt, () => showWavePreview(ctx));
  } else {
    showWavePreview(ctx);
  }
}

// ─── showWaveEvent ─────────────────────────────────────────────────────────

export function showWaveEvent(
  ctx: WaveEventContext,
  evt: WaveEventDef,
  onDone: () => void,
): void {
  const { scene } = ctx;
  const ov = scene.add.container(0, 0).setDepth(250).setName(WAVE_BRIEFING_NAME);
  const accent = cssToHex(evt.color);

  const dim = addBlockingDim(scene, ov, 0.66);
  dim.setAlpha(0);
  if (getReducedMotion()) dim.setAlpha(1);
  else scene.tweens.add({ targets: dim, alpha: 1, duration: 200 });

  // Card
  const cw = 280, ch = 132;
  const cx = (CANVAS_WIDTH - cw) / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2 - 20;
  const frame = addFramedPanel(scene, {
    x: cx,
    y: cy,
    w: cw,
    h: ch,
    radius: 8,
    fillColor: OVERLAY_PANEL_FILL,
    borderColor: accent,
    borderAlpha: 1,
    borderWidth: 1.5,
    accentColor: accent,
    accentAlpha: 1,
    glowColor: accent,
    glowOpacity: 0.05,
    shadowOpacity: 0.3,
    shadowOffsetY: 5,
  });
  addToContainer(ov, frame.shadow, frame.panel, frame.glow);

  // Icon
  const icon = scene.add.text(cx + cw / 2, cy + 30, evt.icon, {
    fontSize: '32px',
  }).setOrigin(0.5);
  ov.add(icon);

  // Event identity keeps its semantic accent against the stone surface.
  const name = scene.add.text(cx + cw / 2, cy + 66, evt.name, {
    fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: evt.color,
    stroke: '#030504', strokeThickness: 2,
  }).setOrigin(0.5);
  ov.add(name);

  // Description
  const desc = scene.add.text(cx + cw / 2, cy + 94, evt.description, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: cw - 34 },
    align: 'center',
  }).setOrigin(0.5);
  ov.add(desc);

  const cardObjects = [frame.shadow, frame.panel, frame.glow, icon, name, desc];
  if (getReducedMotion()) cardObjects.forEach(obj => obj.setAlpha(1));
  else {
    cardObjects.forEach(obj => {
      obj.setAlpha(0);
      obj.y -= 28;
    });
    scene.tweens.add({
      targets: cardObjects,
      y: '+=28',
      alpha: 1,
      duration: 300,
      ease: 'Power2.easeOut',
    });
  }

  // Apply event effect
  applyWaveEvent(ctx, evt);

  // Auto-dismiss after 1.8s
  scene.time.delayedCall(1800, () => {
    if (getReducedMotion()) {
      ov.destroy();
      onDone();
      return;
    }
    scene.tweens.add({
      targets: ov, alpha: 0, duration: 300,
      onComplete: () => { ov.destroy(); onDone(); },
    });
  });
}

// ─── applyWaveEvent ────────────────────────────────────────────────────────

export function applyWaveEvent(ctx: WaveEventContext, evt: WaveEventDef): void {
  applyWaveEventEffects(ctx, evt);
  // The card is shown ~1.8s before startWave, which resets the live values.
  // Hand the roll forward so startWave restores it instead of neutralising it.
  ctx.pendingWaveMults = {
    gold: ctx.waveGoldMult, hp: ctx.waveHpMult, atk: ctx.waveAtkMult, spd: ctx.waveSpdMult,
  };
}

function applyWaveEventEffects(ctx: WaveEventContext, evt: WaveEventDef): void {
  const mults = waveEventMults(evt.type);
  ctx.waveGoldMult = mults.gold;
  ctx.waveHpMult   = mults.hp;
  ctx.waveAtkMult  = mults.atk;
  ctx.waveSpdMult  = mults.spd;

  const healFrac = WAVE_EVENT_HEAL[evt.type] ?? 0;
  if (healFrac > 0) {
    const moonHealUp = ctx.synergyHasMoonlightHealUp ? 1.20 : 1;
    ctx.dungeonHp = Math.min(ctx.maxHp, ctx.dungeonHp + Math.ceil(ctx.maxHp * healFrac * moonHealUp));
    ctx.setRegistryHp(ctx.dungeonHp);
  }

  if (evt.type === 'fog') {
    ctx.waveFogOverlay = ctx.scene.add.graphics().setDepth(15).setAlpha(0.3);
    ctx.waveFogOverlay.fillStyle(0x556677, 0.25);
    ctx.waveFogOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  logger.debug(`[EVENT] ${evt.name} applied: gold×${ctx.waveGoldMult} hp×${ctx.waveHpMult} atk×${ctx.waveAtkMult} spd×${ctx.waveSpdMult}`);
}

function getWaveThreatScore(rows: readonly [string, number][]): number {
  return rows.reduce((sum, [type, count]) => {
    const def = INVADER_DEFS[type as InvaderType];
    if (!def) return sum;
    const behaviorBonus = def.behavior ? 22 : 0;
    const bossBonus = def.isBoss || def.isMiniBoss ? 90 : 0;
    return sum + count * Math.round(def.hp / 18 + def.damage / 18 + def.speed / 9 + behaviorBonus) + bossBonus;
  }, 0);
}

function getThreatTier(score: number): { readonly label: string; readonly color: number; readonly css: string } {
  if (score >= 520) return { label: 'BOSS', color: CASUAL.RED, css: CASUAL_CSS.RED };
  if (score >= 260) return { label: 'HIGH', color: CASUAL.RED, css: CASUAL_CSS.RED };
  if (score >= 120) return { label: 'MID', color: CASUAL.GOLD, css: CASUAL_CSS.GOLD };
  return { label: 'LOW', color: CASUAL.GREEN, css: CASUAL_CSS.GREEN };
}

function addPreviewMetricChip(
  scene: Phaser.Scene,
  ov: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  accent: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.SOOT, 1);
  g.fillRoundedRect(x, y, w, 30, 5);
  g.fillStyle(accent, 0.85);
  g.fillRect(x + 1, y + 6, 3, 18);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.9);
  g.strokeRoundedRect(x, y, w, 30, 5);
  ov.add(g);
  ov.add(scene.add.text(x + 10, y + 9, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + w - 8, y + 21, value, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
}

function addEnemyBriefingRow(
  scene: Phaser.Scene,
  ov: Phaser.GameObjects.Container,
  cx: number,
  cw: number,
  def: InvaderDef,
  count: number,
  rowY: number,
): void {
  const rowG = scene.add.graphics();
  rowG.fillStyle(DUNGEON_UI.VOID, 0.5);
  rowG.fillRoundedRect(cx + 13, rowY - 12, cw - 26, 33, GAME_UI.radius.row);
  rowG.fillStyle(PREVIEW_ROW_FILL, 1);
  rowG.fillRoundedRect(cx + 12, rowY - 14, cw - 24, 33, GAME_UI.radius.row);
  rowG.fillStyle(def.color, 0.22);
  rowG.fillRoundedRect(cx + 18, rowY - 8, 35, 21, 4);
  rowG.lineStyle(1, DUNGEON_UI.EDGE, 0.9);
  rowG.strokeRoundedRect(cx + 12, rowY - 14, cw - 24, 33, GAME_UI.radius.row);
  // invader icon — keep the saturated species color
  rowG.fillStyle(def.color, 1);
  rowG.fillCircle(cx + 35, rowY + 2, Math.min(9, Math.max(5, def.radius * 0.5)));
  rowG.fillStyle(0xffffff, 0.35);
  rowG.fillCircle(cx + 32, rowY - 1, 2.5);
  ov.add(rowG);

  ov.add(scene.add.text(cx + 62, rowY - 4, `${def.koreanName}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(cx + 62, rowY + 10, `HP ${def.hp} · 피해 ${def.damage}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  const countLabel = `×${count}`;
  const countBg = scene.add.graphics();
  countBg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  countBg.fillRoundedRect(cx + cw - 55, rowY - 9, 36, 19, 4);
  countBg.lineStyle(1, DUNGEON_UI.BRASS, 0.9);
  countBg.strokeRoundedRect(cx + cw - 55, rowY - 9, 36, 19, 4);
  ov.add(countBg);
  ov.add(scene.add.text(cx + cw - 37, rowY, countLabel, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.BRASS,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  if (def.behavior) {
    const behaviorLabel: Record<string, string> = {
      VOID_PHASE: '위상',
      REVIVE_ONCE: '부활',
      BERSERKER_RAGE: '광폭',
      STEALTH: '은신',
      SIEGE_SHIELD: '방패',
      DIVINE_WARD: '신성',
      IRON_BODY: '강체',
      RALLY_CRY: '집결',
      TRAP_IMMUNITY: '함정면역',
      FOX_QUEEN_PHASE: '보스',
      UNDYING_KNIGHT: '불사',
      DECOY_CLONE: '분신',
      POISON_TRAIL: '독장판',
      VOID_TELEPORT: '도약',
      DRAGON_KING_PHASE: '보스',
      VOID_STEALTH_ELITE: '은신도약',
      STUN_IMMUNE: '기절필수',
      FIVE_PHASE: '다단계',
      MIRROR_SHIELD: '반사',
      SWARM: '분열',
      SHADOW_REALM: '그림자',
      EMPEROR_PHASE: '황제',
      GOD_EMPEROR_PHASE: '신황제',
      VOID_SURGE: '공허',
      PRIMORDIAL_PHASE: '원초',
    };
    ov.add(scene.add.text(cx + cw - 102, rowY + 10, behaviorLabel[def.behavior] ?? '특수', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.EMBER,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
  }
}

// ─── showWavePreview ───────────────────────────────────────────────────────

export function showWavePreview(ctx: WaveEventContext): void {
  const { scene } = ctx;
  const nextWave = ctx.wave + 1;
  if (nextWave > ctx.maxWave) { ctx.startWave(); return; }

  // Gather wave info
  const cfg = ctx.isEndless
    ? null
    : ctx.waveConfigs[Math.min(nextWave - 1, ctx.waveConfigs.length - 1)];

  const typeCount = new Map<string, number>();
  if (cfg) {
    for (const { type, count } of cfg.invaders) {
      typeCount.set(type, (typeCount.get(type) ?? 0) + count);
    }
  }
  const enemyRows = [...typeCount.entries()];
  const totalInvaders = [...typeCount.values()].reduce((a, b) => a + b, 0);
  const totalDamage = enemyRows.reduce((sum, [type, count]) => {
    const def = INVADER_DEFS[type as InvaderType];
    return sum + (def ? def.damage * count : 0);
  }, 0);
  const threat = getThreatTier(getWaveThreatScore(enemyRows));

  const ov = scene.add.container(0, 0).setDepth(300).setName(WAVE_BRIEFING_NAME);

  const dim = addBlockingDim(scene, ov, 0.68).setAlpha(0);
  if (getReducedMotion()) dim.setAlpha(1);
  else scene.tweens.add({ targets: dim, alpha: 1, duration: 200 });

  // Card
  const cw = 318;
  const ch = cfg ? 132 + enemyRows.length * 38 + 62 : 172;
  const cx = CANVAS_WIDTH / 2 - cw / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2;
  const card = addFramedPanel(scene, {
    x: cx,
    y: cy,
    w: cw,
    h: ch,
    radius: 8,
    fillColor: PREVIEW_PANEL_FILL,
    borderColor: threat.color,
    borderAlpha: 1,
    borderWidth: 1.5,
    accentColor: threat.color,
    accentAlpha: 1,
    glowColor: threat.color,
    glowOpacity: 0.05,
    shadowOpacity: 0.3,
    shadowOffsetY: 5,
  });
  addToContainer(ov, card.shadow, card.panel, card.glow);

  // Title
  ov.add(scene.add.text(CANVAS_WIDTH / 2, cy + 18,
    `침입 ${nextWave} · 정찰 보고`, {
    fontFamily: 'sans-serif', fontSize: '15px',
    fontStyle: 'bold', color: threat.css,
    stroke: '#030504', strokeThickness: 2,
  }).setOrigin(0.5));

  if (cfg) {
    const rail = scene.add.graphics();
    rail.fillStyle(DUNGEON_UI.SOOT, 1);
    rail.fillRoundedRect(cx + 14, cy + 35, cw - 28, 5, 3);
    rail.fillStyle(threat.color, 1);
    rail.fillRoundedRect(cx + 14, cy + 35, Math.max(18, (cw - 28) * Phaser.Math.Clamp(getWaveThreatScore(enemyRows) / 600, 0.12, 1)), 5, 3);
    ov.add(rail);

    addPreviewMetricChip(scene, ov, cx + 16, cy + 47, 84, '위협', threat.label, threat.color);
    addPreviewMetricChip(scene, ov, cx + 108, cy + 47, 86, '규모', `${totalInvaders}`, CASUAL.BLUE);
    addPreviewMetricChip(scene, ov, cx + 202, cy + 47, 100, '돌파 피해', `${totalDamage}`, CASUAL.RED);

    // Enemy list
    let rowY = cy + 94;

    for (const [type, count] of enemyRows) {
      const def = INVADER_DEFS[type as InvaderType];
      if (!def) continue;
      addEnemyBriefingRow(scene, ov, cx, cw, def, count, rowY);
      rowY += 38;
    }

    // Total / damage warning
    ov.add(scene.add.text(CANVAS_WIDTH / 2, rowY + 2,
      `침입문 → 던전 심장부 · 방어선 돌파 시 HP 피해`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: GAME_UI.colors.mutedText,
    }).setOrigin(0.5));
  } else {
    ov.add(scene.add.text(CANVAS_WIDTH / 2, cy + 60,
      '무한 모드 · 침략 전력이 계속 강해집니다', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
  }

  // Confirm button
  const btn = addPrimaryActionButton(scene, {
    x: cx + 40,
    y: cy + ch - 58,
    w: cw - 80,
    h: 44,
    label: '침입 방어 개시',
    fontSize: '13px',
    fillColor: DUNGEON_UI.JADE,
    hoverFillColor: 0x5aad86,
    borderColor: DUNGEON_UI.JADE,
    hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    textColor: '#ffffff',
    onPress: () => {
      ov.destroy();
      ctx.startWave();
    },
  });
  addToContainer(ov, btn.bg, btn.text, btn.zone);
}

function cssToHex(color: string, fallback = COLORS.TORCH_GOLD): number {
  const raw = color.startsWith('#') ? color.slice(1) : color;
  const parsed = Number.parseInt(raw, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
