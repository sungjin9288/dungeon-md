/**
 * Invader shapes for Chapters 4-6.
 *
 * Ch4: trap_breaker, plague_herald, siege_soldier, death_emissary, void_assassin
 * Ch5: void, void_invader, void_colossus, undying, undying_warrior, undying_knight
 * Ch6: swarm_larva, swarm_spawn, venom_dancer, shadow_wraith, titan_sentinel,
 *      celestial_crusader, three_god_destroyer, eternal_emperor
 */

import type { ChibiLayout } from './invaderShapeHelpers';
import { darken, lighten, drawHead, drawEyes, drawBody, drawLegs } from './invaderShapeHelpers';

export function drawCh4_6(g: Phaser.GameObjects.Graphics, type: string, L: ChibiLayout): boolean {
  const { r, cx, cy, fill, hi, dk, hr, hx, hy, bw, bh, by } = L;

  switch (type) {

    // ── Chapter 4 ─────────────────────────────────────────────────────────────

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
      return true;
    }

    case 'plague_herald': {
      // Hooded cute robe, big green glowing eyes, dripping poison staff
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
      return true;
    }

    case 'siege_soldier': {
      // Very wide chubby armored body, small head, big shield front
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
      return true;
    }

    case 'death_emissary': {
      // Big dark hood, floating scythe, skull peeking
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
      return true;
    }

    case 'void_assassin':
    case 'void_assassin_elite': {
      // Diamond body shape, glowing single eye, portal ring
      const iselite = type === 'void_assassin_elite';
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
        g.fillStyle(0xcc88ff, 0.6);
        g.fillCircle(cx - r * 0.45, cy + r * 0.38, hr * 0.12);
        g.fillCircle(cx + r * 0.5, cy - r * 0.38, hr * 0.1);
      }
      return true;
    }

    // ── Chapter 5 ─────────────────────────────────────────────────────────────

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
      return true;
    }

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
      // More tentacles
      g.fillStyle(fill, 0.88);
      const tentX = [cx - r * 0.55, cx - r * 0.25, cx + r * 0.0, cx + r * 0.28, cx + r * 0.55];
      tentX.forEach((tx, i) => {
        const th = r * (0.25 + (i % 2) * 0.06);
        g.fillRoundedRect(tx - r * 0.08, cy + r * 0.48, r * 0.16, th, r * 0.06);
      });
      return true;
    }

    case 'void_colossus': {
      // Massive purple robot, single glowing eye, imposing
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
      return true;
    }

    case 'undying': {
      // Cute skeleton with red glowing eyes, tiny raised fist
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
      return true;
    }

    case 'undying_warrior': {
      // Skeleton warrior with big sword, fierce expression
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
      return true;
    }

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
      return true;
    }

    // ── Chapter 6 ─────────────────────────────────────────────────────────────

    case 'swarm_larva': {
      // Cute big-eyed bug, mandibles, segmented body, 3 pairs tiny legs
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
      return true;
    }

    case 'swarm_spawn': {
      // Smaller cuter version
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
      return true;
    }

    case 'venom_dancer': {
      // Green dancer, swirling tail, sparkle effects
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
      return true;
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
      return true;
    }

    case 'titan_sentinel': {
      // Tiny head barely visible above HUGE tower shield
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
      return true;
    }

    case 'celestial_crusader': {
      // Angel warrior: big golden halo, feathered wings, radiant armor
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
      return true;
    }

    case 'three_god_destroyer': {
      // Three cute chibi faces on one wide body
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
      return true;
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
      return true;
    }

    // ghost_add (spawned by death_emissary, belongs to Ch4 context)
    case 'ghost_add': {
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
      return true;
    }

    default:
      return false;
  }
}
