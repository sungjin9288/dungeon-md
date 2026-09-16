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
import { selectCharacterArtSource } from '../data/characterArt';
import { DUNGEON_UI } from '../constants/colors';
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
    primordial:['#220033', '#0d001a'],
    void:      ['#16002a', '#080013'],
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
    primordial: '原',
    void: '虛',
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
  const source = selectCharacterArtSource(monsterId, textureKey => scene.textures.exists(textureKey), skinId);
  const key = skinId
    ? `portrait-${monsterId}-${skinId}`
    : source?.version === 'ritual-v2' ? `portrait-ritual-v2-${monsterId}` : `portrait-${monsterId}`;

  if (scene.textures.exists(key)) return key;

  const def = MONSTER_DEFS[monsterId];
  if (!def) return key;

  // Illustrated portrait: if an AI illustration is loaded for this monster (and
  // no skin recolor is requested), composite it instead of the pixel art — gives
  // the collection screens a management-game look. Monsters without an
  // illustration fall through to the procedural pixel portrait below.
  if (source) {
    const src = scene.textures.get(source.textureKey).getSourceImage() as CanvasImageSource;
    const sz = 256;
    const aiCanvas = document.createElement('canvas');
    aiCanvas.width = sz;
    aiCanvas.height = sz;
    const aictx = aiCanvas.getContext('2d');
    if (aictx) {
      aictx.imageSmoothingEnabled = true;
      aictx.drawImage(src, 0, 0, sz, sz);
      scene.textures.addCanvas(key, aiCanvas);
      return key;
    }
  }

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

  return key;
}

/**
 * Bake a transparent 96px ritual world sprite. Ritual cutouts keep their full silhouette;
 * the existing procedural pixel body remains the fallback for other monsters.
 */
export function generateMonsterSprite(scene: Phaser.Scene, monsterId: MonsterId): string {
  const source = selectCharacterArtSource(monsterId, textureKey => scene.textures.exists(textureKey));
  if (source?.version === 'ritual-v2') {
    const artKey = `sprite-ritual-v2-${monsterId}`;
    if (scene.textures.exists(artKey)) return artKey;
    const density = 96;
    const artCanvas = document.createElement('canvas');
    artCanvas.width = density;
    artCanvas.height = density;
    const artContext = artCanvas.getContext('2d');
    if (artContext) {
      artContext.imageSmoothingEnabled = true;
      artContext.drawImage(scene.textures.get(source.textureKey).getSourceImage() as CanvasImageSource, 0, 0, density, density);
      scene.textures.addCanvas(artKey, artCanvas);
      return artKey;
    }
  }

  const key = `sprite-${monsterId}`;
  if (generated.has(key)) return key;
  if (scene.textures.exists(key)) { generated.add(key); return key; }

  const def = MONSTER_DEFS[monsterId];
  if (!def) return key;

  const SC = 2; // 24 * 2 = 48px
  const canvas = document.createElement('canvas');
  canvas.width = 24 * SC; canvas.height = 24 * SC;
  const ctx = canvas.getContext('2d');
  if (!ctx) return key;
  ctx.imageSmoothingEnabled = false;

  const { palette, silhouette } = getMonsterSpriteData(monsterId, def.tribe, def.type, def.rarityTier);
  for (let y = 0; y < 24; y++) {
    const row = silhouette[y];
    if (!row) continue;
    for (let x = 0; x < 24; x++) {
      const idx = row[x];
      if (!idx || idx === 0) continue;
      ctx.fillStyle = hexToCSS(palette[idx] ?? 0xff00ff);
      ctx.fillRect(x * SC, y * SC, SC, SC);
    }
  }

  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  generated.add(key);
  return key;
}

/**
 * Build a circular illustrated "guardian token" for placing a monster directly
 * into a dungeon room (battle board + home placement board). The square AI
 * illustration is clipped to a disc with a rarity-tinted ring so an illustrated
 * monster reads as a collectible hero standing the room.
 *
 * Returns the texture key, or `null` when no AI illustration is loaded for this
 * monster — callers fall back to the procedural pixel body sprite in that case.
 * Cached — safe to call repeatedly.
 */
export function generateRoomToken(scene: Phaser.Scene, monsterId: MonsterId): string | null {
  const source = selectCharacterArtSource(monsterId, textureKey => scene.textures.exists(textureKey));
  if (!source) return null;

  const key = source.version === 'ritual-v2' ? `roomtoken-ritual-v2-${monsterId}` : `roomtoken-${monsterId}`;
  if (scene.textures.exists(key)) return key;

  const def = MONSTER_DEFS[monsterId];
  const ring = RARITY_BORDER[def?.rarityTier ?? 'C'] ?? RARITY_BORDER.C;

  const D = 96; // 2x the ~48px display size — crisp under the DPR camera
  const canvas = document.createElement('canvas');
  canvas.width = D;
  canvas.height = D;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const src = scene.textures.get(source.textureKey).getSourceImage() as CanvasImageSource;
  const r = D / 2;

  // Circular-clipped illustration (square source → centred bust fills the disc).
  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r - 3, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (source.version === 'ritual-v2') {
    ctx.fillStyle = hexToCSS(DUNGEON_UI.STONE);
    ctx.fillRect(0, 0, D, D);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, D, D);
  // Bottom vignette so the disc reads as seated, not a flat sticker.
  const vg = ctx.createLinearGradient(0, r, 0, D);
  vg.addColorStop(0, 'rgba(10,4,0,0)');
  vg.addColorStop(1, 'rgba(10,4,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, r, D, r);
  ctx.restore();

  // Framed medallion ring: dark seat + rarity colour + soft inner highlight.
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(8,4,0,0.85)';
  ctx.beginPath(); ctx.arc(r, r, r - 2.5, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.beginPath(); ctx.arc(r, r, r - 4, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(r, r, r - 6.5, 0, Math.PI * 2); ctx.stroke();

  scene.textures.addCanvas(key, canvas);
  return key;
}

/**
 * Ensure a portrait exists, generating if needed.
 * Returns true if the texture is ready.
 */
export function ensurePortrait(scene: Phaser.Scene, monsterId: MonsterId): boolean {
  const key = generatePortrait(scene, monsterId);
  return scene.textures.exists(key);
}
