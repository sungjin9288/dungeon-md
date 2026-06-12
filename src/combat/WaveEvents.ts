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
import { COLORS, CSS } from '../constants/colors';
import { logger } from '../utils/logger';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from '../ui/GameUiPrimitives';

const OVERLAY_PANEL_FILL = 0x0e0903;
const PREVIEW_PANEL_FILL = 0x101b26;
const PREVIEW_ROW_FILL = 0x172838;

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
  dungeonHp: number;

  // callbacks
  startWave(): void;
  setRegistryHp(hp: number): void;
}

// ─── tryShowWaveEvent ──────────────────────────────────────────────────────

export function tryShowWaveEvent(ctx: WaveEventContext): void {
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
  const ov = scene.add.container(0, 0).setDepth(250);
  const accent = cssToHex(evt.color);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.66);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setAlpha(0);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 200 });

  // Card
  const cw = 280, ch = 132;
  const cx = (CANVAS_WIDTH - cw) / 2;
  const cy = CANVAS_HEIGHT / 2 - ch / 2 - 20;
  const frame = addFramedPanel(scene, {
    x: cx,
    y: cy,
    w: cw,
    h: ch,
    radius: 12,
    fillColor: OVERLAY_PANEL_FILL,
    borderColor: accent,
    borderAlpha: 0.9,
    borderWidth: 2,
    accentColor: accent,
    accentAlpha: 0.9,
    glowColor: accent,
    glowOpacity: 0.1,
    shadowOpacity: 0.58,
    shadowOffsetY: 4,
  });
  addToContainer(ov, frame.shadow, frame.panel, frame.glow);

  // Icon
  const icon = scene.add.text(cx + cw / 2, cy + 30, evt.icon, {
    fontSize: '32px',
  }).setOrigin(0.5);
  ov.add(icon);

  // Name
  const name = scene.add.text(cx + cw / 2, cy + 66, evt.name, {
    fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: evt.color,
  }).setOrigin(0.5);
  ov.add(name);

  // Description
  const desc = scene.add.text(cx + cw / 2, cy + 94, evt.description, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CSS.PARCHMENT_DIM,
    wordWrap: { width: cw - 34 },
    align: 'center',
  }).setOrigin(0.5);
  ov.add(desc);

  const cardObjects = [frame.shadow, frame.panel, frame.glow, icon, name, desc];
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

  // Apply event effect
  applyWaveEvent(ctx, evt);

  // Auto-dismiss after 1.8s
  scene.time.delayedCall(1800, () => {
    scene.tweens.add({
      targets: ov, alpha: 0, duration: 300,
      onComplete: () => { ov.destroy(); onDone(); },
    });
  });
}

// ─── applyWaveEvent ────────────────────────────────────────────────────────

export function applyWaveEvent(ctx: WaveEventContext, evt: WaveEventDef): void {
  switch (evt.type) {
    case 'merchant':
      ctx.waveGoldMult = 1.5;
      break;
    case 'supply': {
      const moonHealUp = ctx.synergyHasMoonlightHealUp ? 1.20 : 1;
      ctx.dungeonHp = Math.min(ctx.maxHp, ctx.dungeonHp + Math.ceil(ctx.maxHp * 0.15 * moonHealUp));
      ctx.setRegistryHp(ctx.dungeonHp);
      break;
    }
    case 'curse':
      ctx.waveHpMult   = 1.3;
      ctx.waveGoldMult = 2.0;
      break;
    case 'rally':
      ctx.waveAtkMult = 1.25;
      break;
    case 'fog':
      ctx.waveSpdMult = 0.85;
      // Visual fog overlay
      ctx.waveFogOverlay = ctx.scene.add.graphics().setDepth(15).setAlpha(0.3);
      ctx.waveFogOverlay.fillStyle(0x556677, 0.25);
      ctx.waveFogOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      break;
    case 'void_storm':
      ctx.waveSpdMult  = 1.25;
      ctx.waveGoldMult = 1.8;
      break;
    case 'ancient_blessing': {
      ctx.waveAtkMult = 1.20;
      const moonHealUp = ctx.synergyHasMoonlightHealUp ? 1.20 : 1;
      ctx.dungeonHp = Math.min(ctx.maxHp, ctx.dungeonHp + Math.ceil(ctx.maxHp * 0.10 * moonHealUp));
      ctx.setRegistryHp(ctx.dungeonHp);
      break;
    }
    case 'crimson_curse':
      ctx.waveHpMult   = 1.5;
      ctx.waveGoldMult = 3.0;
      break;
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
  if (score >= 520) return { label: 'BOSS', color: 0xd9594a, css: '#ffb8c9' };
  if (score >= 260) return { label: 'HIGH', color: 0xffb84d, css: '#ffdf8a' };
  if (score >= 120) return { label: 'MID', color: 0xe8c468, css: '#ffdf8a' };
  return { label: 'LOW', color: 0x5fb854, css: '#b9ffd8' };
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
  g.fillStyle(0x140c03, 0.78);
  g.fillRoundedRect(x, y, w, 28, 7);
  g.fillStyle(accent, 0.14);
  g.fillRoundedRect(x + 5, y + 5, 20, 18, 5);
  g.lineStyle(1, accent, 0.44);
  g.strokeRoundedRect(x, y, w, 28, 7);
  ov.add(g);
  ov.add(scene.add.text(x + 11, y + 9, label, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: GAME_UI.colors.mutedText,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + w - 8, y + 18, value, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: CSS.PARCHMENT,
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
  rowG.fillStyle(0x070503, 0.28);
  rowG.fillRoundedRect(cx + 13, rowY - 12, cw - 26, 33, GAME_UI.radius.row);
  rowG.fillStyle(PREVIEW_ROW_FILL, 0.97);
  rowG.fillRoundedRect(cx + 12, rowY - 14, cw - 24, 33, GAME_UI.radius.row);
  rowG.fillStyle(def.color, 0.12);
  rowG.fillRoundedRect(cx + 18, rowY - 8, 35, 21, 6);
  rowG.lineStyle(1, def.color, 0.52);
  rowG.strokeRoundedRect(cx + 12, rowY - 14, cw - 24, 33, GAME_UI.radius.row);
  rowG.fillStyle(def.color, 0.82);
  rowG.fillCircle(cx + 35, rowY + 2, Math.min(9, Math.max(5, def.radius * 0.5)));
  rowG.fillStyle(0xffffff, 0.22);
  rowG.fillCircle(cx + 32, rowY - 1, 2.5);
  ov.add(rowG);

  ov.add(scene.add.text(cx + 62, rowY - 4, `${def.koreanName}`, {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: CSS.PARCHMENT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(cx + 62, rowY + 10, `HP ${def.hp} · 피해 ${def.damage}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: GAME_UI.colors.mutedText,
  }).setOrigin(0, 0.5));

  const countLabel = `×${count}`;
  const countBg = scene.add.graphics();
  countBg.fillStyle(0x140c03, 0.82);
  countBg.fillRoundedRect(cx + cw - 55, rowY - 9, 36, 19, 6);
  countBg.lineStyle(1, COLORS.TORCH_GOLD, 0.48);
  countBg.strokeRoundedRect(cx + cw - 55, rowY - 9, 36, 19, 6);
  ov.add(countBg);
  ov.add(scene.add.text(cx + cw - 37, rowY, countLabel, {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#f0e6c8',
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
      fontSize: '7px',
      color: '#ffb8c9',
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

  const ov = scene.add.container(0, 0).setDepth(300);

  // Dim
  const dim = scene.add.graphics().setAlpha(0);
  dim.fillStyle(0x000000, 0.68);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 200 });

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
    radius: 12,
    fillColor: PREVIEW_PANEL_FILL,
    borderColor: threat.color,
    borderAlpha: 0.88,
    borderWidth: 2,
    accentColor: threat.color,
    accentAlpha: 0.82,
    glowColor: threat.color,
    glowOpacity: 0.1,
    shadowOpacity: 0.56,
    shadowOffsetY: 4,
  });
  addToContainer(ov, card.shadow, card.panel, card.glow);

  // Title
  ov.add(scene.add.text(CANVAS_WIDTH / 2, cy + 18,
    `⚠️  ${nextWave}번째 침략 예고`, {
    fontFamily: 'Georgia, serif', fontSize: '15px',
    fontStyle: 'bold', color: threat.css,
  }).setOrigin(0.5));

  if (cfg) {
    const rail = scene.add.graphics();
    rail.fillStyle(0x140c03, 0.64);
    rail.fillRoundedRect(cx + 14, cy + 35, cw - 28, 5, 3);
    rail.fillStyle(threat.color, 0.8);
    rail.fillRoundedRect(cx + 14, cy + 35, Math.max(18, (cw - 28) * Phaser.Math.Clamp(getWaveThreatScore(enemyRows) / 600, 0.12, 1)), 5, 3);
    ov.add(rail);

    addPreviewMetricChip(scene, ov, cx + 16, cy + 47, 84, '위협', threat.label, threat.color);
    addPreviewMetricChip(scene, ov, cx + 108, cy + 47, 86, '규모', `${totalInvaders}`, 0x55b88a);
    addPreviewMetricChip(scene, ov, cx + 202, cy + 47, 100, '돌파 피해', `${totalDamage}`, 0xd9594a);

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
      fontFamily: 'sans-serif', fontSize: '9px', color: GAME_UI.colors.mutedText,
    }).setOrigin(0.5));
  } else {
    ov.add(scene.add.text(CANVAS_WIDTH / 2, cy + 60,
      '무한 모드 - 침략자가 계속 강해집니다', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5));
  }

  // Confirm button
  const btn = addPrimaryActionButton(scene, {
    x: cx + 40,
    y: cy + ch - 48,
    w: cw - 80,
    h: 34,
    label: '🛡  방어 시작',
    fontSize: '13px',
    fillColor: 0x1fae73,
    hoverFillColor: 0x25c884,
    borderColor: 0x8cffc1,
    hoverBorderColor: COLORS.TORCH_AMBER,
    textColor: '#fff8d8',
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
