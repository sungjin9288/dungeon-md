/**
 * Monster idle animations — extracted from DungeonHomeScene.
 *
 * Each monster type has a unique idle animation applied to its emoji
 * text object on the home screen dungeon grid.
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
      // PACE_AND_PUNCH: left-right walk + random punch
      scene.tweens.add({
        targets: emoji, x: x0 - 20,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const doPunch = () => {
        if (!emoji.active) return;
        const orig = emoji.text;
        emoji.setText('👊');
        scene.time.delayedCall(200, () => { if (emoji.active) emoji.setText(orig); });
        scene.time.delayedCall(Phaser.Math.Between(4000, 7000), doPunch);
      };
      scene.time.delayedCall(Phaser.Math.Between(4000, 7000), doPunch);
      break;
    }
    case 'dokkaebi_junior': {
      // BOUNCE_AND_LOOK: bob + periodic flip & spin
      scene.tweens.add({
        targets: emoji, y: y0 - 8,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      scene.time.addEvent({
        delay: 5000, repeat: -1,
        callback: () => {
          if (!emoji.active) return;
          emoji.setScale(-1, 1);
          scene.time.delayedCall(1000, () => { if (emoji.active) emoji.setScale(1, 1); });
        },
      });
      scene.time.delayedCall(2500, () => {
        scene.time.addEvent({
          delay: 5000, repeat: -1,
          callback: () => {
            if (!emoji.active) return;
            scene.tweens.add({
              targets: emoji, angle: 360, duration: 400,
              onComplete: () => { if (emoji.active) emoji.setAngle(0); },
            });
          },
        });
      });
      break;
    }
    case 'fire_dokkaebi': {
      // BREATHE_FIRE: scale pulse + periodic fire particles
      scene.tweens.add({
        targets: emoji, scaleX: 1.05, scaleY: 1.05,
        duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      scene.time.addEvent({
        delay: 6000, repeat: -1,
        callback: () => {
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
        },
      });
      break;
    }
    case 'gumiho_guardian': {
      // TAIL_GROOM: gentle sway + periodic sparkle burst
      scene.tweens.add({
        targets: emoji, angle: 3,
        duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      scene.time.addEvent({
        delay: 8000, repeat: -1,
        callback: () => {
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
        },
      });
      break;
    }
    case 'sage': {
      // MEDITATE_FLOAT: gentle float + periodic aura pulse
      scene.tweens.add({
        targets: emoji, y: y0 - 6, alpha: 0.85,
        duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      scene.time.addEvent({
        delay: 10000, repeat: -1,
        callback: () => {
          if (!emoji.active) return;
          const glow = scene.add.graphics().setDepth(19);
          glow.fillStyle(0xffd700, 0.28);
          glow.fillCircle(emoji.x, emoji.y, 28);
          scene.tweens.add({
            targets: glow, alpha: 0, duration: 350,
            onComplete: () => glow.destroy(),
          });
        },
      });
      break;
    }
    case 'frost_spirit': {
      // FROST_STEP: wander + frost trail (tween-driven recursion)
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
      scene.time.delayedCall(1500, doWander);
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
