/**
 * Chibi-style invader silhouette shapes.
 *
 * Each invader uses a cute chibi aesthetic:
 *   - Large round head (≈40-45% of height)
 *   - Small chubby body
 *   - Stubby legs
 *   - Big round eyes with white shine dots
 *   - Character-specific accessory for identity
 */

import type { InvaderDef } from '../data/invaders';

// ─── Color helpers ───────────────────────────────────────────────────────────

function darken(c: number, amt = 0.4): number {
  const r = Math.floor(((c >> 16) & 0xff) * amt);
  const g = Math.floor(((c >> 8) & 0xff) * amt);
  const b = Math.floor((c & 0xff) * amt);
  return (r << 16) | (g << 8) | b;
}

function lighten(c: number, amt = 60): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + amt);
  const g = Math.min(255, ((c >> 8) & 0xff) + amt);
  const b = Math.min(255, (c & 0xff) + amt);
  return (r << 16) | (g << 8) | b;
}

// ─── Shared chibi helpers ────────────────────────────────────────────────────

/** Draw big round head centred at (hx, hy) with radius hr */
function drawHead(g: Phaser.GameObjects.Graphics, fill: number, hx: number, hy: number, hr: number): void {
  g.fillStyle(fill, 1);
  g.fillCircle(hx, hy, hr);
  // cheek blush
  g.fillStyle(0xff8888, 0.18);
  g.fillCircle(hx - hr * 0.45, hy + hr * 0.18, hr * 0.22);
  g.fillCircle(hx + hr * 0.45, hy + hr * 0.18, hr * 0.22);
}

/** Draw two cute eyes at (hx,hy) sized to head radius hr */
function drawEyes(g: Phaser.GameObjects.Graphics, hx: number, hy: number, hr: number, eyeColor = 0x222222): void {
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
function drawBody(g: Phaser.GameObjects.Graphics, fill: number, bx: number, by: number, bw: number, bh: number): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(bx - bw / 2, by, bw, bh, bw * 0.35);
}

/** Draw two stubby legs below (lx, ly) */
function drawLegs(g: Phaser.GameObjects.Graphics, fill: number, lx: number, ly: number, r: number): void {
  g.fillStyle(darken(fill, 0.7), 1);
  g.fillRoundedRect(lx - r * 0.28, ly, r * 0.2, r * 0.28, r * 0.08);
  g.fillRoundedRect(lx + r * 0.08, ly, r * 0.2, r * 0.28, r * 0.08);
}

// ─── Main drawing function ───────────────────────────────────────────────────

export function drawInvaderShape(g: Phaser.GameObjects.Graphics, type: string, def: InvaderDef): void {
  const r = def.radius;
  const cx = r, cy = r;
  const fill = def.color;
  const hi   = lighten(fill, 55);
  const dk   = darken(fill, 0.55);

  // Standard chibi layout constants
  const hr  = r * 0.42;          // head radius
  const hx  = cx;
  const hy  = cy - r * 0.22;     // head centre y
  const bw  = r * 0.68;          // body width
  const bh  = r * 0.42;          // body height
  const by  = hy + hr + r * 0.02;// body top y

  switch (type) {

    // ── Chapter 1 ─────────────────────────────────────────────────────────────

    case 'peasant': {
      // Straw-hat farmer with tiny pitchfork
      // Straw hat
      g.fillStyle(0xd4a030, 1);
      g.fillEllipse(hx, hy - hr * 0.82, hr * 2.2, hr * 0.5);
      g.fillStyle(0xc49020, 1);
      g.fillEllipse(hx, hy - hr * 0.95, hr * 0.9, hr * 0.35);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr);
      drawBody(g, dk, hx, by, bw, bh);
      // Pitchfork (right side)
      g.fillStyle(0xb08040, 1);
      g.fillRect(cx + r * 0.42, cy - r * 0.5, r * 0.06, r * 1.0);
      g.fillRect(cx + r * 0.34, cy - r * 0.5, r * 0.06, r * 0.2);
      g.fillRect(cx + r * 0.5, cy - r * 0.5, r * 0.06, r * 0.2);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'soldier': {
      // Cute pointy blue helmet, tiny shield
      // Helmet
      g.fillStyle(hi, 1);
      g.fillTriangle(hx, hy - hr * 1.6, hx - hr, hy - hr * 0.5, hx + hr, hy - hr * 0.5);
      g.fillStyle(fill, 1);
      g.fillRect(hx - hr, hy - hr * 0.55, hr * 2, hr * 0.4);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr);
      drawBody(g, dk, hx, by, bw, bh);
      // Mini shield (left)
      g.fillStyle(hi, 1);
      g.fillRoundedRect(cx - r * 0.65, by + bh * 0.05, r * 0.22, r * 0.32, r * 0.06);
      g.fillStyle(fill, 0.5);
      g.fillRect(cx - r * 0.56, by + bh * 0.2, r * 0.04, r * 0.16);
      g.fillRect(cx - r * 0.64, by + bh * 0.26, r * 0.2, r * 0.04);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'knight': {
      // Heavy flat-top helmet, big shield, proud stance
      // Flat helmet
      g.fillStyle(hi, 1);
      g.fillRect(hx - hr * 1.05, hy - hr * 1.1, hr * 2.1, hr * 0.55);
      g.fillStyle(fill, 1);
      g.fillRect(hx - hr, hy - hr * 0.6, hr * 2, hr * 0.2);
      drawHead(g, fill, hx, hy, hr);
      // Visor slit
      g.fillStyle(0x223344, 0.6);
      g.fillRect(hx - hr * 0.55, hy - hr * 0.12, hr * 1.1, hr * 0.18);
      drawBody(g, dk, hx, by, bw * 1.1, bh);
      // Big shield (left)
      g.fillStyle(hi, 1);
      g.fillRoundedRect(cx - r * 0.78, by - bh * 0.1, r * 0.3, r * 0.52, r * 0.07);
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(cx - r * 0.72, by + r * 0.02, r * 0.06, r * 0.28);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'shaman': {
      // Two cute horns, wide-sleeve robe
      // Horns
      g.fillStyle(hi, 1);
      g.fillTriangle(hx - hr * 0.45, hy - hr * 1.55, hx - hr * 0.6, hy - hr * 0.75, hx - hr * 0.2, hy - hr * 0.75);
      g.fillTriangle(hx + hr * 0.45, hy - hr * 1.55, hx + hr * 0.2, hy - hr * 0.75, hx + hr * 0.6, hy - hr * 0.75);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0xff4488);
      // Glowing orb
      g.fillStyle(0xff88cc, 0.7);
      g.fillCircle(hx, hy + hr * 0.52, hr * 0.18);
      // Wide robe body
      g.fillStyle(dk, 1);
      g.fillTriangle(cx - r * 0.55, cy + r * 0.75, cx + r * 0.55, cy + r * 0.75, cx, by);
      g.fillStyle(hi, 0.25);
      g.fillCircle(hx, by + bh * 0.3, hr * 0.3);
      break;
    }

    case 'void': {
      // Cute purple blob with one big eye and tiny tentacles
      g.fillStyle(fill, 0.3);
      g.fillCircle(cx, cy, r * 0.88);
      g.fillStyle(fill, 1);
      g.fillCircle(cx, cy - r * 0.08, r * 0.62);
      // Single big eye
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx, cy - r * 0.18, hr * 0.55);
      g.fillStyle(0xcc44ff, 1);
      g.fillCircle(cx, cy - r * 0.18, hr * 0.35);
      g.fillStyle(0x220033, 1);
      g.fillCircle(cx, cy - r * 0.18, hr * 0.18);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(cx + hr * 0.12, cy - r * 0.26, hr * 0.1);
      // Mini tentacles
      g.fillStyle(fill, 0.9);
      g.fillRoundedRect(cx - r * 0.5, cy + r * 0.42, r * 0.15, r * 0.3, r * 0.06);
      g.fillRoundedRect(cx - r * 0.15, cy + r * 0.5, r * 0.15, r * 0.32, r * 0.06);
      g.fillRoundedRect(cx + r * 0.22, cy + r * 0.45, r * 0.15, r * 0.28, r * 0.06);
      g.fillRoundedRect(cx + r * 0.5, cy + r * 0.38, r * 0.12, r * 0.26, r * 0.06);
      break;
    }

    case 'undying': {
      // Cute skeleton with red glowing eyes, tiny raised fist
      // Hood shadow
      g.fillStyle(0x3a0008, 0.5);
      g.fillCircle(cx, cy - r * 0.18, r * 0.5);
      // Skull head (bone-white)
      g.fillStyle(0xeeeecc, 1);
      g.fillCircle(hx, hy, hr);
      // Eye sockets (red glowing)
      g.fillStyle(0xff2200, 0.9);
      g.fillCircle(hx - hr * 0.28, hy - hr * 0.05, hr * 0.18);
      g.fillCircle(hx + hr * 0.28, hy - hr * 0.05, hr * 0.18);
      g.fillStyle(0xff6644, 0.5);
      g.fillCircle(hx - hr * 0.28, hy - hr * 0.05, hr * 0.09);
      g.fillCircle(hx + hr * 0.28, hy - hr * 0.05, hr * 0.09);
      // Cute little teeth
      g.fillStyle(0xffffff, 1);
      for (let i = -1; i <= 1; i++) {
        g.fillRect(hx + i * hr * 0.22 - hr * 0.08, hy + hr * 0.28, hr * 0.14, hr * 0.18);
      }
      drawBody(g, fill, hx, by, bw * 0.85, bh * 0.9);
      // Raised fist (right)
      g.fillStyle(0xeeeecc, 1);
      g.fillCircle(cx + r * 0.5, by + bh * 0.1, hr * 0.22);
      drawLegs(g, 0x555555, cx, by + bh * 0.9, r);
      break;
    }

    // ── Chapter 2 ─────────────────────────────────────────────────────────────

    case 'berserker': {
      // Spiky red hair, angry eyebrows, chubby rage body
      // Spiky hair (4 spikes)
      g.fillStyle(0xff3300, 1);
      for (let i = 0; i < 4; i++) {
        const sx = hx - hr * 0.55 + i * hr * 0.38;
        g.fillTriangle(sx, hy - hr * 1.7 + (i % 2) * hr * 0.25, sx - hr * 0.18, hy - hr * 0.8, sx + hr * 0.18, hy - hr * 0.8);
      }
      drawHead(g, fill, hx, hy, hr);
      // Angry eyebrows
      g.lineStyle(hr * 0.2, 0x220000, 1);
      g.lineBetween(hx - hr * 0.5, hy - hr * 0.3, hx - hr * 0.1, hy - hr * 0.15);
      g.lineBetween(hx + hr * 0.5, hy - hr * 0.3, hx + hr * 0.1, hy - hr * 0.15);
      drawEyes(g, hx, hy + hr * 0.08, hr, 0x440000);
      drawBody(g, dk, hx, by, bw * 1.1, bh);
      // Weapon arm raised
      g.fillStyle(0xcc6600, 1);
      g.fillRect(cx + r * 0.4, by - bh * 0.5, r * 0.12, r * 0.55);
      g.fillStyle(hi, 1);
      g.fillCircle(cx + r * 0.46, by - bh * 0.5, hr * 0.22);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'shadow_ninja': {
      // Head wrap, tiny body, visible gleaming blade
      // Head wrap
      g.fillStyle(dk, 1);
      g.fillCircle(hx, hy, hr * 1.08);
      // Wrap band
      g.fillStyle(fill, 1);
      g.fillRect(hx - hr, hy - hr * 0.1, hr * 2, hr * 0.28);
      // Eyes only (peering out)
      g.fillStyle(0x00ccff, 0.9);
      g.fillCircle(hx - hr * 0.28, hy + hr * 0.05, hr * 0.14);
      g.fillCircle(hx + hr * 0.28, hy + hr * 0.05, hr * 0.14);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(hx - hr * 0.22, hy, hr * 0.06);
      g.fillCircle(hx + hr * 0.34, hy, hr * 0.06);
      drawBody(g, dk, hx, by, bw * 0.8, bh * 0.85);
      // Gleaming blade (diagonal)
      g.fillStyle(0x88ddff, 1);
      g.fillRect(cx + r * 0.18, by - bh * 0.1, r * 0.55, r * 0.07);
      g.fillStyle(0xffffff, 0.5);
      g.fillRect(cx + r * 0.22, by - r * 0.14, r * 0.38, r * 0.03);
      drawLegs(g, dk, cx, by + bh * 0.85, r);
      break;
    }

    case 'siege_soldier': {
      // Very wide chubby armored body, small head, big shield front
      // Wide body first (battering ram style)
      g.fillStyle(fill, 1);
      g.fillRoundedRect(cx - r * 0.72, cy - r * 0.1, r * 1.44, r * 0.65, r * 0.18);
      g.fillStyle(hi, 0.2);
      g.fillRect(cx - r * 0.68, cy - r * 0.05, r * 1.36, r * 0.1);
      // Small head peeking above
      drawHead(g, fill, hx, hy + hr * 0.3, hr * 0.85);
      g.fillStyle(hi, 0.35);
      g.fillRect(hx - hr * 0.6, hy + hr * 0.3 - hr * 0.75, hr * 1.2, hr * 0.25);
      drawEyes(g, hx, hy + hr * 0.35, hr * 0.85);
      // Shield front
      g.fillStyle(lighten(fill, 35), 0.6);
      g.fillRect(cx - r * 0.5, cy - r * 0.1, r * 1.0, r * 0.08);
      // Legs
      g.fillStyle(darken(fill, 0.65), 1);
      g.fillRoundedRect(cx - r * 0.38, cy + r * 0.55, r * 0.25, r * 0.28, r * 0.06);
      g.fillRoundedRect(cx + r * 0.13, cy + r * 0.55, r * 0.25, r * 0.28, r * 0.06);
      break;
    }

    case 'holy_paladin': {
      // Golden halo floating above, cross emblem on body
      // Halo glow
      g.fillStyle(0xffff44, 0.18);
      g.fillCircle(hx, hy - hr * 1.1, hr * 0.65);
      g.lineStyle(hr * 0.18, 0xffdd00, 0.9);
      g.strokeCircle(hx, hy - hr * 1.1, hr * 0.42);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0x886600);
      // Smile
      g.lineStyle(hr * 0.14, 0x553300, 0.7);
      g.beginPath();
      g.arc(hx, hy + hr * 0.3, hr * 0.22, 0.2, Math.PI - 0.2);
      g.strokePath();
      drawBody(g, dk, hx, by, bw, bh);
      // Cross
      g.fillStyle(0xffdd00, 0.8);
      g.fillRect(hx - hr * 0.06, by + bh * 0.12, hr * 0.12, bh * 0.72);
      g.fillRect(hx - hr * 0.28, by + bh * 0.32, hr * 0.56, hr * 0.12);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'iron_golem': {
      // Square block head, massive rectangular body, red eyes
      // Square head (oversized)
      g.fillStyle(fill, 1);
      g.fillRoundedRect(hx - hr * 1.05, hy - hr, hr * 2.1, hr * 2.0, hr * 0.18);
      g.fillStyle(hi, 0.15);
      g.fillRect(hx - hr * 0.9, hy - hr * 0.9, hr * 1.8, hr * 0.25);
      // Red eyes (bolts)
      g.fillStyle(0xff3300, 0.9);
      g.fillRect(hx - hr * 0.62, hy - hr * 0.2, hr * 0.42, hr * 0.22);
      g.fillRect(hx + hr * 0.2, hy - hr * 0.2, hr * 0.42, hr * 0.22);
      g.fillStyle(0xff6644, 0.5);
      g.fillRect(hx - hr * 0.5, hy - hr * 0.14, hr * 0.18, hr * 0.1);
      g.fillRect(hx + hr * 0.32, hy - hr * 0.14, hr * 0.18, hr * 0.1);
      // Bolts on face
      g.fillStyle(dk, 1);
      g.fillCircle(hx - hr * 0.75, hy - hr * 0.5, hr * 0.1);
      g.fillCircle(hx + hr * 0.75, hy - hr * 0.5, hr * 0.1);
      // Wide body
      g.fillStyle(darken(fill, 0.7), 1);
      g.fillRoundedRect(cx - r * 0.6, by, r * 1.2, bh * 0.9, r * 0.1);
      g.fillStyle(0x505860, 0.5);
      g.fillRect(cx - r * 0.55, by + bh * 0.18, r * 1.1, r * 0.06);
      // Legs (thick)
      g.fillStyle(darken(fill, 0.55), 1);
      g.fillRoundedRect(cx - r * 0.38, by + bh * 0.9, r * 0.28, r * 0.32, r * 0.07);
      g.fillRoundedRect(cx + r * 0.1, by + bh * 0.9, r * 0.28, r * 0.32, r * 0.07);
      break;
    }

    case 'high_priest': {
      // Tall 3-point crown, long purple robe, glowing staff
      // Crown (3 points)
      g.fillStyle(hi, 1);
      g.fillTriangle(hx - hr * 0.42, hy - hr * 1.72, hx - hr * 0.52, hy - hr * 0.92, hx - hr * 0.18, hy - hr * 0.92);
      g.fillTriangle(hx, hy - hr * 2.0, hx - hr * 0.18, hy - hr * 0.92, hx + hr * 0.18, hy - hr * 0.92);
      g.fillTriangle(hx + hr * 0.42, hy - hr * 1.72, hx + hr * 0.18, hy - hr * 0.92, hx + hr * 0.52, hy - hr * 0.92);
      g.fillRect(hx - hr * 0.55, hy - hr * 0.98, hr * 1.1, hr * 0.2);
      // Jewels on crown
      g.fillStyle(0xff44cc, 1);
      g.fillCircle(hx - hr * 0.38, hy - hr * 1.35, hr * 0.1);
      g.fillCircle(hx, hy - hr * 1.58, hr * 0.12);
      g.fillCircle(hx + hr * 0.38, hy - hr * 1.35, hr * 0.1);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0xcc44ff);
      // Robe (triangular, wide)
      g.fillStyle(dk, 1);
      g.fillTriangle(cx - r * 0.52, cy + r * 0.78, cx + r * 0.52, cy + r * 0.78, cx, by);
      // Staff
      g.lineStyle(hr * 0.18, hi, 0.9);
      g.lineBetween(cx + r * 0.52, hy - hr * 0.5, cx + r * 0.52, cy + r * 0.6);
      g.fillStyle(0xff88ff, 0.85);
      g.fillCircle(cx + r * 0.52, hy - hr * 0.6, hr * 0.22);
      break;
    }

    case 'mercenary_captain': {
      // Feathered hat, cape flowing right
      // Feathered hat
      g.fillStyle(dk, 1);
      g.fillEllipse(hx, hy - hr * 0.88, hr * 2.0, hr * 0.48);
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(hx + hr * 0.5, hy - hr * 1.7, hx + hr * 0.2, hy - hr * 0.7, hx + hr * 0.85, hy - hr * 0.7);
      // Hat brim shine
      g.fillStyle(hi, 0.3);
      g.fillEllipse(hx, hy - hr * 0.95, hr * 1.7, hr * 0.22);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0x553300);
      // Smile
      g.lineStyle(hr * 0.13, 0x553300, 0.7);
      g.beginPath();
      g.arc(hx, hy + hr * 0.28, hr * 0.2, 0.2, Math.PI - 0.2);
      g.strokePath();
      drawBody(g, dk, hx, by, bw, bh);
      // Cape (right)
      g.fillStyle(0xaa2200, 0.75);
      g.fillTriangle(cx + r * 0.25, by, cx + r * 0.72, cy + r * 0.72, cx + r * 0.25, cy + r * 0.72);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'trap_breaker': {
      // Goggles on head, pickaxe over shoulder
      drawHead(g, fill, hx, hy, hr);
      // Goggles
      g.fillStyle(0x88ddff, 0.7);
      g.fillCircle(hx - hr * 0.3, hy - hr * 0.1, hr * 0.24);
      g.fillCircle(hx + hr * 0.3, hy - hr * 0.1, hr * 0.24);
      g.lineStyle(hr * 0.12, 0x334444, 0.9);
      g.strokeCircle(hx - hr * 0.3, hy - hr * 0.1, hr * 0.24);
      g.strokeCircle(hx + hr * 0.3, hy - hr * 0.1, hr * 0.24);
      g.fillStyle(0x334444, 1);
      g.fillRect(hx - hr * 0.08, hy - hr * 0.14, hr * 0.16, hr * 0.1);
      // Cheeks visible
      g.fillStyle(0xff8888, 0.25);
      g.fillCircle(hx - hr * 0.6, hy + hr * 0.25, hr * 0.2);
      g.fillCircle(hx + hr * 0.6, hy + hr * 0.25, hr * 0.2);
      drawBody(g, dk, hx, by, bw, bh);
      // Pickaxe (diagonal over shoulder)
      g.lineStyle(hr * 0.2, 0x886630, 0.9);
      g.lineBetween(cx - r * 0.18, by - bh * 0.2, cx + r * 0.58, by + bh * 0.5);
      g.fillStyle(0xaaaaaa, 1);
      g.fillTriangle(cx + r * 0.5, by - bh * 0.3, cx + r * 0.72, by, cx + r * 0.42, by + r * 0.1);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'fox_queen': {
      // Fox ears, crown, three tails, elegant
      // Tails (behind)
      g.fillStyle(lighten(fill, 25), 0.7);
      g.fillEllipse(cx - r * 0.48, cy + r * 0.5, r * 0.3, r * 0.55);
      g.fillEllipse(cx, cy + r * 0.56, r * 0.28, r * 0.52);
      g.fillEllipse(cx + r * 0.48, cy + r * 0.5, r * 0.3, r * 0.55);
      // Tail tips (white)
      g.fillStyle(0xffffff, 0.5);
      g.fillEllipse(cx - r * 0.48, cy + r * 0.7, r * 0.18, r * 0.2);
      g.fillEllipse(cx, cy + r * 0.74, r * 0.16, r * 0.18);
      g.fillEllipse(cx + r * 0.48, cy + r * 0.7, r * 0.18, r * 0.2);
      // Fox ears
      g.fillStyle(fill, 1);
      g.fillTriangle(hx - hr * 0.5, hy - hr * 1.6, hx - hr * 0.72, hy - hr * 0.78, hx - hr * 0.18, hy - hr * 0.78);
      g.fillTriangle(hx + hr * 0.5, hy - hr * 1.6, hx + hr * 0.18, hy - hr * 0.78, hx + hr * 0.72, hy - hr * 0.78);
      // Inner ear
      g.fillStyle(0xff9988, 0.7);
      g.fillTriangle(hx - hr * 0.5, hy - hr * 1.42, hx - hr * 0.58, hy - hr * 0.9, hx - hr * 0.24, hy - hr * 0.9);
      g.fillTriangle(hx + hr * 0.5, hy - hr * 1.42, hx + hr * 0.24, hy - hr * 0.9, hx + hr * 0.58, hy - hr * 0.9);
      // Crown
      g.fillStyle(0xffd700, 1);
      g.fillRect(hx - hr * 0.42, hy - hr * 0.86, hr * 0.84, hr * 0.18);
      g.fillTriangle(hx - hr * 0.32, hy - hr * 0.86, hx - hr * 0.24, hy - hr * 1.12, hx - hr * 0.12, hy - hr * 0.86);
      g.fillTriangle(hx - hr * 0.06, hy - hr * 0.86, hx, hy - hr * 1.22, hx + hr * 0.06, hy - hr * 0.86);
      g.fillTriangle(hx + hr * 0.12, hy - hr * 0.86, hx + hr * 0.24, hy - hr * 1.12, hx + hr * 0.32, hy - hr * 0.86);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0xcc4400);
      // Whisker dots
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(hx - hr * 0.58, hy + hr * 0.28, hr * 0.06);
      g.fillCircle(hx - hr * 0.45, hy + hr * 0.35, hr * 0.05);
      g.fillCircle(hx + hr * 0.58, hy + hr * 0.28, hr * 0.06);
      g.fillCircle(hx + hr * 0.45, hy + hr * 0.35, hr * 0.05);
      drawBody(g, dk, hx, by, bw, bh);
      break;
    }

    // ── Chapter 3 ─────────────────────────────────────────────────────────────

    case 'undying_knight': {
      // Cracked knight helmet, red glow from cracks
      g.fillStyle(hi, 1);
      g.fillRect(hx - hr * 1.05, hy - hr * 1.1, hr * 2.1, hr * 0.55);
      g.fillStyle(fill, 1);
      g.fillRect(hx - hr, hy - hr * 0.6, hr * 2, hr * 0.2);
      drawHead(g, fill, hx, hy, hr);
      // Visor with red glow
      g.fillStyle(0xff2200, 0.5);
      g.fillRect(hx - hr * 0.55, hy - hr * 0.12, hr * 1.1, hr * 0.2);
      // Crack lines
      g.lineStyle(hr * 0.12, 0xff2200, 0.8);
      g.lineBetween(hx - hr * 0.2, hy - hr * 0.65, hx + hr * 0.1, hy + hr * 0.3);
      g.lineBetween(hx + hr * 0.05, hy - hr * 0.4, hx - hr * 0.15, hy + hr * 0.2);
      drawBody(g, dk, hx, by, bw * 1.05, bh);
      // Cracks on body
      g.lineStyle(hr * 0.1, 0xff2200, 0.6);
      g.lineBetween(cx - r * 0.1, by + bh * 0.2, cx + r * 0.15, by + bh * 0.8);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'scarecrow_mage': {
      // Wide-brim hat, stitched smile, stick-cross body
      // Hat brim
      g.fillStyle(dk, 1);
      g.fillEllipse(hx, hy - hr * 0.72, hr * 2.5, hr * 0.45);
      g.fillTriangle(hx, hy - hr * 2.0, hx - hr * 0.55, hy - hr * 0.72, hx + hr * 0.55, hy - hr * 0.72);
      // Straw sticking out
      g.fillStyle(0xd4a030, 1);
      g.fillRect(hx - hr * 1.05, hy - hr * 0.72, hr * 0.22, hr * 0.18);
      g.fillRect(hx + hr * 0.83, hy - hr * 0.72, hr * 0.22, hr * 0.18);
      drawHead(g, 0xd4b87a, hx, hy, hr);
      // Stitched eyes (X marks)
      g.lineStyle(hr * 0.15, 0x443300, 0.9);
      g.lineBetween(hx - hr * 0.38, hy - hr * 0.15, hx - hr * 0.18, hy + hr * 0.05);
      g.lineBetween(hx - hr * 0.18, hy - hr * 0.15, hx - hr * 0.38, hy + hr * 0.05);
      g.lineBetween(hx + hr * 0.18, hy - hr * 0.15, hx + hr * 0.38, hy + hr * 0.05);
      g.lineBetween(hx + hr * 0.38, hy - hr * 0.15, hx + hr * 0.18, hy + hr * 0.05);
      // Stitched smile
      g.lineStyle(hr * 0.1, 0x553300, 0.8);
      for (let i = 0; i < 4; i++) {
        g.lineBetween(hx - hr * 0.28 + i * hr * 0.18, hy + hr * 0.35, hx - hr * 0.2 + i * hr * 0.18, hy + hr * 0.45);
      }
      // Stick-cross body (wide horizontal arms)
      g.fillStyle(0xb08040, 1);
      g.fillRect(cx - r * 0.1, by, r * 0.2, bh * 0.8);
      g.fillRect(cx - r * 0.72, by + bh * 0.18, r * 1.44, r * 0.18);
      // Hay at arm ends
      g.fillStyle(0xd4a030, 0.7);
      g.fillCircle(cx - r * 0.7, by + bh * 0.27, hr * 0.22);
      g.fillCircle(cx + r * 0.7, by + bh * 0.27, hr * 0.22);
      break;
    }

    case 'venom_dancer': {
      // Green dancer, swirling tail, sparkle effects
      // Swirl tail
      g.fillStyle(darken(fill, 0.7), 0.6);
      g.fillEllipse(cx, cy + r * 0.62, r * 0.5, r * 0.35);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0x004400);
      // Curved smile
      g.lineStyle(hr * 0.14, 0x003300, 0.8);
      g.beginPath();
      g.arc(hx, hy + hr * 0.28, hr * 0.24, 0.15, Math.PI - 0.15);
      g.strokePath();
      // Dancing body (tilted)
      g.fillStyle(dk, 1);
      g.fillEllipse(hx + hr * 0.12, by + bh * 0.5, bw * 0.85, bh * 0.95);
      // Poison sparkles
      g.fillStyle(0x44ff44, 0.7);
      g.fillCircle(cx - r * 0.55, cy + r * 0.0, hr * 0.12);
      g.fillCircle(cx + r * 0.58, cy + r * 0.15, hr * 0.1);
      g.fillCircle(cx - r * 0.45, cy + r * 0.42, hr * 0.09);
      // Swirling arms
      g.lineStyle(hr * 0.22, fill, 0.8);
      g.beginPath();
      g.arc(cx - r * 0.35, by + bh * 0.25, r * 0.3, -0.8, 1.0);
      g.strokePath();
      g.beginPath();
      g.arc(cx + r * 0.42, by + bh * 0.18, r * 0.28, Math.PI + 0.2, Math.PI * 2 - 0.2);
      g.strokePath();
      break;
    }

    case 'void_assassin':
    case 'void_assassin_elite': {
      // Diamond body shape, glowing single eye, portal ring
      const iselite = type === 'void_assassin_elite';
      // Portal ring
      g.lineStyle(iselite ? 2.5 : 1.8, iselite ? 0xaa44ff : 0x6600cc, 0.5);
      g.strokeCircle(cx, cy, r * 0.88);
      if (iselite) {
        g.lineStyle(1.2, 0xcc88ff, 0.3);
        g.strokeCircle(cx, cy, r * 0.72);
      }
      // Diamond body
      g.fillStyle(fill, 1);
      g.fillPoints([
        { x: cx, y: cy - r * 0.72 },
        { x: cx + r * 0.55, y: cy },
        { x: cx, y: cy + r * 0.72 },
        { x: cx - r * 0.55, y: cy },
      ], true);
      // Shimmer face on diamond
      g.fillStyle(lighten(fill, 40), 0.3);
      g.fillPoints([
        { x: cx, y: cy - r * 0.72 },
        { x: cx + r * 0.55, y: cy },
        { x: cx, y: cy - r * 0.1 },
        { x: cx - r * 0.55, y: cy },
      ], true);
      // Big glowing eye
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(cx, cy - r * 0.06, hr * (iselite ? 0.52 : 0.44));
      g.fillStyle(iselite ? 0xcc44ff : 0x8833cc, 1);
      g.fillCircle(cx, cy - r * 0.06, hr * (iselite ? 0.36 : 0.3));
      g.fillStyle(0x110022, 1);
      g.fillCircle(cx, cy - r * 0.06, hr * (iselite ? 0.2 : 0.16));
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(cx + hr * 0.14, cy - r * 0.12, hr * 0.1);
      if (iselite) {
        // Extra sparkles
        g.fillStyle(0xcc88ff, 0.6);
        g.fillCircle(cx - r * 0.45, cy + r * 0.38, hr * 0.12);
        g.fillCircle(cx + r * 0.5, cy - r * 0.38, hr * 0.1);
      }
      break;
    }

    case 'dragon_king': {
      // Cute dragon: big horned head, little wings, toothy grin
      // Horns
      g.fillStyle(hi, 1);
      g.fillTriangle(hx - hr * 0.5, hy - hr * 1.82, hx - hr * 0.68, hy - hr * 0.82, hx - hr * 0.22, hy - hr * 0.82);
      g.fillTriangle(hx + hr * 0.5, hy - hr * 1.82, hx + hr * 0.22, hy - hr * 0.82, hx + hr * 0.68, hy - hr * 0.82);
      g.fillStyle(0xffffff, 0.35);
      g.fillTriangle(hx - hr * 0.5, hy - hr * 1.65, hx - hr * 0.62, hy - hr * 0.9, hx - hr * 0.28, hy - hr * 0.9);
      drawHead(g, fill, hx, hy, hr * 1.08);
      // Dragon eyes (slit pupils)
      g.fillStyle(0xffdd00, 1);
      g.fillCircle(hx - hr * 0.32, hy - hr * 0.05, hr * 0.2);
      g.fillCircle(hx + hr * 0.32, hy - hr * 0.05, hr * 0.2);
      g.fillStyle(0x002244, 1);
      g.fillRect(hx - hr * 0.34, hy - hr * 0.15, hr * 0.04, hr * 0.2);
      g.fillRect(hx + hr * 0.3, hy - hr * 0.15, hr * 0.04, hr * 0.2);
      // Snout
      g.fillStyle(lighten(fill, 25), 1);
      g.fillEllipse(hx, hy + hr * 0.38, hr * 0.72, hr * 0.38);
      // Cute teeth
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(hx - hr * 0.22, hy + hr * 0.28, hx - hr * 0.14, hy + hr * 0.28, hx - hr * 0.18, hy + hr * 0.48);
      g.fillTriangle(hx + hr * 0.14, hy + hr * 0.28, hx + hr * 0.22, hy + hr * 0.28, hx + hr * 0.18, hy + hr * 0.48);
      // Mini wings
      g.fillStyle(darken(fill, 0.65), 0.75);
      g.fillTriangle(cx - r * 0.55, by - bh * 0.1, cx - r * 0.9, by - bh * 0.5, cx - r * 0.32, by + bh * 0.3);
      g.fillTriangle(cx + r * 0.55, by - bh * 0.1, cx + r * 0.9, by - bh * 0.5, cx + r * 0.32, by + bh * 0.3);
      drawBody(g, dk, hx, by, bw, bh * 0.85);
      // Dragon scales on body
      g.lineStyle(0.8, lighten(fill, 30), 0.35);
      g.beginPath(); g.arc(cx - r * 0.12, by + bh * 0.3, r * 0.18, 0, Math.PI); g.strokePath();
      g.beginPath(); g.arc(cx + r * 0.15, by + bh * 0.3, r * 0.18, 0, Math.PI); g.strokePath();
      drawLegs(g, dk, cx, by + bh * 0.85, r);
      break;
    }

    // ── Chapter 4 ─────────────────────────────────────────────────────────────

    case 'death_emissary': {
      // Big dark hood, floating scythe, skull peeking
      // Dark aura glow
      g.fillStyle(fill, 0.15);
      g.fillCircle(cx, cy, r * 0.95);
      // Hood (large triangle)
      g.fillStyle(darken(fill, 0.45), 1);
      g.fillTriangle(hx, hy - hr * 1.9, hx - hr * 1.3, hy + hr * 0.5, hx + hr * 1.3, hy + hr * 0.5);
      g.fillStyle(fill, 1);
      g.fillTriangle(hx, hy - hr * 1.7, hx - hr * 1.1, hy + hr * 0.35, hx + hr * 1.1, hy + hr * 0.35);
      // Skull face (small, cute)
      g.fillStyle(0xeeeecc, 1);
      g.fillCircle(hx, hy, hr * 0.72);
      // Skull eyes
      g.fillStyle(0xff0044, 0.85);
      g.fillCircle(hx - hr * 0.28, hy - hr * 0.05, hr * 0.18);
      g.fillCircle(hx + hr * 0.28, hy - hr * 0.05, hr * 0.18);
      // Teeth
      g.fillStyle(0xffffff, 1);
      g.fillRect(hx - hr * 0.28, hy + hr * 0.28, hr * 0.16, hr * 0.18);
      g.fillRect(hx - hr * 0.06, hy + hr * 0.28, hr * 0.16, hr * 0.18);
      g.fillRect(hx + hr * 0.12, hy + hr * 0.28, hr * 0.16, hr * 0.18);
      // Tattered cloak body
      g.fillStyle(fill, 0.9);
      g.fillTriangle(cx - r * 0.55, cy + r * 0.82, cx + r * 0.45, cy + r * 0.82, cx, hy + hr * 0.35);
      g.fillTriangle(cx - r * 0.35, cy + r * 0.88, cx + r * 0.65, cy + r * 0.82, cx + r * 0.15, hy + hr * 0.6);
      // Floating scythe
      g.lineStyle(2.5, 0xaaaaaa, 0.9);
      g.lineBetween(cx + r * 0.5, hy - hr * 0.7, cx + r * 0.5, cy + r * 0.55);
      g.lineStyle(2, 0xcccccc, 0.9);
      g.beginPath();
      g.arc(cx + r * 0.22, hy - hr * 0.7, r * 0.32, -0.6, 1.3);
      g.strokePath();
      // Scythe glow
      g.fillStyle(0xff2244, 0.3);
      g.fillCircle(cx + r * 0.22, hy - hr * 0.8, hr * 0.22);
      break;
    }

    case 'ghost_add': {
      // Tiny round ghost, wide eyes, little tail
      const gr = r * 0.72;
      g.fillStyle(fill, 0.25);
      g.fillCircle(cx, cy, gr * 0.88);
      g.fillStyle(fill, 0.82);
      g.fillCircle(cx, cy - gr * 0.18, gr * 0.62);
      // Wispy tail (3 bumps)
      g.fillRoundedRect(cx - gr * 0.5, cy + gr * 0.22, gr * 0.32, gr * 0.42, gr * 0.14);
      g.fillRoundedRect(cx - gr * 0.12, cy + gr * 0.3, gr * 0.28, gr * 0.5, gr * 0.12);
      g.fillRoundedRect(cx + gr * 0.22, cy + gr * 0.25, gr * 0.28, gr * 0.42, gr * 0.12);
      // Big cute eyes
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(cx - gr * 0.22, cy - gr * 0.22, gr * 0.22);
      g.fillCircle(cx + gr * 0.22, cy - gr * 0.22, gr * 0.22);
      g.fillStyle(0x8888cc, 1);
      g.fillCircle(cx - gr * 0.22, cy - gr * 0.22, gr * 0.14);
      g.fillCircle(cx + gr * 0.22, cy - gr * 0.22, gr * 0.14);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(cx - gr * 0.16, cy - gr * 0.28, gr * 0.07);
      g.fillCircle(cx + gr * 0.28, cy - gr * 0.28, gr * 0.07);
      break;
    }

    // ── Chapter 5 ─────────────────────────────────────────────────────────────

    case 'void_invader': {
      // Larger void blob, THREE cute eyes triangle arrangement
      g.fillStyle(fill, 0.25);
      g.fillCircle(cx, cy, r * 0.92);
      g.fillStyle(fill, 1);
      g.fillCircle(cx, cy - r * 0.06, r * 0.68);
      // Three eyes
      const eyePositions = [
        { x: cx - hr * 0.38, y: cy - r * 0.22 },
        { x: cx + hr * 0.38, y: cy - r * 0.22 },
        { x: cx, y: cy + r * 0.02 },
      ];
      eyePositions.forEach(ep => {
        g.fillStyle(0xffffff, 0.95);
        g.fillCircle(ep.x, ep.y, hr * 0.22);
        g.fillStyle(0xcc44ff, 1);
        g.fillCircle(ep.x, ep.y, hr * 0.14);
        g.fillStyle(0x110022, 1);
        g.fillCircle(ep.x, ep.y, hr * 0.07);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(ep.x + hr * 0.07, ep.y - hr * 0.07, hr * 0.055);
      });
      // More tentacles than 'void'
      g.fillStyle(fill, 0.88);
      const tentX = [cx - r * 0.55, cx - r * 0.25, cx + r * 0.0, cx + r * 0.28, cx + r * 0.55];
      tentX.forEach((tx, i) => {
        const th = r * (0.25 + (i % 2) * 0.06);
        g.fillRoundedRect(tx - r * 0.08, cy + r * 0.48, r * 0.16, th, r * 0.06);
      });
      break;
    }

    case 'undying_warrior': {
      // Skeleton warrior with big sword, fierce expression
      // Sword (tall, left of body)
      g.fillStyle(0xcccccc, 1);
      g.fillRect(cx - r * 0.6, hy - hr * 0.5, r * 0.1, r * 1.0);
      g.fillStyle(0x888888, 1);
      g.fillRect(cx - r * 0.7, by - bh * 0.05, r * 0.3, r * 0.09);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(cx - r * 0.55, by - bh * 0.08, hr * 0.14);
      // Bone head
      g.fillStyle(0xddddbb, 1);
      g.fillCircle(hx, hy, hr);
      // Red eye sockets
      g.fillStyle(0xff2200, 0.9);
      g.fillCircle(hx - hr * 0.28, hy - hr * 0.05, hr * 0.17);
      g.fillCircle(hx + hr * 0.28, hy - hr * 0.05, hr * 0.17);
      // Teeth
      g.fillStyle(0xffffff, 1);
      g.fillRect(hx - hr * 0.22, hy + hr * 0.28, hr * 0.13, hr * 0.16);
      g.fillRect(hx - hr * 0.04, hy + hr * 0.28, hr * 0.13, hr * 0.16);
      g.fillRect(hx + hr * 0.12, hy + hr * 0.28, hr * 0.12, hr * 0.16);
      // Cracked armor body
      g.fillStyle(darken(fill, 0.6), 1);
      drawBody(g, darken(fill, 0.7), hx, by, bw * 0.9, bh);
      // Battle damage cracks
      g.lineStyle(hr * 0.09, 0xffffff, 0.35);
      g.lineBetween(cx - r * 0.08, by + bh * 0.15, cx + r * 0.18, by + bh * 0.65);
      drawLegs(g, darken(fill, 0.65), cx, by + bh, r);
      break;
    }

    case 'three_god_destroyer': {
      // Three cute chibi faces on one wide body, each with different color eye
      const faceColors: [number, number, number] = [0xff4444, 0x4488ff, 0xffff44];
      const faceX = [cx - r * 0.42, cx, cx + r * 0.42];
      const faceHr = hr * 0.62;
      // Wide body base
      g.fillStyle(dk, 1);
      g.fillRoundedRect(cx - r * 0.78, by - bh * 0.1, r * 1.56, bh * 1.1, r * 0.14);
      // Three necks
      faceX.forEach(fx => {
        g.fillStyle(darken(fill, 0.7), 1);
        g.fillRect(fx - faceHr * 0.3, by - bh * 0.12, faceHr * 0.6, bh * 0.22);
      });
      // Three heads
      faceX.forEach((fx, i) => {
        drawHead(g, fill, fx, hy + faceHr * 0.1, faceHr);
        // Each face has different colored eyes
        g.fillStyle(faceColors[i], 1);
        g.fillCircle(fx - faceHr * 0.28, hy + faceHr * 0.15, faceHr * 0.16);
        g.fillCircle(fx + faceHr * 0.28, hy + faceHr * 0.15, faceHr * 0.16);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(fx - faceHr * 0.22, hy + faceHr * 0.09, faceHr * 0.07);
        g.fillCircle(fx + faceHr * 0.34, hy + faceHr * 0.09, faceHr * 0.07);
      });
      // Center crown
      g.fillStyle(0xffd700, 1);
      g.fillRect(cx - faceHr * 0.38, hy - faceHr * 0.82, faceHr * 0.76, faceHr * 0.16);
      g.fillTriangle(cx - faceHr * 0.28, hy - faceHr * 0.82, cx - faceHr * 0.18, hy - faceHr * 1.12, cx - faceHr * 0.06, hy - faceHr * 0.82);
      g.fillTriangle(cx - faceHr * 0.06, hy - faceHr * 0.82, cx, hy - faceHr * 1.22, cx + faceHr * 0.06, hy - faceHr * 0.82);
      g.fillTriangle(cx + faceHr * 0.06, hy - faceHr * 0.82, cx + faceHr * 0.18, hy - faceHr * 1.12, cx + faceHr * 0.28, hy - faceHr * 0.82);
      // Big arms
      g.fillStyle(darken(fill, 0.65), 1);
      g.fillRoundedRect(cx - r * 0.9, by, r * 0.22, bh * 0.8, r * 0.08);
      g.fillRoundedRect(cx + r * 0.68, by, r * 0.22, bh * 0.8, r * 0.08);
      // Stubby legs
      g.fillStyle(darken(fill, 0.58), 1);
      g.fillRoundedRect(cx - r * 0.42, by + bh, r * 0.26, r * 0.3, r * 0.08);
      g.fillRoundedRect(cx + r * 0.16, by + bh, r * 0.26, r * 0.3, r * 0.08);
      break;
    }

    // ── Chapter 6 ─────────────────────────────────────────────────────────────

    case 'mirror_knight': {
      // Shiny silver knight, big reflective shield with star
      g.fillStyle(hi, 1);
      g.fillRect(hx - hr * 1.05, hy - hr * 1.08, hr * 2.1, hr * 0.52);
      g.fillStyle(fill, 1);
      g.fillRect(hx - hr, hy - hr * 0.6, hr * 2, hr * 0.2);
      drawHead(g, fill, hx, hy, hr);
      // Silver visor
      g.fillStyle(0xddeeff, 0.5);
      g.fillRect(hx - hr * 0.55, hy - hr * 0.12, hr * 1.1, hr * 0.2);
      drawBody(g, dk, hx, by, bw, bh);
      // Big mirror shield (right)
      g.fillStyle(lighten(fill, 70), 0.95);
      g.fillRoundedRect(cx + r * 0.18, by - bh * 0.12, r * 0.42, r * 0.58, r * 0.08);
      g.fillStyle(0xffffff, 0.5);
      g.fillRect(cx + r * 0.26, by - bh * 0.05, r * 0.12, r * 0.4);
      // Star on shield
      g.fillStyle(0xffd700, 0.8);
      g.fillCircle(cx + r * 0.39, by + bh * 0.18, hr * 0.14);
      g.lineStyle(hr * 0.08, 0xffd700, 0.7);
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 4;
        g.lineBetween(cx + r * 0.39, by + bh * 0.18, cx + r * 0.39 + Math.cos(ang) * hr * 0.22, by + bh * 0.18 + Math.sin(ang) * hr * 0.22);
      }
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'swarm_larva': {
      // Cute big-eyed bug, mandibles, segmented body, 3 pairs tiny legs
      // Segmented body (3 circles)
      g.fillStyle(dk, 1);
      g.fillCircle(cx, cy + r * 0.42, r * 0.38);
      g.fillStyle(fill, 1);
      g.fillCircle(cx, cy + r * 0.1, r * 0.42);
      // Head (big!)
      drawHead(g, lighten(fill, 20), hx, hy - hr * 0.12, hr * 1.05);
      // Mandibles
      g.fillStyle(dk, 1);
      g.fillTriangle(hx - hr * 0.38, hy + hr * 0.55, hx - hr * 0.62, hy + hr * 0.88, hx - hr * 0.18, hy + hr * 0.72);
      g.fillTriangle(hx + hr * 0.38, hy + hr * 0.55, hx + hr * 0.18, hy + hr * 0.72, hx + hr * 0.62, hy + hr * 0.88);
      // Big cute eyes
      drawEyes(g, hx, hy - hr * 0.12, hr * 1.05, 0x001100);
      // Antennae
      g.lineStyle(hr * 0.14, dk, 0.9);
      g.lineBetween(hx - hr * 0.28, hy - hr * 1.0, hx - hr * 0.55, hy - hr * 1.55);
      g.lineBetween(hx + hr * 0.28, hy - hr * 1.0, hx + hr * 0.55, hy - hr * 1.55);
      g.fillStyle(lighten(fill, 40), 1);
      g.fillCircle(hx - hr * 0.55, hy - hr * 1.55, hr * 0.1);
      g.fillCircle(hx + hr * 0.55, hy - hr * 1.55, hr * 0.1);
      // Tiny legs (3 pairs)
      g.lineStyle(hr * 0.18, dk, 0.9);
      for (let i = -1; i <= 1; i++) {
        const ly = cy + r * 0.18 + i * r * 0.2;
        g.lineBetween(cx - r * 0.42, ly, cx - r * 0.72, ly - r * 0.12);
        g.lineBetween(cx + r * 0.42, ly, cx + r * 0.72, ly - r * 0.12);
      }
      break;
    }

    case 'swarm_spawn': {
      // Smaller cuter version — big eyes, round, fewer legs
      const sr = r * 0.78;
      drawHead(g, lighten(fill, 15), cx, cy - sr * 0.15, sr * 0.5);
      g.fillStyle(fill, 1);
      g.fillCircle(cx, cy + sr * 0.22, sr * 0.5);
      // Mandibles (small)
      g.fillStyle(dk, 1);
      g.fillTriangle(cx - sr * 0.28, cy + sr * 0.52, cx - sr * 0.48, cy + sr * 0.72, cx - sr * 0.12, cy + sr * 0.62);
      g.fillTriangle(cx + sr * 0.28, cy + sr * 0.52, cx + sr * 0.12, cy + sr * 0.62, cx + sr * 0.48, cy + sr * 0.72);
      drawEyes(g, cx, cy - sr * 0.15, sr * 0.5, 0x001100);
      // Two tiny legs
      g.lineStyle(sr * 0.16, dk, 0.9);
      g.lineBetween(cx - sr * 0.4, cy + sr * 0.3, cx - sr * 0.65, cy + sr * 0.55);
      g.lineBetween(cx + sr * 0.4, cy + sr * 0.3, cx + sr * 0.65, cy + sr * 0.55);
      break;
    }

    case 'shadow_wraith': {
      // Cute dark ghost: big head, glowing teal eyes, melting bottom
      g.fillStyle(fill, 0.22);
      g.fillCircle(cx, cy, r * 0.88);
      drawHead(g, fill, hx, hy - hr * 0.08, hr * 1.02);
      // Glowing teal eyes
      g.fillStyle(0x8888ff, 1);
      g.fillCircle(hx - hr * 0.3, hy - hr * 0.12, hr * 0.2);
      g.fillCircle(hx + hr * 0.3, hy - hr * 0.12, hr * 0.2);
      g.fillStyle(0xccccff, 0.8);
      g.fillCircle(hx - hr * 0.3 + hr * 0.07, hy - hr * 0.18, hr * 0.09);
      g.fillCircle(hx + hr * 0.3 + hr * 0.07, hy - hr * 0.18, hr * 0.09);
      // Melting ghost body (5 drips)
      g.fillStyle(darken(fill, 0.75), 0.85);
      const drips = [-0.42, -0.2, 0.0, 0.22, 0.42];
      drips.forEach((dx, i) => {
        const dh = r * (0.28 + (i % 2) * 0.1);
        g.fillRoundedRect(cx + dx * r - r * 0.09, by + bh * 0.12, r * 0.2, dh, r * 0.08);
      });
      // Wispy hands
      g.fillStyle(fill, 0.6);
      g.fillCircle(cx - r * 0.62, by + bh * 0.18, hr * 0.2);
      g.fillCircle(cx + r * 0.62, by + bh * 0.18, hr * 0.2);
      break;
    }

    case 'celestial_crusader': {
      // Angel warrior: big golden halo, feathered wings, radiant armor
      // Wing glow
      g.fillStyle(lighten(fill, 40), 0.15);
      g.fillEllipse(cx, cy, r * 2.2, r * 1.4);
      // Feathered wings
      g.fillStyle(lighten(fill, 30), 0.7);
      g.fillTriangle(cx - r * 0.35, by - bh * 0.08, cx - r * 0.92, by - bh * 0.55, cx - r * 0.35, by + bh * 0.35);
      g.fillTriangle(cx + r * 0.35, by - bh * 0.08, cx + r * 0.92, by - bh * 0.55, cx + r * 0.35, by + bh * 0.35);
      // Feather lines
      g.lineStyle(0.8, 0xffffff, 0.4);
      for (let i = 0; i < 3; i++) {
        const fy = by - bh * 0.08 + i * bh * 0.14;
        g.lineBetween(cx - r * 0.36, fy, cx - r * (0.78 - i * 0.12), fy - bh * 0.12);
        g.lineBetween(cx + r * 0.36, fy, cx + r * (0.78 - i * 0.12), fy - bh * 0.12);
      }
      // Halo
      g.lineStyle(hr * 0.25, 0xffee44, 0.9);
      g.strokeCircle(hx, hy - hr * 1.15, hr * 0.5);
      g.fillStyle(0xffee44, 0.2);
      g.fillCircle(hx, hy - hr * 1.15, hr * 0.5);
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy + hr * 0.05, hr, 0x664400);
      // Radiant smile
      g.lineStyle(hr * 0.13, 0x664400, 0.7);
      g.beginPath();
      g.arc(hx, hy + hr * 0.3, hr * 0.22, 0.2, Math.PI - 0.2);
      g.strokePath();
      drawBody(g, dk, hx, by, bw, bh);
      // Cross on chest
      g.fillStyle(0xffee44, 0.75);
      g.fillRect(hx - hr * 0.06, by + bh * 0.14, hr * 0.12, bh * 0.68);
      g.fillRect(hx - hr * 0.26, by + bh * 0.32, hr * 0.52, hr * 0.11);
      drawLegs(g, fill, cx, by + bh, r);
      break;
    }

    case 'void_colossus': {
      // Massive purple robot, single glowing eye, imposing
      // Aura
      g.fillStyle(fill, 0.18);
      g.fillCircle(cx, cy, r * 0.96);
      // Wide square head (oversized)
      g.fillStyle(fill, 1);
      g.fillRoundedRect(hx - hr * 1.2, hy - hr * 1.05, hr * 2.4, hr * 2.1, hr * 0.2);
      g.fillStyle(hi, 0.12);
      g.fillRect(hx - hr * 1.1, hy - hr * 0.95, hr * 2.2, hr * 0.28);
      // Single big eye (cyclopean)
      g.fillStyle(0xffffff, 0.9);
      g.fillEllipse(hx, hy - hr * 0.12, hr * 1.0, hr * 0.55);
      g.fillStyle(0x8844cc, 1);
      g.fillEllipse(hx, hy - hr * 0.12, hr * 0.7, hr * 0.38);
      g.fillStyle(0x110022, 1);
      g.fillEllipse(hx, hy - hr * 0.12, hr * 0.35, hr * 0.22);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(hx + hr * 0.16, hy - hr * 0.2, hr * 0.12);
      // Vents
      g.fillStyle(dk, 0.7);
      g.fillRect(hx - hr * 0.9, hy + hr * 0.5, hr * 0.4, hr * 0.16);
      g.fillRect(hx + hr * 0.5, hy + hr * 0.5, hr * 0.4, hr * 0.16);
      // Massive body
      g.fillStyle(darken(fill, 0.72), 1);
      g.fillRoundedRect(cx - r * 0.65, by, r * 1.3, bh, r * 0.12);
      g.fillStyle(hi, 0.1);
      g.fillRect(cx - r * 0.6, by + bh * 0.12, r * 1.2, r * 0.08);
      // Thick arms
      g.fillStyle(darken(fill, 0.62), 1);
      g.fillRoundedRect(cx - r * 0.82, by + bh * 0.08, r * 0.26, bh * 0.85, r * 0.08);
      g.fillRoundedRect(cx + r * 0.56, by + bh * 0.08, r * 0.26, bh * 0.85, r * 0.08);
      // Thick legs
      g.fillRoundedRect(cx - r * 0.42, by + bh, r * 0.3, r * 0.32, r * 0.08);
      g.fillRoundedRect(cx + r * 0.12, by + bh, r * 0.3, r * 0.32, r * 0.08);
      break;
    }

    case 'plague_herald': {
      // Hooded cute robe, big green glowing eyes, dripping poison staff
      // Hood
      g.fillStyle(dk, 1);
      g.fillCircle(hx, hy, hr * 1.1);
      g.fillStyle(fill, 1);
      g.fillCircle(hx, hy + hr * 0.05, hr);
      // Green glow eyes
      g.fillStyle(0x00ff44, 0.9);
      g.fillCircle(hx - hr * 0.28, hy, hr * 0.2);
      g.fillCircle(hx + hr * 0.28, hy, hr * 0.2);
      g.fillStyle(0x002200, 1);
      g.fillCircle(hx - hr * 0.28, hy, hr * 0.1);
      g.fillCircle(hx + hr * 0.28, hy, hr * 0.1);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(hx - hr * 0.22, hy - hr * 0.06, hr * 0.07);
      g.fillCircle(hx + hr * 0.34, hy - hr * 0.06, hr * 0.07);
      // Robe (triangle)
      g.fillStyle(dk, 1);
      g.fillTriangle(cx - r * 0.5, cy + r * 0.82, cx + r * 0.5, cy + r * 0.82, cx, by + bh * 0.1);
      g.fillStyle(fill, 0.35);
      g.fillTriangle(cx - r * 0.48, cy + r * 0.8, cx + r * 0.48, cy + r * 0.8, cx, by + bh * 0.15);
      // Bubbling poison staff
      g.lineStyle(hr * 0.2, darken(fill, 0.6), 1);
      g.lineBetween(cx + r * 0.42, hy - hr * 0.6, cx + r * 0.42, cy + r * 0.65);
      // Poison orb
      g.fillStyle(0x40ff80, 0.82);
      g.fillCircle(cx + r * 0.42, hy - hr * 0.72, hr * 0.28);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(cx + r * 0.38, hy - hr * 0.8, hr * 0.12);
      // Drip
      g.fillStyle(0x40ff80, 0.5);
      g.fillTriangle(cx + r * 0.38, cy + r * 0.62, cx + r * 0.46, cy + r * 0.62, cx + r * 0.42, cy + r * 0.8);
      break;
    }

    case 'titan_sentinel': {
      // Tiny head barely visible above HUGE tower shield
      // Tower shield (dominant)
      g.fillStyle(lighten(fill, 22), 1);
      g.fillRoundedRect(cx - r * 0.6, cy - r * 0.68, r * 0.55, r * 1.4, r * 0.1);
      g.lineStyle(2, hi, 0.7);
      g.strokeRoundedRect(cx - r * 0.6, cy - r * 0.68, r * 0.55, r * 1.4, r * 0.1);
      // Shield emblem (circle)
      g.fillStyle(fill, 0.6);
      g.fillCircle(cx - r * 0.325, cy + r * 0.12, r * 0.18);
      g.lineStyle(1.2, hi, 0.5);
      g.strokeCircle(cx - r * 0.325, cy + r * 0.12, r * 0.18);
      // Shield shine
      g.fillStyle(0xffffff, 0.22);
      g.fillRect(cx - r * 0.55, cy - r * 0.62, r * 0.12, r * 1.2);
      // Body (behind shield)
      g.fillStyle(darken(fill, 0.65), 1);
      g.fillRoundedRect(cx - r * 0.08, cy - r * 0.38, r * 0.72, r * 1.08, r * 0.12);
      // Tiny head peeking above
      drawHead(g, fill, cx + r * 0.35, cy - r * 0.52, hr * 0.72);
      g.fillStyle(0x223344, 0.5);
      g.fillRect(cx + r * 0.12, cy - r * 0.58, r * 0.46, hr * 0.22);
      // Legs
      g.fillStyle(darken(fill, 0.58), 1);
      g.fillRoundedRect(cx + r * 0.05, cy + r * 0.7, r * 0.22, r * 0.28, r * 0.07);
      g.fillRoundedRect(cx + r * 0.38, cy + r * 0.7, r * 0.22, r * 0.28, r * 0.07);
      break;
    }

    case 'eternal_emperor': {
      // Grand 3-spire crown, ornate armor, scepter, flowing cape
      // Cape (behind everything)
      g.fillStyle(0x880000, 0.75);
      g.fillTriangle(cx - r * 0.42, by - bh * 0.1, cx - r * 0.72, cy + r * 0.82, cx + r * 0.72, cy + r * 0.82);
      g.fillStyle(0xffd700, 0.22);
      g.fillRect(cx - r * 0.4, by + bh * 0.1, r * 0.06, bh * 0.6);
      g.fillRect(cx + r * 0.34, by + bh * 0.1, r * 0.06, bh * 0.6);
      // Crown base + 3 spires
      g.fillStyle(0xffd700, 1);
      g.fillRect(hx - hr * 0.72, hy - hr * 0.9, hr * 1.44, hr * 0.22);
      g.fillTriangle(hx - hr * 0.6, hy - hr * 0.9, hx - hr * 0.48, hy - hr * 1.42, hx - hr * 0.32, hy - hr * 0.9);
      g.fillTriangle(hx - hr * 0.1, hy - hr * 0.9, hx, hy - hr * 1.65, hx + hr * 0.1, hy - hr * 0.9);
      g.fillTriangle(hx + hr * 0.32, hy - hr * 0.9, hx + hr * 0.48, hy - hr * 1.42, hx + hr * 0.6, hy - hr * 0.9);
      // Crown jewels
      g.fillStyle(0xff2200, 1);
      g.fillCircle(hx - hr * 0.46, hy - hr * 1.15, hr * 0.1);
      g.fillStyle(0x4488ff, 1);
      g.fillCircle(hx, hy - hr * 1.38, hr * 0.12);
      g.fillStyle(0x44ff88, 1);
      g.fillCircle(hx + hr * 0.46, hy - hr * 1.15, hr * 0.1);
      drawHead(g, fill, hx, hy, hr);
      // Stern eyes + thin mustache
      drawEyes(g, hx, hy + hr * 0.02, hr, 0x440000);
      g.lineStyle(hr * 0.12, 0x440000, 0.8);
      g.lineBetween(hx - hr * 0.42, hy + hr * 0.38, hx - hr * 0.05, hy + hr * 0.32);
      g.lineBetween(hx + hr * 0.05, hy + hr * 0.32, hx + hr * 0.42, hy + hr * 0.38);
      // Ornate armor body
      g.fillStyle(darken(fill, 0.65), 1);
      drawBody(g, darken(fill, 0.72), hx, by, bw * 1.08, bh);
      // Gold shoulder pads
      g.fillStyle(0xffd700, 1);
      g.fillCircle(cx - r * 0.42, by + bh * 0.12, hr * 0.24);
      g.fillCircle(cx + r * 0.42, by + bh * 0.12, hr * 0.24);
      // Chest gem
      g.fillStyle(0xff2200, 0.85);
      g.fillCircle(hx, by + bh * 0.38, hr * 0.16);
      // Scepter (right)
      g.lineStyle(hr * 0.2, 0xffd700, 1);
      g.lineBetween(cx + r * 0.52, hy - hr * 0.4, cx + r * 0.52, cy + r * 0.62);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(cx + r * 0.52, hy - hr * 0.48, hr * 0.22);
      g.fillStyle(0xff2200, 0.9);
      g.fillCircle(cx + r * 0.52, hy - hr * 0.48, hr * 0.13);
      drawLegs(g, darken(fill, 0.62), cx, by + bh, r);
      break;
    }

    default: {
      // Fallback: generic cute circle with eyes
      g.fillStyle(fill, 0.88);
      g.fillCircle(cx, cy, r * 0.78);
      drawEyes(g, cx, cy - r * 0.08, r * 0.78);
      g.lineStyle(1.5, darken(fill, 0.5), 0.6);
      g.strokeCircle(cx, cy, r * 0.78);
      break;
    }
  }
}
