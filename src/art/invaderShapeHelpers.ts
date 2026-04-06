/**
 * Shared chibi helpers and color utilities for invader shape drawing.
 */

// ─── Color helpers ───────────────────────────────────────────────────────────

export function darken(c: number, amt = 0.4): number {
  const r = Math.floor(((c >> 16) & 0xff) * amt);
  const g = Math.floor(((c >> 8) & 0xff) * amt);
  const b = Math.floor((c & 0xff) * amt);
  return (r << 16) | (g << 8) | b;
}

export function lighten(c: number, amt = 60): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + amt);
  const g = Math.min(255, ((c >> 8) & 0xff) + amt);
  const b = Math.min(255, (c & 0xff) + amt);
  return (r << 16) | (g << 8) | b;
}

// ─── Shared chibi helpers ────────────────────────────────────────────────────

/** Draw big round head centred at (hx, hy) with radius hr */
export function drawHead(g: Phaser.GameObjects.Graphics, fill: number, hx: number, hy: number, hr: number): void {
  g.fillStyle(fill, 1);
  g.fillCircle(hx, hy, hr);
  // cheek blush
  g.fillStyle(0xff8888, 0.18);
  g.fillCircle(hx - hr * 0.45, hy + hr * 0.18, hr * 0.22);
  g.fillCircle(hx + hr * 0.45, hy + hr * 0.18, hr * 0.22);
}

/** Draw two cute eyes at (hx,hy) sized to head radius hr */
export function drawEyes(g: Phaser.GameObjects.Graphics, hx: number, hy: number, hr: number, eyeColor = 0x222222): void {
  const er = hr * 0.16;
  g.fillStyle(eyeColor, 1);
  g.fillCircle(hx - hr * 0.28, hy, er);
  g.fillCircle(hx + hr * 0.28, hy, er);
  // white shine
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(hx - hr * 0.28 + er * 0.4, hy - er * 0.4, er * 0.38);
  g.fillCircle(hx + hr * 0.28 + er * 0.4, hy - er * 0.4, er * 0.38);
}

/** Draw a small chubby body pill below (bx, by) */
export function drawBody(g: Phaser.GameObjects.Graphics, fill: number, bx: number, by: number, bw: number, bh: number): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(bx - bw / 2, by, bw, bh, bw * 0.35);
}

/** Draw two stubby legs below (lx, ly) */
export function drawLegs(g: Phaser.GameObjects.Graphics, fill: number, lx: number, ly: number, r: number): void {
  g.fillStyle(darken(fill, 0.7), 1);
  g.fillRoundedRect(lx - r * 0.28, ly, r * 0.2, r * 0.28, r * 0.08);
  g.fillRoundedRect(lx + r * 0.08, ly, r * 0.2, r * 0.28, r * 0.08);
}

// ─── Layout params ──────────────────────────────────────────────────────────

export interface ChibiLayout {
  readonly r: number;
  readonly cx: number;
  readonly cy: number;
  readonly fill: number;
  readonly hi: number;
  readonly dk: number;
  readonly hr: number;
  readonly hx: number;
  readonly hy: number;
  readonly bw: number;
  readonly bh: number;
  readonly by: number;
}

export function computeLayout(radius: number, color: number): ChibiLayout {
  const r = radius;
  const cx = r;
  const cy = r;
  const fill = color;
  const hi = lighten(fill, 55);
  const dk = darken(fill, 0.55);
  const hr = r * 0.42;
  const hx = cx;
  const hy = cy - r * 0.22;
  const bw = r * 0.68;
  const bh = r * 0.42;
  const by = hy + hr + r * 0.02;
  return { r, cx, cy, fill, hi, dk, hr, hx, hy, bw, bh, by };
}
