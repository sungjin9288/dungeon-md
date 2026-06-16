/**
 * Procedural pixel-art dungeon room interior, drawn directly onto a Phaser
 * Graphics with chunky fill-rect "pixels" (axis-aligned → inherently crisp,
 * no texture/filtering needed). Replaces the old vector cutaway so the room
 * environment reads as pixel art, matching the pixel monster sprites on top.
 *
 * Drawn inset within the room cell (the caller keeps the rounded panel body +
 * accent frame), so draw order stays: cell body → pixel interior → room UI.
 */

import Phaser from 'phaser';

const PX = 4;        // pixel-block size
const INSET = 4;     // margin inside the cell (keeps rounded corners clean)
const REF_N = 23;    // reference grid (100px cell): 23 * 4 = 92 ≈ 100 - 2*INSET

// Warm dark dungeon stone palette.
const FLOOR = 0x241a0e, FLOOR_MID = 0x2e2213, FLOOR_LITE = 0x382a18, GROUT = 0x100b06;
const BRICK = 0x2e2417, BRICK_DK = 0x1c1509, BRICK_LITE = 0x3c2f1d, MORTAR = 0x0e0a05;
const SIDE = 0x150e07;
const TORCH_BRK = 0x5a3a1a, FLAME_OUT = 0xff6b1a, FLAME_IN = 0xffd24a;

// Deterministic 0..1 from a grid cell — stable, no Math.random.
function rnd(gx: number, gy: number, salt = 0): number {
  const v = Math.sin(gx * 12.9898 + gy * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Draw a pixel-art dungeon room interior onto `g` at cell origin (x, y).
 * `readiness` (0..100) brightens the torch glow. `size` is the cell edge in
 * px (default 100 → 23-block grid); larger cells (e.g. battle's 110px) derive
 * a wider grid so the room fills the cell instead of leaving a gap.
 */
export function drawPixelRoom(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  roomType: string | undefined,
  accent: number,
  readiness: number,
  size = 100,
): void {
  const ox = x + INSET;
  const oy = y + INSET;
  const N = Math.max(16, Math.floor((size - INSET * 2) / PX));
  const glow = Phaser.Math.Clamp(readiness / 100, 0, 1);
  const blk = (gx: number, gy: number, color: number, alpha = 1, w = 1, h = 1): void => {
    g.fillStyle(color, alpha);
    g.fillRect(ox + gx * PX, oy + gy * PX, w * PX, h * PX);
  };

  const WALL_BOTTOM = Math.round(N * 0.41);   // upper rows wall, rest floor

  // ── Floor base ──
  blk(0, 0, FLOOR, 1, N, N);

  // ── Back wall: running-bond brick ──
  for (let gy = 0; gy <= WALL_BOTTOM; gy++) {
    const off = (gy % 2) * 2;
    for (let gx = 0; gx < N; gx++) {
      const r = rnd(gx, gy, 1);
      let col = BRICK;
      if (r > 0.86) col = BRICK_LITE;
      else if (r < 0.16) col = BRICK_DK;
      blk(gx, gy, col);
      if ((gx + off) % 4 === 0) blk(gx, gy, MORTAR);       // vertical mortar
    }
    if (gy % 2 === 0) for (let gx = 0; gx < N; gx++) blk(gx, gy, MORTAR, 0.5); // course line
  }

  // ── Floor: flagstones with grout grid + shade noise ──
  for (let gy = WALL_BOTTOM + 1; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const r = rnd(gx, gy, 2);
      let col = FLOOR_MID;
      if (r > 0.8) col = FLOOR_LITE;
      else if (r < 0.25) col = FLOOR;
      blk(gx, gy, col);
      if (gx % 5 === 0 || gy % 4 === 0) blk(gx, gy, GROUT, 0.7);
    }
  }
  blk(0, N - 1, GROUT, 1, N, 1);   // front floor lip

  // ── Side pillars ──
  for (let gy = 0; gy < N; gy++) {
    blk(0, gy, SIDE); blk(N - 1, gy, SIDE);
    if (gy % 3 === 0) { blk(0, gy, BRICK_DK); blk(N - 1, gy, BRICK_DK); }
  }

  // ── Room-type fixture ──
  drawFixture(blk, roomType, accent, N);

  // ── Wall torches with warm glow ──
  for (const gx of [2, N - 3]) {
    const gy = 3;
    blk(gx - 1, gy - 1, FLAME_OUT, 0.16 + glow * 0.14, 3, 4); // glow pool
    blk(gx, gy + 1, TORCH_BRK, 1, 1, 2);                      // bracket
    blk(gx, gy, FLAME_OUT);
    blk(gx, gy - 1, FLAME_OUT);
    blk(gx, gy - 1, FLAME_IN);
    blk(gx, gy - 2, FLAME_IN);
  }

  // ── Accent lintel under the top course (room identity) ──
  blk(0, 0, accent, 0.85, N, 1);
  // ── Soft warm ambient wash ──
  blk(0, 0, FLAME_OUT, 0.05 + glow * 0.05, N, N);
}

type BlkFn = (gx: number, gy: number, color: number, alpha?: number, w?: number, h?: number) => void;

function drawFixture(blk: BlkFn, roomType: string | undefined, accent: number, N: number): void {
  if (N < 20) return;                  // too small to read a fixture cleanly
  const f = N / REF_N;                 // scale 23-grid design to the actual grid
  const s = (v: number): number => Math.round(v * f);   // scale a coordinate/length

  if (roomType === 'combat') {
    // weapon rack + crossed blades
    const postH = Math.max(4, s(6));
    blk(s(5), s(11), BRICK_DK, 1, 1, postH); blk(s(16), s(11), BRICK_DK, 1, 1, postH);
    blk(s(5), s(11), accent, 0.9, s(12), 1);
    const blades = Math.max(4, s(5));
    for (let i = 0; i < blades; i++) { blk(s(8) + i, s(13) + i, accent, 0.85); blk(s(13) - i, s(13) + i, accent, 0.85); }
  } else if (roomType === 'trap') {
    for (let i = 0; i < 5; i++) {
      const sx = s(4) + i * s(4);
      blk(sx, s(19), accent, 0.85); blk(sx, s(18), accent, 0.85); blk(sx - 1, s(20), accent, 0.7, 3, 1);
    }
  } else if (roomType === 'support') {
    blk(s(10), s(10), accent, 0.85, 3, s(7));
    blk(s(9), s(10), accent, 0.85, 5, 1);
    blk(s(7), s(19), BRICK_DK, 1, s(9), 2); blk(s(8), s(18), accent, 0.8, s(7), 1);
  } else if (roomType === 'magic') {
    const cx = s(11), cy = s(16), R = s(5);
    for (let a = 0; a < 12; a++) {
      const gx = Math.round(cx + Math.cos((Math.PI / 6) * a) * R);
      const gy = Math.round(cy + Math.sin((Math.PI / 6) * a) * R);
      blk(gx, gy, accent, 0.85);
    }
    blk(cx, cy, accent, 0.9);
  }
}
