/**
 * Line-drawn sigils — the game's icon set for meta screens.
 *
 * Emoji icons (💰 🏰 🪴 🗿 …) render in each platform's own colour style and
 * read as placeholder art against the ink-stone UI; the design rules forbid
 * them (MONSTER_DUNGEON_DESIGN.md "이모지 내비·아이콘"). These follow the
 * Production district's facility sigils: 2px strokes in one accent colour, a
 * faint accent disc behind, fills only for small highlights.
 *
 * Every glyph is authored on a 24-unit box centred on (0, 0) and scaled to
 * `size`, so one drawing serves a 20px list row and a 44px card alike.
 */
import Phaser from 'phaser';

export type SigilKind =
  | 'coin' | 'wall' | 'hammer' | 'bolt' | 'scroll' | 'gem' | 'shield' | 'swords'
  | 'spark' | 'pagoda' | 'moon' | 'flask' | 'plant' | 'totem' | 'chest' | 'banner'
  | 'flame' | 'statue' | 'spikes' | 'web' | 'orb' | 'chalice' | 'obelisk' | 'heart'
  | 'star' | 'book' | 'infinity' | 'sprout' | 'skull';

export const SIGIL_KINDS: readonly SigilKind[] = [
  'coin', 'wall', 'hammer', 'bolt', 'scroll', 'gem', 'shield', 'swords',
  'spark', 'pagoda', 'moon', 'flask', 'plant', 'totem', 'chest', 'banner',
  'flame', 'statue', 'spikes', 'web', 'orb', 'chalice', 'obelisk', 'heart',
  'star', 'book', 'infinity', 'sprout', 'skull',
];

export interface SigilOptions {
  /** Draw the faint accent disc behind the glyph (default true). */
  readonly disc?: boolean;
  /** Stroke alpha, for locked / muted states (default 1). */
  readonly alpha?: number;
}

type Pt = readonly [number, number];

/** Draw `kind` into `g`, centred at (cx, cy), fitting a `size`-px square. */
export function drawSigil(
  g: Phaser.GameObjects.Graphics,
  kind: SigilKind,
  cx: number,
  cy: number,
  size: number,
  color: number,
  options: SigilOptions = {},
): void {
  const s = size / 24;
  const alpha = options.alpha ?? 1;
  const X = (u: number): number => cx + u * s;
  const Y = (u: number): number => cy + u * s;
  const stroke = (w = 2): void => { g.lineStyle(Math.max(1.25, w * s), color, alpha); };
  const fill = (a: number): void => { g.fillStyle(color, a * alpha); };
  const line = (x1: number, y1: number, x2: number, y2: number): void => { g.lineBetween(X(x1), Y(y1), X(x2), Y(y2)); };
  const poly = (pts: readonly Pt[]): Phaser.Math.Vector2[] => pts.map(([x, y]) => new Phaser.Math.Vector2(X(x), Y(y)));
  const strokePoly = (pts: readonly Pt[]): void => { g.strokePoints(poly(pts), true, true); };
  const fillPoly = (pts: readonly Pt[]): void => { g.fillPoints(poly(pts), true, true); };
  const circle = (x: number, y: number, r: number): void => { g.strokeCircle(X(x), Y(y), r * s); };
  const dot = (x: number, y: number, r: number): void => { g.fillCircle(X(x), Y(y), r * s); };
  const rect = (x: number, y: number, w: number, h: number): void => { g.strokeRect(X(x), Y(y), w * s, h * s); };

  if (options.disc !== false) {
    g.fillStyle(color, 0.14 * alpha);
    g.fillCircle(cx, cy, 13 * s);
  }
  stroke();

  switch (kind) {
    case 'coin': // 엽전: round coin, square hole
      circle(0, 0, 9); circle(0, 0, 6);
      fill(0.9); g.fillRect(X(-2), Y(-2), 4 * s, 4 * s);
      break;
    case 'wall': // battlements and gate
      rect(-10, -2, 20, 12);
      for (const x of [-10, -2.5, 5]) rect(x, -8, 5, 6);
      g.beginPath(); g.arc(X(0), Y(10), 3.5 * s, Math.PI, 0); g.strokePath();
      break;
    case 'hammer':
      line(-8, 10, 4, -2);
      stroke(4); line(0, -10, 9, -1);
      break;
    case 'bolt':
      fill(0.85);
      fillPoly([[2, -11], [-7, 2], [-1, 2], [-3, 11], [7, -3], [1, -3], [4, -11]]);
      break;
    case 'scroll':
      rect(-7, -8, 14, 16);
      line(-10, -8, 10, -8); line(-10, 8, 10, 8);
      for (const y of [-3, 1, 5]) line(-4, y, 4, y);
      break;
    case 'gem':
      strokePoly([[-9, -3], [-5, -9], [5, -9], [9, -3], [0, 10]]);
      line(-9, -3, 9, -3); line(-3, -3, 0, 10); line(3, -3, 0, 10);
      break;
    case 'shield':
      strokePoly([[0, -11], [9, -7], [8, 3], [0, 11], [-8, 3], [-9, -7]]);
      line(0, -8, 0, 8);
      break;
    case 'swords':
      line(-9, 9, 8, -8); line(9, 9, -8, -8);
      stroke(3); line(-8, 4, -4, 8); line(8, 4, 4, 8);
      break;
    case 'spark':
      fill(0.85);
      fillPoly([[0, -11], [3, -3], [11, 0], [3, 3], [0, 11], [-3, 3], [-11, 0], [-3, -3]]);
      break;
    case 'pagoda': // tiered roof with upturned eaves
      line(0, -12, 0, -8);
      for (const [y, w] of [[-7, 7], [-1, 10], [5, 12]] as const) {
        line(-w, y, w, y); line(-w, y, -w - 1.5, y - 2); line(w, y, w + 1.5, y - 2);
      }
      rect(-4, -7, 8, 6); rect(-6, -1, 12, 6); rect(-8, 5, 16, 6);
      break;
    case 'moon': {
      fill(0.85);
      g.beginPath();
      g.arc(X(0), Y(0), 9 * s, Phaser.Math.DegToRad(-110), Phaser.Math.DegToRad(110), false);
      g.arc(X(4), Y(0), 7.5 * s, Phaser.Math.DegToRad(105), Phaser.Math.DegToRad(-105), true);
      g.closePath(); g.fillPath();
      break;
    }
    case 'flask':
      line(-3, -10, -3, -3); line(3, -10, 3, -3); line(-5, -10, 5, -10);
      circle(0, 4, 7);
      fill(0.45); dot(0, 6, 4.5);
      break;
    case 'plant': // pot with three leaves
      strokePoly([[-7, 3], [7, 3], [5, 11], [-5, 11]]);
      line(0, 3, 0, -8);
      fill(0.8);
      g.fillEllipse(X(-5), Y(-3), 10 * s, 6 * s);
      g.fillEllipse(X(5), Y(-5), 10 * s, 6 * s);
      g.fillEllipse(X(0), Y(-10), 6 * s, 5 * s);
      break;
    case 'totem':
      rect(-6, -11, 12, 22);
      line(-6, 0, 6, 0);
      fill(0.9); dot(-2.5, -6, 1.6); dot(2.5, -6, 1.6);
      line(-3, -2.5, 3, -2.5); line(-3, 5, 3, 5); line(-3, 8, 3, 8);
      break;
    case 'chest':
      fill(0.2); g.fillRoundedRect(X(-11), Y(-6), 22 * s, 17 * s, 3 * s);
      stroke(); g.strokeRoundedRect(X(-11), Y(-6), 22 * s, 17 * s, 3 * s);
      line(-11, 0, 11, 0);
      fill(1); g.fillRect(X(-2), Y(-2), 4 * s, 6 * s);
      break;
    case 'banner':
      line(-7, -11, -7, 11);
      fill(0.35); fillPoly([[-7, -10], [9, -6], [-7, -1]]);
      stroke(); strokePoly([[-7, -10], [9, -6], [-7, -1]]);
      break;
    case 'flame':
      fill(0.3);
      fillPoly([[0, -11], [6, -2], [7, 5], [3, 10], [-3, 10], [-7, 5], [-5, -3], [-2, 1]]);
      stroke(); strokePoly([[0, -11], [6, -2], [7, 5], [3, 10], [-3, 10], [-7, 5], [-5, -3], [-2, 1]]);
      fill(0.85); fillPoly([[0, 0], [3, 5], [0, 9], [-3, 5]]);
      break;
    case 'statue':
      circle(0, -7, 3.5);
      strokePoly([[-4, -3], [4, -3], [5, 6], [-5, 6]]);
      rect(-8, 6, 16, 4);
      break;
    case 'spikes':
      line(-11, 9, 11, 9);
      for (const x of [-8, -3, 2, 7]) strokePoly([[x - 2.5, 9], [x, -6], [x + 2.5, 9]]);
      break;
    case 'web':
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        line(0, 0, Math.cos(a) * 11, Math.sin(a) * 11);
      }
      for (const r of [4, 8]) {
        strokePoly(Array.from({ length: 6 }, (_, i): Pt => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r]));
      }
      break;
    case 'orb':
      fill(0.25); dot(0, -2, 8);
      stroke(); circle(0, -2, 8);
      strokePoly([[-6, 9], [6, 9], [4, 5], [-4, 5]]);
      fill(0.9); dot(-3, -5, 1.8);
      break;
    case 'chalice':
      strokePoly([[-8, -9], [8, -9], [4, 1], [-4, 1]]);
      line(0, 1, 0, 7); line(-6, 9, 6, 9); line(-3, 7, 3, 7);
      break;
    case 'obelisk':
      strokePoly([[0, -12], [4, -8], [5, 10], [-5, 10], [-4, -8]]);
      line(-8, 10, 8, 10);
      line(-2, -4, 2, -4);
      break;
    case 'heart':
      fill(0.35);
      fillPoly([[0, 10], [-9, 0], [-9, -5], [-5, -9], [0, -5], [5, -9], [9, -5], [9, 0]]);
      stroke(); strokePoly([[0, 10], [-9, 0], [-9, -5], [-5, -9], [0, -5], [5, -9], [9, -5], [9, 0]]);
      break;
    case 'star': {
      const pts: Pt[] = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 11 : 4.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
      fill(0.3); fillPoly(pts);
      stroke(); strokePoly(pts);
      break;
    }
    case 'book':
      strokePoly([[0, -6], [-10, -8], [-10, 8], [0, 10], [10, 8], [10, -8]]);
      line(0, -6, 0, 10);
      for (const y of [-3, 1]) { line(-7, y, -3, y + 0.5); line(3, y + 0.5, 7, y); }
      break;
    case 'infinity':
      circle(-5, 0, 5); circle(5, 0, 5);
      break;
    case 'sprout':
      line(0, 11, 0, -2);
      fill(0.8);
      g.fillEllipse(X(-5), Y(-4), 10 * s, 6 * s);
      g.fillEllipse(X(5), Y(-7), 10 * s, 6 * s);
      stroke(); line(-7, 11, 7, 11);
      break;
    case 'skull':
      circle(0, -2, 8);
      rect(-4, 5, 8, 5);
      fill(0.9); dot(-3, -2, 2); dot(3, -2, 2);
      line(-1.5, 5, -1.5, 10); line(1.5, 5, 1.5, 10);
      break;
  }
}

/** Convenience: a fresh Graphics holding one sigil. */
export function addSigil(
  scene: Phaser.Scene,
  kind: SigilKind,
  x: number,
  y: number,
  size: number,
  color: number,
  options: SigilOptions = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawSigil(g, kind, x, y, size, color, options);
  return g;
}
