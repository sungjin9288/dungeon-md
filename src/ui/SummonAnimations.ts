import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { loadGameState } from '../data/wisdom';
import { generatePortrait } from '../art/PortraitGenerator';
import {
  RARITY_COLORS, RARITY_CSS, RARITY_STARS, RARITY_KO,
} from '../data/summonPools';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummonResult {
  monsterId:  MonsterId;
  rarity:     string;
  rarityIdx:  number;
  isNew:      boolean;
  scComp:     number;
  ceilingHit: boolean;
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const CX       = CANVAS_WIDTH / 2;
const PORTAL_CY = 130;
const SUMMON_TRIBE_LABELS: Record<string, string> = {
  dokkaebi: '도깨비',
  gumiho: '구미호',
  dragon: '용족',
  underworld: '저승',
  sansin: '산신',
  sea: '해신',
  mask: '탈족',
  moonlight: '달빛',
  celestial: '천상',
};
const SUMMON_ELEMENT_LABELS: Record<string, string> = {
  fire: '화염',
  frost: '서리',
  lightning: '번개',
  dark: '암흑',
  holy: '신성',
};

function wait(scene: Phaser.Scene, ms: number, cb: () => void): void {
  scene.time.delayedCall(ms, cb);
}

function getDexNo(monsterId: MonsterId): string {
  const index = Object.keys(MONSTER_DEFS).indexOf(monsterId);
  return String(Math.max(0, index) + 1).padStart(3, '0');
}

function getMonsterTagLine(def: (typeof MONSTER_DEFS)[MonsterId]): string {
  const tribe = def.tribe ? SUMMON_TRIBE_LABELS[def.tribe] ?? def.tribe : '던전';
  const element = def.element ? SUMMON_ELEMENT_LABELS[def.element] ?? def.element : '중립';
  return `${tribe} · ${element}`;
}

function drawFoilLines(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha: number,
): void {
  const lineCount = Math.max(3, Math.ceil(w / 28));
  for (let i = -1; i < lineCount; i++) {
    const sx = x + 14 + i * 34;
    g.lineStyle(1, color, alpha);
    g.lineBetween(sx, y + h - 14, sx + 68, y + 12);
  }
}

function drawStatusPill(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  label: string,
  color: number,
  textColor: string,
): void {
  const g = scene.add.graphics();
  g.fillStyle(0x07020c, 0.94);
  g.fillRoundedRect(x, y, w, 18, 7);
  g.fillStyle(color, 0.18);
  g.fillRoundedRect(x + 4, y + 4, w - 8, 4, 3);
  g.lineStyle(1, color, 0.66);
  g.strokeRoundedRect(x, y, w, 18, 7);
  c.add(g);
  c.add(scene.add.text(x + w / 2, y + 9, label, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: textColor,
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(99));
}

// ─── Single pull animation ──────────────────────────────────────────────────

export function playSinglePullAnimation(
  scene: Phaser.Scene,
  result: SummonResult,
  onComplete: () => void,
): void {
  const def    = MONSTER_DEFS[result.monsterId]!;
  const rColor = RARITY_COLORS[result.rarityIdx];
  const rCss   = RARITY_CSS[result.rarityIdx];
  const ov     = scene.add.container(0, 0).setDepth(100);

  scene.input.enabled = false;
  let canSkip = false;
  wait(scene, 1500, () => { canSkip = true; });

  // Tap to skip after 1.5s
  const skipZone = scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0).setInteractive().setDepth(200);
  skipZone.on('pointerdown', () => {
    if (!canSkip) return;
    skipZone.destroy();
    ov.destroy();
    scene.input.enabled = true;
    onComplete();
  });

  // ── Phase 1: Charging (0-0.8s) ──
  const darkOverlay = scene.add.graphics().setDepth(90);
  darkOverlay.fillStyle(0x000000, 0);
  darkOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scene.tweens.add({ targets: darkOverlay, alpha: 0, duration: 100 });

  // Accelerate portal via alpha-pulsing rune rings
  const chargeG = scene.add.graphics().setDepth(92);
  ov.add(chargeG);
  let chargeT = 0;
  const chargeTimer = scene.time.addEvent({
    delay: 33, repeat: -1,
    callback: () => {
      chargeT += 0.05;
      chargeG.clear();
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + chargeT * 3;
        const rx = CX + Math.cos(angle) * (50 + chargeT * 4);
        const ry = PORTAL_CY + Math.sin(angle) * (18 + chargeT * 1.5);
        chargeG.fillStyle(rColor, Math.min(0.9, 0.2 + chargeT * 0.15));
        chargeG.fillCircle(rx, ry, 5 + chargeT);
      }
      // Screen darkening
      darkOverlay.clear();
      darkOverlay.fillStyle(0x000000, Math.min(0.8, chargeT * 0.12));
      darkOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    },
  });

  // ── Phase 2: Portal opens (0.8-1.8s) ──
  wait(scene,800, () => {
    chargeTimer.destroy();
    chargeG.clear();

    // Flash
    const flash = scene.add.graphics().setDepth(95);
    flash.fillStyle(rColor, 1);
    flash.fillCircle(CX, PORTAL_CY, 10);
    ov.add(flash);
    scene.tweens.add({ targets: flash, scaleX: 25, scaleY: 25, alpha: 0, duration: 400, ease: 'Power2.easeOut',
      onComplete: () => flash.destroy() });

    // Screen wash
    const wash = scene.add.graphics().setDepth(93);
    wash.fillStyle(rColor, 0.5);
    wash.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    scene.tweens.add({ targets: wash, alpha: 0, duration: 500, onComplete: () => wash.destroy() });

    // Legendary: screen shake
    if (result.rarityIdx === 4) {
      scene.cameras.main.shake(400, 0.012);
    }

    // ── Phase 3: Result reveal (1.8s) ──
    wait(scene, 1000, () => {
      darkOverlay.clear();
      darkOverlay.fillStyle(0x000000, 0.88);
      darkOverlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Card panel
      const panW = 268, panH = 336;
      const panX = (CANVAS_WIDTH - panW) / 2;
      const panY = (CANVAS_HEIGHT - panH) / 2 - 30;
      const panG = scene.add.graphics().setDepth(96);
      panG.fillStyle(0x040208, 0.48);
      panG.fillRoundedRect(panX + 4, panY + 6, panW, panH, 14);
      panG.fillStyle(0x100022, 1);
      panG.fillRoundedRect(panX, panY, panW, panH, 14);
      panG.fillStyle(rColor, 0.12);
      panG.fillRoundedRect(panX + 13, panY + 38, panW - 26, 126, 12);
      panG.fillStyle(0x05020b, 0.74);
      panG.fillRoundedRect(panX + 20, panY + 170, panW - 40, 88, 12);
      drawFoilLines(panG, panX + 13, panY + 38, panW - 26, 126, rColor, result.rarityIdx >= 2 ? 0.17 : 0.08);
      panG.lineStyle(2, rColor, 0.9);
      panG.strokeRoundedRect(panX, panY, panW, panH, 14);
      panG.lineStyle(1, 0xffffff, 0.13);
      panG.strokeRoundedRect(panX + 6, panY + 6, panW - 12, panH - 12, 10);
      ov.add(panG);

      drawStatusPill(scene, ov, panX + 18, panY + 16, 70, `도감 ${getDexNo(result.monsterId)}`, rColor, rCss);
      drawStatusPill(
        scene,
        ov,
        panX + panW - 82,
        panY + 16,
        64,
        result.isNew ? 'NEW' : 'DUP',
        result.isNew ? 0xffd45c : 0x44ffcc,
        result.isNew ? '#fff1b0' : '#b8fff0',
      );

      // Rarity glow behind emoji
      const glowG = scene.add.graphics().setDepth(97);
      for (let r = 50; r >= 10; r -= 8) {
        glowG.fillStyle(rColor, 0.025 * (52 - r));
        glowG.fillCircle(CX, panY + 96, r);
      }
      ov.add(glowG);

      // Monster portrait (with emoji fallback)
      const summonPortraitKey = generatePortrait(scene, result.monsterId as MonsterId);
      let revealObj: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      if (scene.textures.exists(summonPortraitKey)) {
        revealObj = scene.add.image(CX, panY + 96, summonPortraitKey)
          .setOrigin(0.5).setDisplaySize(56, 56).setDepth(98).setScale(0);
      } else {
        revealObj = scene.add.text(CX, panY + 96, def.emoji, {
          fontFamily: 'sans-serif', fontSize: '64px',
        }).setOrigin(0.5).setDepth(98).setScale(0);
      }
      ov.add(revealObj);
      scene.tweens.add({ targets: revealObj, scaleX: 1, scaleY: 1, duration: 350, ease: 'Back.easeOut' });

      // Rarity particle burst — intensity scales with rarity tier
      const burstCount = 6 + result.rarityIdx * 2;
      const burstDist  = 60 + result.rarityIdx * 12;
      for (let i = 0; i < burstCount; i++) {
        const angle = (i / burstCount) * Math.PI * 2;
        const pg = scene.add.graphics().setDepth(97);
        pg.fillStyle(rColor, 0.9);
        pg.fillCircle(CX, panY + 96, 3 + result.rarityIdx);
        ov.add(pg);
        scene.tweens.add({
          targets: pg,
          x: Math.cos(angle) * burstDist,
          y: Math.sin(angle) * burstDist,
          alpha: 0, scaleX: 0.3, scaleY: 0.3,
          duration: 480 + result.rarityIdx * 40,
          ease: 'Cubic.easeOut',
          onComplete: () => pg.destroy(),
        });
      }

      // Ceiling badge
      if (result.ceilingHit) {
        const cb = scene.add.text(CX, panY + 22, '🎯 천장 달성!', {
          fontFamily: 'sans-serif', fontSize: '11px', color: '#ffdd44',
          backgroundColor: '#440000', padding: { x: 8, y: 3 },
        }).setOrigin(0.5).setDepth(99);
        ov.add(cb);
      }

      // Stars pop in
      wait(scene, 100, () => {
        const starsStr = RARITY_STARS[result.rarityIdx];
        const chars    = starsStr.split('');
        let delay = 0;
        chars.forEach((_, idx) => {
          wait(scene, delay, () => {
            const st = scene.add.text(CX - (chars.length - 1) * 12 + idx * 24, panY + 156, chars[idx], {
              fontFamily: 'sans-serif', fontSize: '16px',
            }).setOrigin(0.5).setDepth(98).setAlpha(0).setScale(0);
            ov.add(st);
            scene.tweens.add({ targets: st, alpha: 1, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
          });
          delay += 100;
        });
      });

      // Name
      wait(scene,200, () => {
        const nameT = scene.add.text(CX, panY + 184, def.name, {
          fontFamily: 'Georgia, serif', fontSize: '22px', color: rCss,
        }).setOrigin(0.5).setDepth(98).setAlpha(0);
        ov.add(nameT);
        scene.tweens.add({ targets: nameT, alpha: 1, duration: 300 });

        const tagT = scene.add.text(CX, panY + 210, getMonsterTagLine(def), {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#bfa8df',
        }).setOrigin(0.5).setDepth(98).setAlpha(0);
        ov.add(tagT);
        scene.tweens.add({ targets: tagT, alpha: 1, duration: 300 });

        const rarityT = scene.add.text(CX, panY + 232, `${RARITY_KO[result.rarityIdx]} · ${RARITY_STARS[result.rarityIdx]}`, {
          fontFamily: 'sans-serif', fontSize: '12px', color: rCss,
        }).setOrigin(0.5).setDepth(98).setAlpha(0);
        ov.add(rarityT);
        scene.tweens.add({ targets: rarityT, alpha: 1, duration: 300 });
      });

      // New / dupe badge
      wait(scene,400, () => {
        const badgeText = result.isNew
          ? '새 몬스터 도감 등록'
          : `중복 보상 +${result.scComp}💠`;
        const badgeColor = result.isNew ? '#ffdd44' : '#888888';
        const badgeT = scene.add.text(CX, panY + 270, badgeText, {
          fontFamily: 'sans-serif', fontSize: '13px', color: badgeColor,
          backgroundColor: result.isNew ? '#442200' : '#222222',
          padding: { x: 12, y: 5 },
        }).setOrigin(0.5).setDepth(98).setAlpha(0);
        ov.add(badgeT);
        scene.tweens.add({ targets: badgeT, alpha: 1, duration: 300 });
      });

      // Action buttons: [ 다시 소환 ] [ 확인 ✓ ]
      wait(scene,800, () => {
        scene.input.enabled = true;

        const againT = scene.add.text(CX - 58, panY + 310, '다시 소환', {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#9966cc',
          backgroundColor: '#1a0030', padding: { x: 10, y: 8 },
        }).setOrigin(0.5).setDepth(99).setAlpha(0).setInteractive();
        ov.add(againT);
        scene.tweens.add({ targets: againT, alpha: 1, duration: 300 });
        againT.on('pointerdown', () => {
          skipZone.destroy();
          ov.destroy();
          darkOverlay.destroy();
          onComplete();
        });

        const confirmT = scene.add.text(CX + 52, panY + 310, '확인  ✓', {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#9966cc',
          backgroundColor: '#1a0030', padding: { x: 10, y: 8 },
        }).setOrigin(0.5).setDepth(99).setAlpha(0).setInteractive();
        ov.add(confirmT);
        scene.tweens.add({ targets: confirmT, alpha: 1, duration: 300 });
        confirmT.on('pointerdown', () => {
          skipZone.destroy();
          ov.destroy();
          darkOverlay.destroy();
          onComplete();
        });
      });
    });
  });
}

// ─── x10 pull animation ─────────────────────────────────────────────────────

export function playMultiPullAnimation(
  scene: Phaser.Scene,
  results: readonly SummonResult[],
  onComplete: () => void,
): void {
  const ov = scene.add.container(0, 0).setDepth(100);
  scene.input.enabled = false;

  // Skip after 3s
  let canSkip = false;
  wait(scene,3000, () => { canSkip = true; });
  const skipZone = scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0).setInteractive().setDepth(200);

  const finalize = () => {
    skipZone.destroy();
    ov.destroy();
    scene.input.enabled = true;
    onComplete();
  };

  // ── Phase 1: Grand charging (0-1s) ──
  const darkG = scene.add.graphics().setDepth(90);
  ov.add(darkG);
  let t0 = 0;
  const chargeTimer = scene.time.addEvent({
    delay: 33, repeat: -1,
    callback: () => {
      t0 += 0.06;
      darkG.clear();
      darkG.fillStyle(0x000000, Math.min(0.85, t0 * 0.08));
      darkG.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // 10 orbital circles
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + t0 * 2;
        const rOuter = 70 + Math.sin(t0 * 2 + i) * 10;
        const rx = CX + Math.cos(angle) * rOuter;
        const ry = PORTAL_CY + Math.sin(angle) * rOuter * 0.35;
        darkG.fillStyle(RARITY_COLORS[i < 4 ? 0 : i < 7 ? 1 : 3], 0.6);
        darkG.fillCircle(rx, ry, 5);
      }
    },
  });

  // ── Phase 2: Sequential reveals (1-4s) ──
  wait(scene, 1000, () => {
    chargeTimer.destroy();
    darkG.clear();
    darkG.fillStyle(0x000000, 0.92);
    darkG.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid layout: 3-3-4 → use 3 per row (rows: 3, 3, 4)
    const COLS = [3, 3, 4];
    const cardW = 84, cardH = 110, padX = 10, padY = 8;
    const totalH = 3 * cardH + 2 * padY;
    const startY = (CANVAS_HEIGHT - totalH) / 2 - 10;

    const cardContainers: Phaser.GameObjects.Container[] = [];
    let idx = 0;

    for (let row = 0; row < 3; row++) {
      const colCount = COLS[row];
      const rowW = colCount * cardW + (colCount - 1) * padX;
      const rowX = (CANVAS_WIDTH - rowW) / 2;
      const cy   = startY + row * (cardH + padY) + cardH / 2;

      for (let col = 0; col < colCount && idx < results.length; col++) {
        const result = results[idx];
        const mDef   = MONSTER_DEFS[result.monsterId]!;
        const rColor = RARITY_COLORS[result.rarityIdx];
        const cx     = rowX + col * (cardW + padX) + cardW / 2;

        const delay = idx * 300;
        const i     = idx;
        idx++;

        wait(scene, delay, () => {
          if (!scene.scene.isActive()) return;

          const cc = scene.add.container(cx, cy).setDepth(96);
          ov.add(cc);
          cardContainers[i] = cc;

          // Card bg
          const cg = scene.add.graphics();
          cg.fillStyle(0x040208, 0.42);
          cg.fillRoundedRect(-cardW / 2 + 2, -cardH / 2 + 3, cardW, cardH, 8);
          cg.fillStyle(0x100022, 1);
          cg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
          cg.fillStyle(rColor, result.rarityIdx >= 2 ? 0.13 : 0.07);
          cg.fillRoundedRect(-cardW / 2 + 7, -cardH / 2 + 20, cardW - 14, 50, 7);
          drawFoilLines(cg, -cardW / 2 + 7, -cardH / 2 + 20, cardW - 14, 50, rColor, result.rarityIdx >= 2 ? 0.18 : 0.07);
          cg.lineStyle(1.5, rColor, result.rarityIdx >= 2 ? 1 : 0.5);
          cg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
          cg.lineStyle(1, 0xffffff, 0.10);
          cg.strokeRoundedRect(-cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, cardH - 8, 6);
          cc.add(cg);

          const dexBg = scene.add.graphics();
          dexBg.fillStyle(0x07020c, 0.94);
          dexBg.fillRoundedRect(-34, -49, 68, 13, 5);
          dexBg.lineStyle(1, rColor, 0.55);
          dexBg.strokeRoundedRect(-34, -49, 68, 13, 5);
          cc.add(dexBg);
          cc.add(scene.add.text(0, -42.5, `도감 ${getDexNo(result.monsterId)}`, {
            fontFamily: 'sans-serif',
            fontSize: '7px',
            color: RARITY_CSS[result.rarityIdx] ?? '#ffffff',
            fontStyle: 'bold',
          }).setOrigin(0.5));

          // Flash before flip for Rare+
          if (result.rarityIdx >= 2) {
            const fG = scene.add.graphics().setDepth(102).setAlpha(0.7);
            fG.fillStyle(rColor, 1);
            fG.fillCircle(cx, cy, 18);
            ov.add(fG);
            scene.tweens.add({
              targets: fG, alpha: 0,
              duration: 160, ease: 'Linear',
              onComplete: () => { if (fG.active) fG.destroy(); },
            });
          }

          // Emoji
          const et = scene.add.text(0, -17, mDef.emoji, {
            fontFamily: 'sans-serif', fontSize: '24px',
          }).setOrigin(0.5);
          cc.add(et);

          // Name
          cc.add(scene.add.text(0, 14, mDef.name.slice(0, 5), {
            fontFamily: 'sans-serif', fontSize: '11px', color: result.isNew ? '#ffdd44' : '#888888',
          }).setOrigin(0.5));

          // Stars
          cc.add(scene.add.text(0, 29, RARITY_STARS[result.rarityIdx], {
            fontFamily: 'sans-serif', fontSize: '10px',
            color: RARITY_CSS[result.rarityIdx] ?? '#ffffff',
          }).setOrigin(0.5));
          cc.add(scene.add.text(0, 40, RARITY_KO[result.rarityIdx] ?? '획득', {
            fontFamily: 'sans-serif',
            fontSize: '7px',
            color: RARITY_CSS[result.rarityIdx] ?? '#ffffff',
            fontStyle: 'bold',
          }).setOrigin(0.5));

          // New/dupe tag
          if (!result.isNew) {
            const dg2 = scene.add.graphics();
            dg2.fillStyle(0x0b1f1d, 0.9);
            dg2.fillRoundedRect(-31, cardH / 2 - 18, 62, 14, 4);
            dg2.lineStyle(1, 0x44ffcc, 0.48);
            dg2.strokeRoundedRect(-31, cardH / 2 - 18, 62, 14, 4);
            cc.add(dg2);
            cc.add(scene.add.text(0, cardH / 2 - 11, `DUP +${result.scComp}`, {
              fontFamily: 'sans-serif', fontSize: '8px', color: '#44ffcc',
              fontStyle: 'bold',
            }).setOrigin(0.5));
          } else {
            const ng = scene.add.graphics();
            ng.fillStyle(0x3b2500, 0.94);
            ng.fillRoundedRect(-20, cardH / 2 - 18, 40, 14, 4);
            ng.lineStyle(1, 0xffd45c, 0.68);
            ng.strokeRoundedRect(-20, cardH / 2 - 18, 40, 14, 4);
            cc.add(ng);
            cc.add(scene.add.text(0, cardH / 2 - 11, 'NEW', {
              fontFamily: 'sans-serif', fontSize: '9px', color: '#ffe8a3',
              fontStyle: 'bold',
            }).setOrigin(0.5));
          }

          // Flip in animation
          cc.setScale(0, 1);
          scene.tweens.add({
            targets: cc, scaleX: 1,
            duration: 210, ease: 'Back.easeOut',
          });
        });
      }
    }

    // ── Phase 3: Highlight best (4s) ──
    wait(scene,3000, () => {
      if (!scene.scene.isActive()) return;
      const bestIdx = results.reduce((best, r, i) =>
        r.rarityIdx > results[best].rarityIdx ? i : best, 0);

      cardContainers.forEach((cc, i) => {
        if (!cc?.active) return;
        if (i !== bestIdx) {
          scene.tweens.add({ targets: cc, alpha: 0.3, duration: 320, ease: 'Linear' });
        } else {
          scene.tweens.add({ targets: cc, scaleX: 1.35, scaleY: 1.35, duration: 220, ease: 'Quad.easeOut' });
        }
      });

      const bestResult = results[bestIdx];
      if (bestResult.rarityIdx >= 2) {
        const bestDef = MONSTER_DEFS[bestResult.monsterId]!;
        const highT = scene.add.text(CX, CANVAS_HEIGHT - 80, `최고 획득: ${RARITY_STARS[bestResult.rarityIdx]} ${bestDef.name}`, {
          fontFamily: 'Georgia, serif', fontSize: '13px', color: RARITY_CSS[bestResult.rarityIdx],
          backgroundColor: '#0d0010', padding: { x: 10, y: 6 },
        }).setOrigin(0.5).setDepth(97).setAlpha(0);
        ov.add(highT);
        scene.tweens.add({ targets: highT, alpha: 1, duration: 400 });
      }

      // ── Phase 4: Summary buttons (6s) ──
      wait(scene,2000, () => {
        if (!scene.scene.isActive()) return;
        // Restore all cards
        cardContainers.forEach(cc => {
          if (cc?.active) scene.tweens.add({ targets: cc, alpha: 1, scaleX: 1, scaleY: 1, duration: 200 });
        });

        // Total SC compensation
        const totalSC = results.reduce((sum, r) => sum + r.scComp, 0);
        const gs2     = loadGameState();
        const summaryText = totalSC > 0
          ? `중복 보상: +${totalSC}💠   현재: ${gs2.soulCrystals}💠`
          : `새 몬스터 ${results.filter(r => r.isNew).length}마리 획득!`;

        const sumT = scene.add.text(CX, CANVAS_HEIGHT - 108, summaryText, {
          fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaff',
        }).setOrigin(0.5).setDepth(97);
        ov.add(sumT);

        scene.input.enabled = true;

        // Buttons
        const btnY2 = CANVAS_HEIGHT - 62;
        const againT = scene.add.text(CX - 60, btnY2, '다시 소환', {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#9966cc',
          backgroundColor: '#1a0030', padding: { x: 10, y: 7 },
        }).setOrigin(0.5).setDepth(97).setInteractive();
        againT.on('pointerdown', () => { skipZone.destroy(); ov.destroy(); darkG.destroy(); onComplete(); });
        ov.add(againT);

        const doneT = scene.add.text(CX + 60, btnY2, '확인  ✓', {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#9966cc',
          backgroundColor: '#1a0030', padding: { x: 10, y: 7 },
        }).setOrigin(0.5).setDepth(97).setInteractive();
        doneT.on('pointerdown', finalize);
        ov.add(doneT);
      });
    });
  });

  skipZone.on('pointerdown', () => { if (canSkip) finalize(); });
}
