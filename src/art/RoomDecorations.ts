import type { RoomType } from '../data/rooms';
import type { DungeonTheme } from '../themes/DungeonTheme';

/**
 * Draw a subtle decorative pattern inside a room stone, unique per room type.
 * All decorations are drawn at low alpha to remain thematic across dungeon themes.
 * Coordinates assume center-origin (0,0) with stone size `s`.
 */
export function drawRoomDecoration(
  g: Phaser.GameObjects.Graphics,
  type: RoomType,
  s: number,
  theme: DungeonTheme,
): void {
  const half = s / 2;
  const inner = half - 10; // safe inner area

  switch (type) {
    case 'guardian':
      drawGuardian(g, inner, theme);
      break;
    case 'tower':
      drawTower(g, inner, theme);
      break;
    case 'scroll_library':
      drawScrollLibrary(g, inner, theme);
      break;
    case 'gold':
      drawGold(g, inner, theme);
      break;
    case 'trap':
      drawTrap(g, inner, theme);
      break;
    case 'trap_corridor':
      drawTrapCorridor(g, inner, theme);
      break;
    case 'armory':
      drawArmory(g, inner, theme);
      break;
    case 'medicine_hall':
      drawMedicineHall(g, inner, theme);
      break;
    case 'spirit_altar':
      drawSpiritAltar(g, inner, theme);
      break;
    case 'dragons_lair':
      drawDragonsLair(g, inner, theme);
      break;
  }
}

/* ── Guardian: crossed sword + shield ── */
function drawGuardian(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  const a = 0.18;
  // Vertical sword
  g.fillStyle(t.stoneLight, a);
  g.fillRect(-1.5, -r * 0.6, 3, r * 1.2);
  // Crossguard
  g.fillRect(-r * 0.25, -r * 0.1, r * 0.5, 3);
  // Pommel
  g.fillCircle(0, r * 0.6, 3);

  // Shield (right side)
  g.fillStyle(t.glowColor, 0.12);
  g.fillRect(r * 0.15, -r * 0.3, r * 0.4, r * 0.55);
  g.fillStyle(t.stoneLight, 0.08);
  g.fillTriangle(
    r * 0.15, r * 0.25,
    r * 0.55, r * 0.25,
    r * 0.35, r * 0.5,
  );
}

/* ── Tower: arrow slits + battlements ── */
function drawTower(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  const a = 0.17;
  // Three arrow slits (narrow vertical rectangles)
  g.fillStyle(t.stoneDark, a + 0.1);
  for (let i = -1; i <= 1; i++) {
    g.fillRect(i * r * 0.35 - 1.5, -r * 0.15, 3, r * 0.45);
  }

  // Battlements (sawtooth top)
  g.fillStyle(t.stoneLight, a);
  const bw = r * 0.22;
  const by = -r * 0.7;
  for (let i = -2; i <= 2; i++) {
    g.fillRect(i * bw - bw * 0.35, by, bw * 0.6, r * 0.15);
  }

  // Base platform
  g.fillRect(-r * 0.7, r * 0.5, r * 1.4, 3);
}

/* ── Scroll Library: book spines + scroll curve ── */
function drawScrollLibrary(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // Book spines (vertical lines on left)
  g.fillStyle(t.stoneLight, 0.16);
  for (let i = 0; i < 4; i++) {
    const x = -r * 0.6 + i * r * 0.12;
    g.fillRect(x, -r * 0.4, 2, r * 0.75);
  }
  // Shelf
  g.fillRect(-r * 0.65, r * 0.35, r * 0.55, 2);

  // Scroll (right side, spiral hint)
  g.fillStyle(t.glowColor, 0.14);
  g.fillRect(r * 0.1, -r * 0.2, r * 0.45, r * 0.35);
  // Roll ends
  g.fillCircle(r * 0.1, -r * 0.02, 4);
  g.fillCircle(r * 0.55, -r * 0.02, 4);
}

/* ── Gold: coin pile + sparkle dots ── */
function drawGold(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // Coin pile (pyramid: 3-2-1)
  g.fillStyle(t.glowColor, 0.2);
  // Bottom row
  g.fillCircle(-r * 0.2, r * 0.25, 5);
  g.fillCircle(0, r * 0.25, 5);
  g.fillCircle(r * 0.2, r * 0.25, 5);
  // Middle row
  g.fillCircle(-r * 0.1, r * 0.08, 5);
  g.fillCircle(r * 0.1, r * 0.08, 5);
  // Top
  g.fillCircle(0, -r * 0.08, 5);

  // Sparkle dots
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(-r * 0.4, -r * 0.4, 1.5);
  g.fillCircle(r * 0.3, -r * 0.3, 1);
  g.fillCircle(r * 0.5, r * 0.1, 1.5);
  g.fillCircle(-r * 0.2, -r * 0.55, 1);
}

/* ── Trap: diagonal grid + bottom spikes ── */
function drawTrap(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // Diagonal grid lines
  g.lineStyle(1, t.stoneDark, 0.15);
  const step = r * 0.35;
  for (let i = -3; i <= 3; i++) {
    const off = i * step;
    g.lineBetween(-r * 0.6 + off, -r * 0.6, -r * 0.6 + off + r * 0.6, r * 0.0);
    g.lineBetween(-r * 0.6 + off, r * 0.0, -r * 0.6 + off + r * 0.6, r * 0.6);
  }

  // Bottom spike triangles
  g.fillStyle(t.stoneLight, 0.2);
  for (let i = -2; i <= 2; i++) {
    const cx = i * r * 0.25;
    g.fillTriangle(cx - 4, r * 0.55, cx + 4, r * 0.55, cx, r * 0.3);
  }
}

/* ── Trap Corridor: gear (octagon) + directional spikes ── */
function drawTrapCorridor(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // Gear: octagon outline
  g.lineStyle(2, t.stoneLight, 0.2);
  const gr = r * 0.3;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    pts.push(Math.cos(angle) * gr, Math.sin(angle) * gr);
  }
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.strokePath();

  // Inner circle
  g.fillStyle(t.stoneDark, 0.15);
  g.fillCircle(0, 0, gr * 0.4);

  // Four-direction spikes
  g.fillStyle(t.stoneLight, 0.18);
  const sp = r * 0.6;
  // Up
  g.fillTriangle(-4, -sp + 8, 4, -sp + 8, 0, -sp);
  // Down
  g.fillTriangle(-4, sp - 8, 4, sp - 8, 0, sp);
  // Left
  g.fillTriangle(-sp + 8, -4, -sp + 8, 4, -sp, 0);
  // Right
  g.fillTriangle(sp - 8, -4, sp - 8, 4, sp, 0);
}

/* ── Armory: X weapon rack + shelf bar ── */
function drawArmory(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // X-shaped weapon rack
  g.lineStyle(2, t.stoneLight, 0.2);
  const ext = r * 0.45;
  g.lineBetween(-ext, -ext, ext, ext);
  g.lineBetween(ext, -ext, -ext, ext);

  // Small weapon shapes on ends
  g.fillStyle(t.glowColor, 0.15);
  // Sword tip (top-left)
  g.fillTriangle(-ext - 3, -ext - 3, -ext + 3, -ext, -ext, -ext + 3);
  // Axe (top-right)
  g.fillCircle(ext, -ext, 4);
  // Spear tip (bottom-left)
  g.fillTriangle(-ext, ext - 5, -ext - 3, ext + 3, -ext + 3, ext + 3);

  // Bottom shelf
  g.fillStyle(t.stoneLight, 0.15);
  g.fillRect(-r * 0.6, r * 0.55, r * 1.2, 2);
}

/* ── Medicine Hall: mortar+pestle + leaf shapes ── */
function drawMedicineHall(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // Mortar (bowl shape)
  g.fillStyle(t.stoneLight, 0.2);
  g.fillRect(-r * 0.2, r * 0.05, r * 0.4, r * 0.25);
  g.fillTriangle(-r * 0.25, r * 0.05, r * 0.25, r * 0.05, 0, r * 0.35);
  // Pestle (diagonal stick)
  g.lineStyle(2, t.stoneLight, 0.2);
  g.lineBetween(r * 0.05, r * 0.0, r * 0.35, -r * 0.35);
  g.fillCircle(r * 0.35, -r * 0.35, 3);

  // Leaf shapes (three small triangles)
  g.fillStyle(0x4a7a30, 0.18);
  g.fillTriangle(-r * 0.5, -r * 0.2, -r * 0.35, -r * 0.45, -r * 0.2, -r * 0.2);
  g.fillTriangle(-r * 0.35, -r * 0.15, -r * 0.2, -r * 0.4, -r * 0.05, -r * 0.15);
  g.fillTriangle(r * 0.3, -r * 0.3, r * 0.45, -r * 0.5, r * 0.5, -r * 0.25);
}

/* ── Spirit Altar: torii gate + flame ── */
function drawSpiritAltar(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  const a = 0.2;
  // Two pillars
  g.fillStyle(t.stoneLight, a);
  g.fillRect(-r * 0.45, -r * 0.2, 4, r * 0.75);
  g.fillRect(r * 0.45 - 4, -r * 0.2, 4, r * 0.75);

  // Top crossbar (curved via two rects + triangle)
  g.fillRect(-r * 0.55, -r * 0.25, r * 1.1, 3);
  g.fillRect(-r * 0.5, -r * 0.35, r * 1.0, 3);
  // Upward curve hints at ends
  g.fillTriangle(-r * 0.55, -r * 0.25, -r * 0.6, -r * 0.4, -r * 0.5, -r * 0.35);
  g.fillTriangle(r * 0.55, -r * 0.25, r * 0.6, -r * 0.4, r * 0.5, -r * 0.35);

  // Central flame
  g.fillStyle(t.glowColor, 0.22);
  g.fillTriangle(-5, r * 0.1, 5, r * 0.1, 0, -r * 0.15);
  g.fillStyle(0xffffff, 0.1);
  g.fillTriangle(-2, r * 0.05, 2, r * 0.05, 0, -r * 0.08);
}

/* ── Dragon's Lair: scale arcs + flame triangles ── */
function drawDragonsLair(g: Phaser.GameObjects.Graphics, r: number, t: DungeonTheme): void {
  // Scale pattern (overlapping arcs via small filled triangles)
  g.fillStyle(t.stoneLight, 0.14);
  const scaleW = r * 0.28;
  for (let row = 0; row < 3; row++) {
    const y = -r * 0.3 + row * scaleW * 0.8;
    const offset = row % 2 === 0 ? 0 : scaleW * 0.5;
    for (let col = -2; col <= 2; col++) {
      const x = col * scaleW + offset;
      g.fillTriangle(x - scaleW * 0.4, y + scaleW * 0.3, x + scaleW * 0.4, y + scaleW * 0.3, x, y - scaleW * 0.1);
    }
  }

  // Two flame triangles at bottom
  g.fillStyle(t.glowColor, 0.22);
  g.fillTriangle(-r * 0.3, r * 0.55, -r * 0.15, r * 0.55, -r * 0.22, r * 0.2);
  g.fillTriangle(r * 0.15, r * 0.55, r * 0.3, r * 0.55, r * 0.22, r * 0.2);
  // Inner bright core
  g.fillStyle(0xffffff, 0.08);
  g.fillTriangle(-r * 0.25, r * 0.5, -r * 0.18, r * 0.5, -r * 0.22, r * 0.3);
  g.fillTriangle(r * 0.18, r * 0.5, r * 0.25, r * 0.5, r * 0.22, r * 0.3);
}
