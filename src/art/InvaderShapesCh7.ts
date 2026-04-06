/**
 * Invader shapes for Chapter 7: 신계 침공 (Celestial Invasion).
 *
 * celestial_knight, divine_archer, heaven_general,
 * sky_titan, radiant_seraph, celestial_dragon, god_emperor
 *
 * Palette: gold (0xffd700), ivory (0xffeebb), celestial blue (0xaaddff),
 *          warm white (0xffffff), deep gold (0xcc8800)
 */

import type { ChibiLayout } from './invaderShapeHelpers';
import { darken, drawHead, drawEyes, drawBody, drawLegs } from './invaderShapeHelpers';

export function drawCh7(g: Phaser.GameObjects.Graphics, type: string, L: ChibiLayout): boolean {
  const { r, cx, cy, fill, hi, dk, hr, hx, hy, bw, bh, by } = L;

  switch (type) {

    // ── celestial_knight: 천상 기사 ────────────────────────────────────────────
    case 'celestial_knight': {
      // Golden helmet with small wings
      drawHead(g, fill, hx, hy, hr);
      // Helmet (gold arc on top)
      g.fillStyle(0xffd700, 0.95);
      g.fillCircle(hx, hy - hr * 0.1, hr * 0.85);
      g.fillStyle(fill, 1);
      g.fillCircle(hx, hy + hr * 0.05, hr * 0.7);
      drawEyes(g, hx, hy, hr, 0x2244aa);
      // Wing fins on helmet
      g.fillStyle(0xffeebb, 0.85);
      g.fillTriangle(hx - hr * 0.9, hy - hr * 0.3, hx - hr * 0.5, hy - hr * 0.1, hx - hr * 0.7, hy - hr * 0.8);
      g.fillTriangle(hx + hr * 0.9, hy - hr * 0.3, hx + hr * 0.5, hy - hr * 0.1, hx + hr * 0.7, hy - hr * 0.8);
      // Gold plate armor body
      drawBody(g, 0xffd700, hx, by, bw, bh);
      g.lineStyle(1.2, 0xcc8800, 0.8);
      g.strokeRoundedRect(hx - bw / 2, by, bw, bh, bw * 0.35);
      // Small shield
      g.fillStyle(0xffd700, 0.9);
      g.fillCircle(cx - r * 0.35, by + bh * 0.3, r * 0.18);
      g.lineStyle(1, 0xcc8800, 1);
      g.strokeCircle(cx - r * 0.35, by + bh * 0.3, r * 0.18);
      drawLegs(g, 0xffd700, cx, by + bh, r);
      // Halo
      g.lineStyle(1.5, 0xffeebb, 0.6);
      g.strokeEllipse(hx, hy - hr * 1.2, hr * 0.9, hr * 0.3);
      return true;
    }

    // ── divine_archer: 신성 궁수 ──────────────────────────────────────────────
    case 'divine_archer': {
      // Ethereal archer with light bow and translucent wings
      drawHead(g, fill, hx, hy, hr);
      drawEyes(g, hx, hy, hr, 0x886600);
      // Translucent wings (behind)
      g.fillStyle(0xffeebb, 0.25);
      g.fillTriangle(cx - r * 0.7, by, cx - r * 0.2, by - bh * 0.3, cx - r * 0.8, by + bh * 0.6);
      g.fillTriangle(cx + r * 0.7, by, cx + r * 0.2, by - bh * 0.3, cx + r * 0.8, by + bh * 0.6);
      // Body (light gold robe)
      drawBody(g, fill, hx, by, bw, bh);
      // Light bow (right side)
      g.lineStyle(2, 0xffd700, 0.9);
      g.beginPath();
      g.arc(cx + r * 0.45, by + bh * 0.3, r * 0.35, -Math.PI * 0.6, Math.PI * 0.6);
      g.strokePath();
      // Arrow
      g.lineStyle(1.2, 0xffeebb, 1);
      g.lineBetween(cx + r * 0.1, by + bh * 0.3, cx + r * 0.8, by + bh * 0.3);
      // Arrowhead
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(cx + r * 0.8, by + bh * 0.2, cx + r * 0.95, by + bh * 0.3, cx + r * 0.8, by + bh * 0.4);
      drawLegs(g, fill, cx, by + bh, r);
      // Halo
      g.lineStyle(1, 0xffd700, 0.45);
      g.strokeEllipse(hx, hy - hr * 1.15, hr * 0.7, hr * 0.22);
      return true;
    }

    // ── heaven_general: 천계 장군 ──────────────────────────────────────────────
    case 'heaven_general': {
      // Commanding figure with banner flag, heavy golden armor
      drawHead(g, fill, hx, hy, hr);
      // Stern eyes
      g.fillStyle(0x442200, 1);
      g.fillRoundedRect(hx - hr * 0.42, hy - hr * 0.08, hr * 0.3, hr * 0.14, 2);
      g.fillRoundedRect(hx + hr * 0.12, hy - hr * 0.08, hr * 0.3, hr * 0.14, 2);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(hx - hr * 0.3, hy - hr * 0.04, hr * 0.06);
      g.fillCircle(hx + hr * 0.24, hy - hr * 0.04, hr * 0.06);
      // Crown
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(hx - hr * 0.4, hy - hr * 0.6, hx - hr * 0.2, hy - hr * 1.0, hx, hy - hr * 0.6);
      g.fillTriangle(hx, hy - hr * 0.6, hx + hr * 0.2, hy - hr * 1.0, hx + hr * 0.4, hy - hr * 0.6);
      // Heavy armor body
      drawBody(g, 0xcc8800, hx, by, bw * 1.15, bh);
      g.lineStyle(1.5, 0xffd700, 0.9);
      g.strokeRoundedRect(hx - bw * 0.575, by, bw * 1.15, bh, bw * 0.35);
      // Banner (left side)
      g.lineStyle(2, 0x886630, 1);
      g.lineBetween(cx - r * 0.45, by - bh * 0.2, cx - r * 0.45, by - bh * 1.4);
      g.fillStyle(0xff3333, 0.9);
      g.fillRect(cx - r * 0.45, by - bh * 1.4, r * 0.32, r * 0.22);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(cx - r * 0.29, by - bh * 1.28, r * 0.06);
      drawLegs(g, 0xcc8800, cx, by + bh, r);
      return true;
    }

    // ── sky_titan: 창공 거인 ──────────────────────────────────────────────────
    case 'sky_titan': {
      // Massive figure with cloud motifs, earth-shaking stance
      const bigR = r * 1.1;
      const bigHr = bigR * 0.45;
      drawHead(g, fill, hx, hy - r * 0.05, bigHr);
      // Angry brow
      g.lineStyle(2, dk, 0.9);
      g.lineBetween(hx - bigHr * 0.5, hy - bigHr * 0.35, hx - bigHr * 0.15, hy - bigHr * 0.2);
      g.lineBetween(hx + bigHr * 0.5, hy - bigHr * 0.35, hx + bigHr * 0.15, hy - bigHr * 0.2);
      drawEyes(g, hx, hy - r * 0.05, bigHr, 0x001155);
      // Cloud wisps around shoulders
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(cx - r * 0.5, by + bh * 0.1, r * 0.2);
      g.fillCircle(cx - r * 0.35, by - bh * 0.05, r * 0.15);
      g.fillCircle(cx + r * 0.5, by + bh * 0.1, r * 0.2);
      g.fillCircle(cx + r * 0.35, by - bh * 0.05, r * 0.15);
      // Wide body
      drawBody(g, dk, hx, by + r * 0.04, bw * 1.3, bh * 1.1);
      g.fillStyle(fill, 0.5);
      g.fillRoundedRect(hx - bw * 0.35, by + r * 0.1, bw * 0.7, bh * 0.4, 4);
      // Thick legs
      g.fillStyle(darken(fill, 0.6), 1);
      g.fillRoundedRect(cx - r * 0.35, by + bh * 1.15, r * 0.28, r * 0.35, r * 0.08);
      g.fillRoundedRect(cx + r * 0.07, by + bh * 1.15, r * 0.28, r * 0.35, r * 0.08);
      return true;
    }

    // ── radiant_seraph: 광휘 세라프 ────────────────────────────────────────────
    case 'radiant_seraph': {
      // Six-winged seraph with radiant glow and multiple halos
      // Glow background
      g.fillStyle(0xffeebb, 0.12);
      g.fillCircle(cx, cy, r * 0.95);
      // 6 wings (3 pairs)
      const wingColor = 0xffeebb;
      // Top pair (covers face)
      g.fillStyle(wingColor, 0.35);
      g.fillTriangle(cx - r * 0.6, hy - hr * 0.5, cx - r * 0.15, hy - hr * 0.3, cx - r * 0.5, hy - hr * 1.2);
      g.fillTriangle(cx + r * 0.6, hy - hr * 0.5, cx + r * 0.15, hy - hr * 0.3, cx + r * 0.5, hy - hr * 1.2);
      // Middle pair (spread)
      g.fillStyle(wingColor, 0.45);
      g.fillTriangle(cx - r * 0.2, by, cx - r * 0.85, by - bh * 0.2, cx - r * 0.7, by + bh * 0.8);
      g.fillTriangle(cx + r * 0.2, by, cx + r * 0.85, by - bh * 0.2, cx + r * 0.7, by + bh * 0.8);
      // Bottom pair
      g.fillStyle(wingColor, 0.3);
      g.fillTriangle(cx - r * 0.15, by + bh * 0.5, cx - r * 0.6, by + bh * 1.2, cx - r * 0.3, by + bh * 0.9);
      g.fillTriangle(cx + r * 0.15, by + bh * 0.5, cx + r * 0.6, by + bh * 1.2, cx + r * 0.3, by + bh * 0.9);
      // Head & body (over wings)
      drawHead(g, fill, hx, hy, hr * 0.9);
      drawEyes(g, hx, hy, hr * 0.9, 0xffd700);
      drawBody(g, hi, hx, by, bw * 0.85, bh * 0.85);
      drawLegs(g, fill, cx, by + bh * 0.85, r);
      // Double halo
      g.lineStyle(1.5, 0xffd700, 0.7);
      g.strokeEllipse(hx, hy - hr * 1.2, hr * 0.8, hr * 0.25);
      g.lineStyle(1, 0xffeebb, 0.4);
      g.strokeEllipse(hx, hy - hr * 1.45, hr * 0.6, hr * 0.18);
      return true;
    }

    // ── celestial_dragon: 천룡 (미니보스) ──────────────────────────────────────
    case 'celestial_dragon': {
      // Eastern dragon with celestial markings
      // Serpentine body curve
      g.fillStyle(fill, 0.9);
      g.fillCircle(cx, cy - r * 0.1, r * 0.65); // main body orb
      g.fillStyle(hi, 0.6);
      g.fillCircle(cx, cy - r * 0.1, r * 0.45); // belly highlight
      // Dragon head (elongated)
      g.fillStyle(fill, 1);
      g.fillEllipse(hx, hy - hr * 0.2, hr * 1.3, hr * 1.0);
      // Horns
      g.fillStyle(0xffd700, 1);
      g.fillTriangle(hx - hr * 0.5, hy - hr * 0.6, hx - hr * 0.2, hy - hr * 0.2, hx - hr * 0.7, hy - hr * 1.1);
      g.fillTriangle(hx + hr * 0.5, hy - hr * 0.6, hx + hr * 0.2, hy - hr * 0.2, hx + hr * 0.7, hy - hr * 1.1);
      // Dragon eyes (fierce but chibi)
      g.fillStyle(0xff4400, 0.9);
      g.fillCircle(hx - hr * 0.35, hy - hr * 0.15, hr * 0.18);
      g.fillCircle(hx + hr * 0.35, hy - hr * 0.15, hr * 0.18);
      g.fillStyle(0x220000, 1);
      g.fillCircle(hx - hr * 0.35, hy - hr * 0.15, hr * 0.08);
      g.fillCircle(hx + hr * 0.35, hy - hr * 0.15, hr * 0.08);
      // Whiskers
      g.lineStyle(1.2, 0xffd700, 0.7);
      g.lineBetween(hx - hr * 0.6, hy + hr * 0.1, hx - hr * 1.1, hy - hr * 0.2);
      g.lineBetween(hx + hr * 0.6, hy + hr * 0.1, hx + hr * 1.1, hy - hr * 0.2);
      // Celestial markings (swirl on body)
      g.lineStyle(1, 0xffd700, 0.4);
      g.beginPath();
      g.arc(cx, cy + r * 0.05, r * 0.25, 0, Math.PI * 1.4);
      g.strokePath();
      // Tail (wavy line)
      g.lineStyle(3, fill, 0.8);
      g.beginPath();
      g.moveTo(cx + r * 0.4, cy + r * 0.3);
      g.lineTo(cx + r * 0.6, cy + r * 0.15);
      g.lineTo(cx + r * 0.8, cy + r * 0.35);
      g.lineTo(cx + r * 0.95, cy + r * 0.2);
      g.strokePath();
      // Halo ring
      g.lineStyle(2, 0xffd700, 0.5);
      g.strokeEllipse(hx, hy - hr * 1.3, hr * 1.0, hr * 0.3);
      return true;
    }

    // ── god_emperor: 신황제 (최종 보스) ────────────────────────────────────────
    case 'god_emperor': {
      // Crowned divine figure, largest sprite, multi-layered armor, divine scepter
      const bigR = r * 1.15;
      const ghr = bigR * 0.42;
      // Divine radiance background
      g.fillStyle(0xffd700, 0.08);
      g.fillCircle(cx, cy, bigR);
      g.lineStyle(1.5, 0xffd700, 0.15);
      // Ray lines
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        g.lineBetween(
          cx + Math.cos(a) * bigR * 0.5, cy + Math.sin(a) * bigR * 0.5,
          cx + Math.cos(a) * bigR * 0.95, cy + Math.sin(a) * bigR * 0.95,
        );
      }
      // Head
      drawHead(g, fill, hx, hy, ghr);
      // Imperial crown (elaborate)
      g.fillStyle(0xffd700, 1);
      g.fillRect(hx - ghr * 0.55, hy - ghr * 0.75, ghr * 1.1, ghr * 0.25);
      g.fillTriangle(hx - ghr * 0.5, hy - ghr * 0.75, hx - ghr * 0.3, hy - ghr * 1.3, hx - ghr * 0.1, hy - ghr * 0.75);
      g.fillTriangle(hx - ghr * 0.1, hy - ghr * 0.75, hx + ghr * 0.1, hy - ghr * 1.15, hx + ghr * 0.3, hy - ghr * 0.75);
      g.fillTriangle(hx + ghr * 0.1, hy - ghr * 0.75, hx + ghr * 0.3, hy - ghr * 1.3, hx + ghr * 0.5, hy - ghr * 0.75);
      // Crown jewels
      g.fillStyle(0xff0000, 0.9);
      g.fillCircle(hx - ghr * 0.3, hy - ghr * 1.1, ghr * 0.08);
      g.fillStyle(0x4488ff, 0.9);
      g.fillCircle(hx + ghr * 0.1, hy - ghr * 0.95, ghr * 0.08);
      g.fillStyle(0xff0000, 0.9);
      g.fillCircle(hx + ghr * 0.3, hy - ghr * 1.1, ghr * 0.08);
      // Imperial eyes (golden glow)
      g.fillStyle(0xffd700, 1);
      g.fillCircle(hx - ghr * 0.28, hy, ghr * 0.18);
      g.fillCircle(hx + ghr * 0.28, hy, ghr * 0.18);
      g.fillStyle(0x442200, 1);
      g.fillCircle(hx - ghr * 0.28, hy, ghr * 0.09);
      g.fillCircle(hx + ghr * 0.28, hy, ghr * 0.09);
      // Multi-layer armor body
      g.fillStyle(0xcc8800, 1);
      g.fillRoundedRect(hx - bw * 0.65, by, bw * 1.3, bh * 1.1, bw * 0.3);
      g.fillStyle(0xffd700, 0.7);
      g.fillRoundedRect(hx - bw * 0.45, by + bh * 0.1, bw * 0.9, bh * 0.6, bw * 0.2);
      // Center crest
      g.fillStyle(0xff4444, 0.8);
      g.fillCircle(hx, by + bh * 0.35, r * 0.08);
      // Divine scepter (right side)
      g.lineStyle(2.5, 0xffd700, 1);
      g.lineBetween(cx + r * 0.4, by - bh * 0.1, cx + r * 0.4, by + bh * 1.3);
      // Scepter orb
      g.fillStyle(0xaaddff, 0.9);
      g.fillCircle(cx + r * 0.4, by - bh * 0.25, r * 0.1);
      g.lineStyle(1, 0xffd700, 0.8);
      g.strokeCircle(cx + r * 0.4, by - bh * 0.25, r * 0.1);
      // Legs
      g.fillStyle(darken(0xcc8800, 0.7), 1);
      g.fillRoundedRect(cx - r * 0.3, by + bh * 1.1, r * 0.24, r * 0.3, r * 0.08);
      g.fillRoundedRect(cx + r * 0.06, by + bh * 1.1, r * 0.24, r * 0.3, r * 0.08);
      // Triple halo
      g.lineStyle(2, 0xffd700, 0.6);
      g.strokeEllipse(hx, hy - ghr * 1.55, ghr * 1.0, ghr * 0.3);
      g.lineStyle(1.5, 0xffeebb, 0.4);
      g.strokeEllipse(hx, hy - ghr * 1.8, ghr * 0.8, ghr * 0.22);
      g.lineStyle(1, 0xaaddff, 0.3);
      g.strokeEllipse(hx, hy - ghr * 2.0, ghr * 0.6, ghr * 0.16);
      return true;
    }

    default:
      return false;
  }
}
