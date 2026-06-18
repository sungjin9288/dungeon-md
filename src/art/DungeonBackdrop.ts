/**
 * DungeonBackdrop — an illustrated, atmospheric dungeon backdrop painted to a
 * Phaser CanvasTexture.
 *
 * Why Canvas, not Phaser Graphics: Graphics only does 4-corner LINEAR gradients
 * and flat fills, which read as geometric "cards". Canvas2D gives RADIAL torch
 * glows, a depth vignette, and per-block tonal painting — a genuinely *painted*
 * dungeon shaft (the "일러스트 배경 던전" the design calls for) rather than flat
 * UI shapes. Baked once per key+size, then drawn as a single Image behind the
 * board content (room frames sit ON it).
 */

import Phaser from 'phaser';

/** Bake (idempotently) the painted dungeon backdrop and return its texture key. */
export function bakeDungeonBackdrop(
  scene: Phaser.Scene, key: string, w: number, h: number,
): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  if (!tex) return key;
  const ctx = tex.getContext();
  if (ctx) paintDungeonShaft(ctx, Math.ceil(w), Math.ceil(h));
  tex.refresh();
  return key;
}

/** Deterministic pseudo-random in [0,1) — keeps the masonry stable across bakes. */
function seeded(n: number): number {
  let t = n * 9301 + 49297;
  t = (t % 233280) / 233280;
  return t < 0 ? t + 1 : t;
}

function paintDungeonShaft(x: CanvasRenderingContext2D, W: number, H: number): void {
  // ── base vertical gradient: warm torchlit top → deep dark → ominous heart ──
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#33240f'); g.addColorStop(0.30, '#1b1209');
  g.addColorStop(0.62, '#0e0805'); g.addColorStop(0.86, '#120705'); g.addColorStop(1, '#220707');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  // ── painterly stone masonry: tonal-varied blocks + mortar shadow ──
  const bw = W / 6.4, bh = H / 28; let i = 0;
  for (let yy = 0; yy < H; yy += bh) {
    const off = ((yy / bh) | 0) % 2 ? bw * 0.5 : 0;
    for (let xx = -bw; xx < W + bw; xx += bw, i++) {
      const r = seeded(i * 7 + 3);
      const base = 26 + r * 22;
      const depth = 1 - Math.min(1, Math.abs(yy / H - 0.5) * 1.4);  // lit central shaft
      const sg = x.createLinearGradient(xx + off, yy, xx + off, yy + bh);
      sg.addColorStop(0, `rgba(${base + 18},${base + 10},${base - 4},${0.22 + depth * 0.18})`);
      sg.addColorStop(1, `rgba(${base - 8},${base - 12},${base - 16},${0.30 + depth * 0.18})`);
      x.fillStyle = sg;
      x.fillRect(xx + off + 1.5, yy + 1.5, bw - 3, bh - 3);
      x.fillStyle = 'rgba(0,0,0,0.28)';
      x.fillRect(xx + off, yy + bh - 2, bw, 2);
    }
  }

  // ── side cavern walls receding into dark (leave a lit central shaft) ──
  const lw = x.createLinearGradient(0, 0, W * 0.5, 0);
  lw.addColorStop(0, 'rgba(4,3,2,0.92)'); lw.addColorStop(1, 'rgba(4,3,2,0)');
  x.fillStyle = lw; x.fillRect(0, 0, W * 0.5, H);
  const rw = x.createLinearGradient(W, 0, W * 0.5, 0);
  rw.addColorStop(0, 'rgba(4,3,2,0.92)'); rw.addColorStop(1, 'rgba(4,3,2,0)');
  x.fillStyle = rw; x.fillRect(W * 0.5, 0, W * 0.5, H);

  // ── descending stone arches framing the floors ──
  x.lineWidth = Math.max(3, W / 78);
  for (let a = 0; a < 3; a++) {
    const ay = (0.24 + a * 0.22) * H;
    x.strokeStyle = `rgba(${70 - a * 10},${52 - a * 8},${34 - a * 6},0.5)`;
    x.beginPath(); x.moveTo(W * 0.16, ay + 40); x.quadraticCurveTo(W * 0.5, ay - 26, W * 0.84, ay + 40); x.stroke();
    x.strokeStyle = 'rgba(255,210,140,0.06)';
    x.beginPath(); x.moveTo(W * 0.16, ay + 36); x.quadraticCurveTo(W * 0.5, ay - 30, W * 0.84, ay + 36); x.stroke();
  }

  // ── torch sconces: radial warm glow + flame ──
  const torch = (tx: number, ty: number): void => {
    const R = W * 0.4;
    const rg = x.createRadialGradient(tx, ty, 2, tx, ty, R);
    rg.addColorStop(0, 'rgba(255,196,110,0.50)'); rg.addColorStop(0.28, 'rgba(255,140,50,0.20)'); rg.addColorStop(1, 'rgba(255,110,30,0)');
    x.fillStyle = rg; x.fillRect(tx - R, ty - R, R * 2, R * 2);
    x.fillStyle = '#120b06'; x.fillRect(tx - 3, ty, 6, 18);
    const fg = x.createLinearGradient(tx, ty - 22, tx, ty + 6);
    fg.addColorStop(0, 'rgba(255,236,150,0.95)'); fg.addColorStop(0.5, 'rgba(255,150,40,0.95)'); fg.addColorStop(1, 'rgba(180,60,15,0.3)');
    x.fillStyle = fg; x.beginPath(); x.ellipse(tx, ty - 8, 7, 15, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,250,210,0.95)'; x.beginPath(); x.ellipse(tx, ty - 10, 3, 7, 0, 0, 7); x.fill();
  };
  for (const fy of [0.20, 0.46, 0.70]) { torch(W * 0.1, H * fy); torch(W * 0.9, H * fy); }

  // ── dungeon-heart glow at the bottom (the protected core) ──
  const hr = W * 0.68;
  const hg = x.createRadialGradient(W * 0.5, H * 0.94, 4, W * 0.5, H * 0.94, hr);
  hg.addColorStop(0, 'rgba(255,90,70,0.5)'); hg.addColorStop(0.3, 'rgba(200,40,30,0.26)'); hg.addColorStop(1, 'rgba(120,20,15,0)');
  x.fillStyle = hg; x.fillRect(W * 0.5 - hr, H * 0.94 - hr, hr * 2, hr * 2);

  // ── atmospheric vignette ──
  const vg = x.createRadialGradient(W * 0.5, H * 0.42, W * 0.42, W * 0.5, H * 0.42, W * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
}
