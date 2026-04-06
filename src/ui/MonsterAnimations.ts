/**
 * Monster idle animations — extracted from DungeonHomeScene.
 *
 * Each monster type has a unique idle animation applied to its emoji
 * text object on the home screen dungeon grid.
 *
 * NOTE: Uses setTimeout/setInterval for legacy compatibility.
 * TODO: Convert to scene.time.addEvent for proper scene lifecycle cleanup.
 */
import Phaser from 'phaser';

export function applyIdleAnimation(
  scene: Phaser.Scene,
  emoji: Phaser.GameObjects.Text,
  monsterId: string,
): void {
  const x0 = emoji.x;
  const y0 = emoji.y;

  switch (monsterId) {
    case 'dokkaebi_warrior': {
      // PACE_AND_PUNCH: left-right walk
      scene.tweens.add({
        targets: emoji, x: x0 - 20,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const doPunch = () => {
        if (!emoji.active) return;
        const orig = emoji.text;
        emoji.setText('👊');
        setTimeout(() => { if (emoji.active) emoji.setText(orig); }, 200);
        setTimeout(doPunch, Phaser.Math.Between(4000, 7000));
      };
      setTimeout(doPunch, Phaser.Math.Between(4000, 7000));
      break;
    }
    case 'dokkaebi_junior': {
      // BOUNCE_AND_LOOK
      scene.tweens.add({
        targets: emoji, y: y0 - 8,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      setInterval(() => {
        if (!emoji.active) return;
        emoji.setScale(-1, 1);
        setTimeout(() => { if (emoji.active) emoji.setScale(1, 1); }, 1000);
      }, 5000);
      setTimeout(() => setInterval(() => {
        if (!emoji.active) return;
        scene.tweens.add({
          targets: emoji, angle: 360, duration: 400,
          onComplete: () => { if (emoji.active) emoji.setAngle(0); },
        });
      }, 5000), 2500);
      break;
    }
    case 'fire_dokkaebi': {
      // BREATHE_FIRE
      scene.tweens.add({
        targets: emoji, scaleX: 1.05, scaleY: 1.05,
        duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      setInterval(() => {
        if (!emoji.active) return;
        for (let i = 0; i < 3; i++) {
          const px = emoji.x + Phaser.Math.Between(-12, 12);
          const fp = scene.add.text(px, emoji.y - 8, '🔥', { fontSize: '12px' })
            .setOrigin(0.5).setDepth(20);
          scene.tweens.add({
            targets: fp, y: fp.y - 32, alpha: 0,
            duration: 600, delay: i * 80,
            onComplete: () => fp.destroy(),
          });
        }
      }, 6000);
      break;
    }
    case 'gumiho_guardian': {
      // TAIL_GROOM
      scene.tweens.add({
        targets: emoji, angle: 3,
        duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      setInterval(() => {
        if (!emoji.active) return;
        for (let i = 0; i < 3; i++) {
          const ang = (i * 120) * Math.PI / 180;
          const r = 22;
          const sp = scene.add.text(
            emoji.x + Math.cos(ang) * r, emoji.y + Math.sin(ang) * r,
            '✨', { fontSize: '10px' },
          ).setOrigin(0.5).setDepth(20);
          scene.tweens.add({
            targets: sp,
            x: sp.x + Math.cos(ang) * 10,
            y: sp.y + Math.sin(ang) * 10,
            alpha: 0, duration: 800,
            onComplete: () => sp.destroy(),
          });
        }
      }, 8000);
      break;
    }
    case 'sage': {
      // MEDITATE_FLOAT
      scene.tweens.add({
        targets: emoji, y: y0 - 6, alpha: 0.85,
        duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      setInterval(() => {
        if (!emoji.active) return;
        const glow = scene.add.graphics().setDepth(19);
        glow.fillStyle(0xffd700, 0.28);
        glow.fillCircle(emoji.x, emoji.y, 28);
        scene.tweens.add({
          targets: glow, alpha: 0, duration: 350,
          onComplete: () => glow.destroy(),
        });
      }, 10000);
      break;
    }
    case 'frost_spirit': {
      // FROST_STEP: wander + frost trail
      const doWander = () => {
        if (!emoji.active) return;
        const fp = scene.add.text(emoji.x, emoji.y, '❄', {
          fontSize: '11px', color: '#88ccff',
        }).setOrigin(0.5).setDepth(15).setAlpha(0.7);
        scene.tweens.add({ targets: fp, alpha: 0, duration: 2000, onComplete: () => fp.destroy() });
        const dx = Phaser.Math.Between(-15, 15);
        scene.tweens.add({
          targets: emoji,
          x: Phaser.Math.Clamp(emoji.x + dx, x0 - 22, x0 + 22),
          duration: 2000, ease: 'Sine.easeInOut',
          onComplete: doWander,
        });
      };
      setTimeout(doWander, 1500);
      break;
    }
    default: {
      // DEFAULT: gentle bob
      scene.tweens.add({
        targets: emoji, y: y0 - 5,
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }
}
