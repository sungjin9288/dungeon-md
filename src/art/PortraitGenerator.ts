/**
 * Canvas-based 64x64 monster portrait generator.
 *
 * Generates detailed portraits for info screens (BarracksScene, CodexScene,
 * SummonScene). Portraits are lazily generated on first access and cached
 * as Phaser textures.
 */

import Phaser from 'phaser';
import type { MonsterId, TribeId, RarityId } from '../data/monsters';
import { MONSTER_DEFS } from '../data/monsters';
import { TRIBE_PALETTES, getMonsterSpriteData, type Palette } from './PixelMonsters';

// ─── Cache ─────────────────────────────────────────────────────────────────────

const generated = new Set<string>();

// ─── Rarity border colours ─────────────────────────────────────────────────────

const RARITY_BORDER: Record<string, string> = {
  C: '#888888',
  U: '#44cc44',
  R: '#4488ff',
  E: '#aa44ff',
  L: '#ffaa22',
};

const RARITY_GLOW: Record<string, string> = {
  C: 'rgba(136,136,136,0.3)',
  U: 'rgba(68,204,68,0.4)',
  R: 'rgba(68,136,255,0.4)',
  E: 'rgba(170,68,255,0.5)',
  L: 'rgba(255,170,34,0.6)',
};

// ─── Tribe background gradients ────────────────────────────────────────────────

function getTribeGradient(ctx: CanvasRenderingContext2D, tribe?: TribeId): CanvasGradient {
  const grad = ctx.createRadialGradient(32, 32, 5, 32, 32, 40);

  const colors: Record<TribeId, [string, string]> = {
    dokkaebi:  ['#331100', '#1a0800'],
    gumiho:    ['#331520', '#1a0a10'],
    dragon:    ['#0a2200', '#051100'],
    underworld:['#1a0030', '#0a0018'],
    sansin:    ['#0a2a0a', '#051505'],
    sea:       ['#001830', '#000c18'],
    mask:      ['#2a1000', '#150800'],
    moonlight: ['#0a0a2a', '#050515'],
    celestial: ['#2a2000', '#151000'],
  };

  const [inner, outer] = tribe ? (colors[tribe] ?? ['#1a1a1a', '#0a0a0a']) : ['#1a1a1a', '#0a0a0a'];
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  return grad;
}

// ─── Tribe insignia ────────────────────────────────────────────────────────────

function drawTribeInsignia(ctx: CanvasRenderingContext2D, tribe?: TribeId): void {
  if (!tribe) return;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.font = '18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const insignia: Record<TribeId, string> = {
    dokkaebi: '鬼',
    gumiho: '狐',
    dragon: '龍',
    underworld: '冥',
    sansin: '山',
    sea: '海',
    mask: '面',
    moonlight: '月',
    celestial: '天',
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillText(insignia[tribe] ?? '', 32, 52);
  ctx.restore();
}

// ─── Pixel colour to CSS ───────────────────────────────────────────────────────

function hexToCSS(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// ─── Draw scaled-up pixel body ─────────────────────────────────────────────────

function drawScaledBody(
  ctx: CanvasRenderingContext2D,
  monsterId: MonsterId,
  tribe?: TribeId,
  monsterType?: string,
  rarity?: string,
): void {
  const data = getMonsterSpriteData(monsterId, tribe, monsterType, rarity);
  const { palette, silhouette } = data;
  const scale = 2; // 24*2 = 48, centred in 64x64
  const offsetX = 8;
  const offsetY = 4;

  for (let y = 0; y < 24; y++) {
    const row = silhouette[y];
    if (!row) continue;
    for (let x = 0; x < 24; x++) {
      const idx = row[x];
      if (!idx || idx === 0) continue;
      ctx.fillStyle = hexToCSS(palette[idx] ?? 0xff00ff);
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
    }
  }
}

// ─── Draw face detail overlay ──────────────────────────────────────────────────

function drawFaceDetail(ctx: CanvasRenderingContext2D, palette: Palette): void {
  // Eyes — two small dots on the face area
  ctx.fillStyle = hexToCSS(palette[4]); // highlight colour
  ctx.fillRect(24, 14, 3, 2); // left eye
  ctx.fillRect(33, 14, 3, 2); // right eye

  // Eye shine
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(25, 14, 1, 1);
  ctx.fillRect(34, 14, 1, 1);
  ctx.globalAlpha = 1;
}

// ─── Draw rarity border ────────────────────────────────────────────────────────

function drawRarityBorder(ctx: CanvasRenderingContext2D, rarity?: RarityId): void {
  const r = rarity ?? 'C';
  const borderColor = RARITY_BORDER[r] ?? RARITY_BORDER.C;
  const glowColor = RARITY_GLOW[r] ?? RARITY_GLOW.C;

  // Outer glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = r === 'L' ? 8 : r === 'E' ? 6 : 3;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  ctx.shadowBlur = 0;

  // Inner corner accents for E/L
  if (r === 'E' || r === 'L') {
    ctx.fillStyle = borderColor;
    // Top-left
    ctx.fillRect(0, 0, 5, 2);
    ctx.fillRect(0, 0, 2, 5);
    // Top-right
    ctx.fillRect(59, 0, 5, 2);
    ctx.fillRect(62, 0, 2, 5);
    // Bottom-left
    ctx.fillRect(0, 62, 5, 2);
    ctx.fillRect(0, 59, 2, 5);
    // Bottom-right
    ctx.fillRect(59, 62, 5, 2);
    ctx.fillRect(62, 59, 2, 5);
  }
}

// ─── Main API ──────────────────────────────────────────────────────────────────

/**
 * Generate a 64x64 portrait texture for a monster.
 * Returns the texture key. Cached — safe to call repeatedly.
 */
export function generatePortrait(
  scene: Phaser.Scene,
  monsterId: MonsterId,
  skinId?: string,
): string {
  const key = skinId
    ? `portrait-${monsterId}-${skinId}`
    : `portrait-${monsterId}`;

  if (generated.has(key)) return key;
  if (scene.textures.exists(key)) {
    generated.add(key);
    return key;
  }

  const def = MONSTER_DEFS[monsterId];
  if (!def) return key;

  // Create off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return key;

  // Pixel-art portrait (art direction: 픽셀 디자인 — cuter, cohesive). Crisp
  // pixels, no smoothing. AI illustrations are intentionally not used here.
  ctx.imageSmoothingEnabled = false;

  // 1. Background gradient + tribe insignia
  ctx.fillStyle = getTribeGradient(ctx, def.tribe);
  ctx.fillRect(0, 0, 64, 64);
  drawTribeInsignia(ctx, def.tribe);

  // 2. Pixel sprite body + face detail
  drawScaledBody(ctx, monsterId, def.tribe, def.type, def.rarityTier);
  const palette = def.tribe ? TRIBE_PALETTES[def.tribe] : [0, 0x333333, 0x888888, 0xaaaaaa, 0xdddddd, 0x111111] as Palette;
  drawFaceDetail(ctx, palette);

  // 3. Rarity border + glow
  drawRarityBorder(ctx, def.rarityTier);

  // 4. Register as Phaser texture — NEAREST filter so pixels stay crisp
  // (global config is antialias/LINEAR for the smooth vector UI).
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  generated.add(key);

  return key;
}

/**
 * Ensure a portrait exists, generating if needed.
 * Returns true if the texture is ready.
 */
export function ensurePortrait(scene: Phaser.Scene, monsterId: MonsterId): boolean {
  const key = `portrait-${monsterId}`;
  if (scene.textures.exists(key)) return true;
  generatePortrait(scene, monsterId);
  return scene.textures.exists(key);
}
