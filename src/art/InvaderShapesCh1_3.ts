/**
 * Invader shapes for Chapters 1-3.
 *
 * Ch1: peasant, soldier, berserker, knight
 * Ch2: shaman, scarecrow_mage, shadow_ninja, mercenary_captain, fox_queen
 * Ch3: iron_golem, high_priest, holy_paladin, mirror_knight, dragon_king
 */

import type { ChibiLayout } from './invaderShapeHelpers';
import { darken, lighten, drawHead, drawEyes, drawBody, drawLegs } from './invaderShapeHelpers';

export function drawCh1_3(g: Phaser.GameObjects.Graphics, type: string, L: ChibiLayout): boolean {
  const { r, cx, cy, fill, hi, dk, hr, hx, hy, bw, bh, by } = L;

  switch (type) {

    // ── Chapter 1 ─────────────────────────────────────────────────────────────

    case 'peasant': {
      // Straw-hat farmer with tiny pitchfork
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
      return true;
    }

    case 'soldier': {
      // Cute pointy blue helmet, tiny shield
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
      return true;
    }

    case 'berserker': {
      // Spiky red hair, angry eyebrows, chubby rage body
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
      return true;
    }

    case 'knight': {
      // Heavy flat-top helmet, big shield, proud stance
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
      return true;
    }

    // ── Chapter 2 ─────────────────────────────────────────────────────────────

    case 'shaman': {
      // Two cute horns, wide-sleeve robe
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
      return true;
    }

    case 'scarecrow_mage': {
      // Wide-brim hat, stitched smile, stick-cross body
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
      // Stick-cross body
      g.fillStyle(0xb08040, 1);
      g.fillRect(cx - r * 0.1, by, r * 0.2, bh * 0.8);
      g.fillRect(cx - r * 0.72, by + bh * 0.18, r * 1.44, r * 0.18);
      // Hay at arm ends
      g.fillStyle(0xd4a030, 0.7);
      g.fillCircle(cx - r * 0.7, by + bh * 0.27, hr * 0.22);
      g.fillCircle(cx + r * 0.7, by + bh * 0.27, hr * 0.22);
      return true;
    }

    case 'shadow_ninja': {
      // Head wrap, tiny body, visible gleaming blade
      g.fillStyle(dk, 1);
      g.fillCircle(hx, hy, hr * 1.08);
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
      return true;
    }

    case 'mercenary_captain': {
      // Feathered hat, cape flowing right
      g.fillStyle(dk, 1);
      g.fillEllipse(hx, hy - hr * 0.88, hr * 2.0, hr * 0.48);
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(hx + hr * 0.5, hy - hr * 1.7, hx + hr * 0.2, hy - hr * 0.7, hx + hr * 0.85, hy - hr * 0.7);
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
      return true;
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
      return true;
    }

    // ── Chapter 3 ─────────────────────────────────────────────────────────────

    case 'iron_golem': {
      // Square block head, massive rectangular body, red eyes
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
      return true;
    }

    case 'high_priest': {
      // Tall 3-point crown, long purple robe, glowing staff
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
      return true;
    }

    case 'holy_paladin': {
      // Golden halo floating above, cross emblem on body
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
      return true;
    }

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
      return true;
    }

    case 'dragon_king': {
      // Cute dragon: big horned head, little wings, toothy grin
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
      return true;
    }

    default:
      return false;
  }
}
