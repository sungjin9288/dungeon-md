import Phaser from 'phaser';
import type { EquipmentStats } from '../data/barracks';
import { getRoomEquipmentDamageReduction, reduceRoomEquipmentDamage } from '../data/equipmentDefense';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CELL_SIZE } from '../constants/layout';
import { getReducedMotion } from '../utils/reducedMotion';
import { ROOM_DEFS, type RoomData, type RoomType } from '../data/rooms';
import {
  drawStoneVisual,
  drawLevelBadgeVisual,
  drawRoomHpBarVisual,
  flashDamageVisual,
  collapseRoomVisual,
  clearSlotLoadoutVisual,
  setSlotLoadoutVisual,
} from './RoomVisuals';
import { MAX_ROOM_LEVEL } from '../data/wisdom';
import { drawSigil } from '../ui/Sigils';
import { ROOM_TYPE_SIGILS, sigilFor } from '../ui/sigilMaps';

export type RoomState = 'empty' | 'occupied' | 'locked' | 'water';

export interface RoomLoadoutVisualOptions {
  readonly roomTypeName: string;
  readonly accentColor: number;
  /** Abstract room category → pixel-room fixture (weapon rack / spikes / …). */
  readonly slotRoomType?: 'combat' | 'trap' | 'support' | 'magic';
  readonly primaryMonsterEmoji?: string | null;
  /** Instance/type id of the deployed guardian → its pixel sprite. */
  readonly primaryMonsterId?: string | null;
  readonly monsterCount: number;
  readonly monsterCapacity: number;
  readonly equipmentCount: number;
  readonly trapCount: number;
  readonly trapCapacity: number;
}

export class Room extends Phaser.GameObjects.Container {
  state: RoomState;
  isSelected = false;
  roomData: RoomData | null = null;
  equipmentMap?: ReadonlyMap<string, EquipmentStats>;
  readonly row: number;
  readonly col: number;

  /** @internal */ bg: Phaser.GameObjects.Graphics;
  private outline: Phaser.GameObjects.Graphics;
  private candleGfx?: Phaser.GameObjects.Graphics;
  private candleTween?: Phaser.Tweens.Tween;
  private emptyLabel?: Phaser.GameObjects.Text;
  private selectionTween?: Phaser.Tweens.Tween;
  /** Decorative room motion (candle/selection/broken-glow/water) is gated by this. */
  private readonly reducedMotion = getReducedMotion();
  /** @internal */ levelBadge?:   Phaser.GameObjects.Graphics;
  private monsterBadge?: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  /** @internal */ roomTypeBadge?: Phaser.GameObjects.Graphics;
  /** @internal */ baseRoomIcon?: Phaser.GameObjects.Text;
  /** @internal */ baseRoomNameLabel?: Phaser.GameObjects.Text;
  /** @internal */ slotLoadoutGfx?: Phaser.GameObjects.Graphics;
  /** @internal */ slotLoadoutLabels: Phaser.GameObjects.Text[] = [];
  /** @internal */ slotLoadoutSprite?: Phaser.GameObjects.Image;
  /** @internal */ slotLoadoutTween?: Phaser.Tweens.Tween;

  /** @internal */ roomHpBar?: Phaser.GameObjects.Graphics;
  /** @internal */ roomHpValue = 0;
  /** @internal */ roomHpMax  = 0;
  /** @internal */ damageFlash?: Phaser.GameObjects.Graphics;
  /** @internal */ hpCriticalTween?: Phaser.Tweens.Tween;
  private cooldownRing?: Phaser.GameObjects.Graphics;
  private waterRipple?: Phaser.GameObjects.Graphics;
  private waterTween?: Phaser.Tweens.Tween;
  /** @internal */ isDestroyed = false;

  /** @internal */ readonly cs: number;   // effective cell size

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    row: number, col: number,
    state: RoomState,
    onSelect: (room: Room) => void,
    cellSize?: number,
  ) {
    super(scene, x, y);
    this.cs    = cellSize ?? CELL_SIZE;
    this.row   = row;
    this.col   = col;
    this.state = state;

    this.bg = scene.add.graphics();
    this.drawStone();
    this.add(this.bg);

    this.outline = scene.add.graphics();
    this.add(this.outline);

    if (state === 'empty') this.addCandle(scene);
    if (state === 'locked') this.addLockGlyph(scene);
    if (state === 'water') this.drawWaterCell(scene);

    // Extend hit area by 14px on each side for finger-friendly touch targets (real device)
    const pad = 14;
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -this.cs / 2 - pad, -this.cs / 2 - pad,
        this.cs + pad * 2,  this.cs + pad * 2,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on('pointerdown', () => onSelect(this));
    this.on('pointerover', () => { if (!this.isSelected) this.setHighlight(true); });
    this.on('pointerout',  () => { if (!this.isSelected) this.setHighlight(false); });

    scene.add.existing(this);
  }

  // ─── Stone drawing ──────────────────────────────────────────────────────

  private drawStone(): void {
    drawStoneVisual(this);
  }

  // ─── Candle ─────────────────────────────────────────────────────────────

  private addCandle(scene: Phaser.Scene): void {
    this.candleGfx = scene.add.graphics();
    this.drawCandle();
    this.add(this.candleGfx);

    // Battle cannot build (Option B): an unbuilt cell is the Home "빈 터", not an action.
    this.emptyLabel = scene.add.text(0, 26, '빈 터', {
      fontFamily: "Georgia, serif", fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.add(this.emptyLabel);

    if (!this.reducedMotion) {
      this.candleTween = scene.tweens.add({
        targets: this.candleGfx,
        scaleX: { from: 0.88, to: 1.12 }, scaleY: { from: 0.9, to: 1.1 },
        alpha:  { from: 0.5,  to: 0.75 },
        duration: Phaser.Math.Between(650, 1000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  private drawCandle(): void {
    const g = this.candleGfx!;
    g.clear();
    // Warm-brown candle base (recolored from dark) + bright flame glow kept.
    g.fillStyle(CASUAL.EDGE_SOFT, 0.9);  g.fillRect(-4, 2, 8, 18);
    g.fillStyle(CASUAL.EDGE_SOFT, 0.45); g.fillRect(-3, 18, 4, 5);
    g.fillStyle(CASUAL.GOLD, 0.95);      g.fillTriangle(0, -15, -8, 3, 8, 3);
    g.fillStyle(0xffee44, 0.9);          g.fillTriangle(0, -8,  -4, 3, 4, 3);
  }

  private addLockGlyph(scene: Phaser.Scene): void {
    // Lock glyph in soft ink — clearly "locked" on the bright field.
    const lock = scene.add.text(0, 0, '🔒', {
      fontSize: '20px',
    }).setOrigin(0.5).setAlpha(0.55);
    this.add(lock);
    const label = scene.add.text(0, 22, '잠김', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setAlpha(0.75);
    this.add(label);
  }

  // ─── Selection ──────────────────────────────────────────────────────────

  setHighlight(on: boolean): void {
    this.outline.clear();
    if (on) {
      this.outline.lineStyle(2.5, CASUAL.GOLD, 0.7);
      this.outline.strokeRoundedRect(-this.cs/2 + 5, -this.cs/2 + 5, this.cs - 10, this.cs - 10, 11);
    }
  }

  select(): void {
    this.isSelected = true;
    this.outline.clear();
    this.outline.lineStyle(3, CASUAL.GOLD, 1);
    this.outline.strokeRoundedRect(-this.cs/2 + 5, -this.cs/2 + 5, this.cs - 10, this.cs - 10, 11);
    if (!this.reducedMotion) {
      this.selectionTween = this.scene.tweens.add({
        targets: this.outline, alpha: { from: 0.6, to: 1.0 },
        duration: 400, yoyo: true, repeat: -1,
      });
    }
  }

  deselect(): void {
    this.isSelected = false;
    this.selectionTween?.stop();
    this.selectionTween = undefined;
    this.outline.setAlpha(1).clear();
  }

  initRoomHp(hp: number): void {
    this.roomHpMax   = hp;
    this.roomHpValue = hp;
    if (!this.roomHpBar) {
      this.roomHpBar = this.scene.add.graphics();
      this.add(this.roomHpBar);
    }
    this.drawRoomHpBar();
  }

  setInitialRoomLevel(level: number): void {
    if (!this.roomData) return;
    this.roomData.level = Phaser.Math.Clamp(Math.round(level), 1, MAX_ROOM_LEVEL);
    this.drawLevelBadge();
  }

  setRoomHpSnapshot(hp: number, maxHp: number): void {
    const safeMax = Math.max(1, Math.round(maxHp));
    const safeHp  = Phaser.Math.Clamp(Math.round(hp), 0, safeMax);
    this.roomHpMax   = safeMax;
    this.roomHpValue = safeHp;
    if (this.roomData) {
      this.roomData.maxRoomHp = safeMax;
      this.roomData.roomHp    = safeHp;
      this.roomData.maxHp     = safeMax;
      this.roomData.hp        = safeHp;
    }
    if (!this.roomHpBar) {
      this.roomHpBar = this.scene.add.graphics();
      this.add(this.roomHpBar);
    }
    this.drawRoomHpBar();
  }

  setDungeonSlotLoadoutVisual(options: RoomLoadoutVisualOptions): void {
    setSlotLoadoutVisual(this, options);
  }

  addBonusHp(bonus: number): void {
    this.roomHpMax  += bonus;
    this.roomHpValue += bonus;
    if (this.roomData) {
      this.roomData.maxRoomHp += bonus;
      this.roomData.roomHp   += bonus;
    }
    this.drawRoomHpBar();
  }

  damageRoomHp(amount: number): void {
    if (this.isDestroyed) return;
    const reduction = getRoomEquipmentDamageReduction(
      [this.roomData?.monsterSlot, ...(this.roomData?.monsterSlots ?? [])], this.equipmentMap,
    );
    this.roomHpValue = Math.max(0, this.roomHpValue - reduceRoomEquipmentDamage(amount, reduction));
    if (this.roomData) this.roomData.roomHp = this.roomHpValue;
    this.drawRoomHpBar();
    this._flashDamage();
    if (this.roomHpValue <= 0) this.collapseRoom();
  }

  private _flashDamage(): void {
    flashDamageVisual(this);
  }

  healRoomHp(amount: number): void {
    if (this.isDestroyed) return;
    this.roomHpValue = Math.min(this.roomHpMax, this.roomHpValue + amount);
    if (this.roomData) this.roomData.roomHp = this.roomHpValue;
    this.drawRoomHpBar();
  }

  get structuralHp(): number { return this.roomHpValue; }
  get structuralHpMax(): number { return this.roomHpMax; }
  get destroyed(): boolean { return this.isDestroyed; }

  /** Sync hp bar from roomData (used after heal_room / healing_rain skills). */
  updateHpBar(): void {
    if (this.roomData) {
      this.roomHpValue = this.roomData.roomHp;
      this.roomHpMax   = this.roomData.maxRoomHp;
    }
    this.drawRoomHpBar();
  }

  private drawRoomHpBar(): void {
    drawRoomHpBarVisual(this);
  }

  private collapseRoom(): void {
    collapseRoomVisual(this);
  }

  // ─── Occupation ─────────────────────────────────────────────────────────

  occupyWith(type: RoomType): void {
    const def = ROOM_DEFS[type];
    this.clearDungeonSlotLoadoutVisual();

    // Remove candle
    this.candleTween?.stop();
    this.candleGfx?.destroy();
    this.emptyLabel?.destroy();

    // Set state + data
    this.state    = 'occupied';
    this.roomData = {
      type, level: 1, hp: def.baseHp, maxHp: def.baseHp,
      attackCooldown: def.attackCooldown, lastAttackTime: 0,
      goldPerSec: def.goldPerSec, monsterSlot: null, monsterSlots: [], hasFirstStrikeUsed: false,
      lastScrollBurstTime: 0, scrollBurstActiveUntil: 0,
      foxCharmAttackCount: 0, tideHitCount: 0, tauntLastTime: 0,
      roomHp: def.baseHp, maxRoomHp: def.baseHp,
      armoryDmgBonus: 0, roomTypeDmgMult: 1.0, venomHitCount: 0, whirlwindHitCount: 0, soulHarvestLastTime: 0,
      altarKillCount: 0, altarGhostActiveUntil: 0, dragonRoarLastTime: 0, lunarResetLastTime: 0,
      deathRattleLastTime: 0,
      nextAttack3x: false, immuneUntil: 0, speedBoostUntil: 0, rageUntil: 0,
    };

    // Redraw stone with tint
    this.drawStone();

    // Left accent stripe
    const stripe = this.scene.add.graphics();
    stripe.fillStyle(def.accentColor, 0.7);
    stripe.fillRect(-this.cs / 2 + 7, -this.cs / 2 + 7, 3, this.cs - 14);
    this.add(stripe);

    // Room icon (emoji)
    this.baseRoomIcon = this.scene.add.text(0, -14, def.emoji, { fontSize: '28px' }).setOrigin(0.5);
    this.add(this.baseRoomIcon);

    // Room name — parchment ink so it reads on the dark pixel room.
    this.baseRoomNameLabel = this.scene.add.text(0, 24, def.koreanName, {
      fontFamily: "Georgia, serif", fontSize: '10px', color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.baseRoomNameLabel);

    // Level badge (Lv1 = none visible yet)
    this.levelBadge = this.scene.add.graphics();
    this.add(this.levelBadge);
    this.drawLevelBadge();

    // Build animation: 0 → 1.2 → 1.0
    this.setScale(0.05);
    this.scene.tweens.add({
      targets: this, scaleX: 1.2, scaleY: 1.2,
      duration: 280, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this, scaleX: 1, scaleY: 1, duration: 120, ease: 'Linear',
        });
      },
    });
  }

  private drawLevelBadge(): void {
    drawLevelBadgeVisual(this);
  }

  setMonsterBadge(emoji: string | null): void {
    this.monsterBadge?.destroy();
    this.monsterBadge = undefined;
    if (!emoji) return;
    this.monsterBadge = this.scene.add.text(
      this.cs / 2 - 4, -this.cs / 2 + 6, emoji, { fontSize: '16px' },
    ).setOrigin(1, 0);
    this.add(this.monsterBadge);
  }

  /** Set a pixel-art sprite badge. Falls back to emoji if texture not found. */
  setMonsterSprite(monsterId: string | null, fallbackEmoji?: string): void {
    this.monsterBadge?.destroy();
    this.monsterBadge = undefined;
    if (!monsterId) return;

    const textureKey = `monster-${monsterId}`;
    if (this.scene.textures.exists(textureKey)) {
      this.monsterBadge = this.scene.add.image(
        this.cs / 2 - 12, -this.cs / 2 + 14, textureKey,
      ).setOrigin(0.5).setDisplaySize(20, 20);
    } else {
      // Fallback to emoji for monsters without generated textures (e.g. Ch6 lazy)
      const emoji = fallbackEmoji ?? '❓';
      this.monsterBadge = this.scene.add.text(
        this.cs / 2 - 4, -this.cs / 2 + 6, emoji, { fontSize: '16px' },
      ).setOrigin(1, 0);
    }
    this.add(this.monsterBadge);
  }

  /** Small room-family sigil in the cell's top-left corner (was an emoji). */
  setRoomTypeBadge(roomType: string | null): void {
    this.roomTypeBadge?.destroy();
    this.roomTypeBadge = undefined;
    if (!roomType) return;
    const badge = this.scene.add.graphics().setAlpha(0.85);
    drawSigil(badge, sigilFor(ROOM_TYPE_SIGILS, roomType, 'shield'), -this.cs / 2 + 11, -this.cs / 2 + 9, 13, CASUAL.INK, { disc: false });
    this.roomTypeBadge = badge;
    this.add(badge);
  }

  private clearDungeonSlotLoadoutVisual(): void {
    clearSlotLoadoutVisual(this);
  }

  setBrokenState(): void {
    const s  = this.cs;
    const inset = 7;

    // Muted warm rubble fill (lightened from dark; keeps a faint red danger wash).
    const cg = this.scene.add.graphics();
    cg.fillStyle(CASUAL.EDGE_SOFT, 0.55);
    cg.fillRoundedRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2, 12);
    cg.fillStyle(CASUAL.RED, 0.12);
    cg.fillRoundedRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2, 12);

    // Jagged crack pattern — saturated red danger marks.
    cg.lineStyle(2, CASUAL.RED_DK, 0.85);
    cg.lineBetween(-s / 2 + 18, -s / 2 + 8,  -4,  4);
    cg.lineBetween(-4,  4,  10, -s / 2 + 12);
    cg.lineBetween(-4,  4,  -8,  s / 2 - 12);
    cg.lineBetween(-8,  s / 2 - 12,  s / 2 - 14,  s / 2 - 6);
    cg.lineStyle(2.5, CASUAL.RED, 0.6);
    cg.strokeRoundedRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2, 12);
    this.add(cg);

    // Pulsing red glow border
    const glow = this.scene.add.graphics();
    glow.lineStyle(3, CASUAL.RED, 0.8);
    glow.strokeRoundedRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10, 11);
    this.add(glow);
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: glow, alpha: { from: 0.8, to: 0.15 },
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    this.add(this.scene.add.text(0, s / 2 - 10, '파손', {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.WHITE,
      backgroundColor: CASUAL_CSS.RED, padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1));
  }

  flashAttack(): void {
    // Alpha flash (original)
    this.scene.tweens.add({
      targets: this.bg, alpha: { from: 1, to: 0.3 },
      duration: 80, yoyo: true, repeat: 2,
    });

    // Phase D3: attack choreography — anticipation (squash) → strike
    // (overshoot) → recoil (settle). Animates the monsterBadge so the
    // room frame stays stable while the occupant "pounces".
    const badge = this.monsterBadge;
    if (!badge) return;

    // Kill any in-flight attack tween on the badge
    this.scene.tweens.killTweensOf(badge);
    badge.setScale(1, 1);

    // Anticipation: brief inward squash (0.85× over 60ms)
    this.scene.tweens.add({
      targets: badge,
      scaleX: 0.88,
      scaleY: 0.82,
      duration: 60,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!badge.active) return;
        // Strike: overshoot forward (1.25× over 100ms)
        this.scene.tweens.add({
          targets: badge,
          scaleX: 1.22,
          scaleY: 1.22,
          duration: 100,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!badge.active) return;
            // Recoil: settle back to rest (1.0× over 180ms)
            this.scene.tweens.add({
              targets: badge,
              scaleX: 1,
              scaleY: 1,
              duration: 180,
              ease: 'Cubic.easeOut',
            });
          },
        });
      },
    });
  }

  private drawWaterCell(scene: Phaser.Scene): void {
    // Bright water cell — blue tint on cream, chunky brown border.
    const s  = this.cs;
    const inset = 7;
    const cw = s - inset * 2;
    const wg = scene.add.graphics().setDepth(this.depth + 1);
    wg.fillStyle(CASUAL.PANEL, 1);
    wg.fillRoundedRect(-s / 2 + inset, -s / 2 + inset, cw, cw, 12);
    wg.fillStyle(CASUAL.BLUE, 0.35);
    wg.fillRoundedRect(-s / 2 + inset, -s / 2 + inset, cw, cw, 12);
    wg.fillStyle(0xffffff, 0.4);
    wg.fillRoundedRect(-s / 2 + inset + 8, -s / 2 + inset + 6, cw - 16, 16, 7);
    wg.lineStyle(2.5, CASUAL.EDGE, 1);
    wg.strokeRoundedRect(-s / 2 + inset, -s / 2 + inset, cw, cw, 12);
    // Animated ripple
    this.waterRipple = scene.add.graphics().setDepth(this.depth + 2);
    this.add(wg);
    this.add(this.waterRipple);
    if (this.reducedMotion) {
      // Static water surface — flat lines, no perpetual ripple animation.
      this.waterRipple.lineStyle(1.5, CASUAL.BLUE_DK, 0.5);
      for (let row = 0; row < 3; row++) {
        const y0 = -s / 2 + 12 + row * 14;
        this.waterRipple.lineBetween(-s / 2 + 4, y0, s / 2 - 4, y0);
      }
    } else {
      // Use a scene update interval via tweens
      scene.tweens.add({
        targets: { t: 0 }, t: Math.PI * 2,
        duration: 2000, repeat: -1, ease: 'Linear',
        onUpdate: (tween) => {
          if (!this.waterRipple || !this.active) return;
          this.waterRipple.clear();
          const t = tween.getValue() as number;
          // Draw 3 sine-wave lines
          this.waterRipple.lineStyle(1.5, CASUAL.BLUE_DK, 0.6);
          for (let row = 0; row < 3; row++) {
            const y0 = -s / 2 + 12 + row * 14;
            this.waterRipple.beginPath();
            for (let px = -s / 2 + 4; px <= s / 2 - 4; px += 4) {
              const wy = y0 + Math.sin(t + px * 0.1 + row * 1.2) * 3;
              if (px === -s / 2 + 4) this.waterRipple.moveTo(px, wy);
              else this.waterRipple.lineTo(px, wy);
            }
            this.waterRipple.strokePath();
          }
        },
      });
    }
    // Disable interaction for water cells
    this.removeInteractive();
  }

  /** Called from DungeonScene.update() during waves to draw a circular progress ring. */
  updateAttackCooldown(now: number, guardianIntervalMult = 1): void {
    const data = this.roomData;
    if (!data || !data.attackCooldown || this.state !== 'occupied') {
      this.cooldownRing?.setVisible(false);
      return;
    }
    if (!this.cooldownRing) {
      this.cooldownRing = this.scene.add.graphics().setDepth(this.depth + 3);
      this.add(this.cooldownRing);
    }
    this.cooldownRing.setVisible(true);
    const interval = data.attackCooldown * (data.monsterSlot ? guardianIntervalMult : 1);
    const pct = Math.min(1, (now - data.lastAttackTime) / interval);
    const r   = 6;
    const cx  = this.cs / 2 - r - 3;   // bottom-right corner in container-local space
    const cy  = this.cs / 2 - r - 3;
    this.cooldownRing.clear();
    // Background circle — soft brown track on the bright field.
    this.cooldownRing.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.6);
    this.cooldownRing.strokeCircle(cx, cy, r);
    // Progress arc (clockwise from top)
    if (pct > 0.02) {
      const start = Phaser.Math.DegToRad(-90);
      const end   = start + pct * Phaser.Math.PI2;
      const color = pct >= 0.95 ? CASUAL.GOLD : CASUAL.GOLD_DK;
      this.cooldownRing.lineStyle(2.5, color, 0.95);
      this.cooldownRing.beginPath();
      this.cooldownRing.arc(cx, cy, r, start, end, false);
      this.cooldownRing.strokePath();
    }
  }

  destroy(fromScene?: boolean): void {
    this.candleTween?.stop();
    this.selectionTween?.stop();
    this.waterTween?.stop();
    this.slotLoadoutTween?.stop();
    super.destroy(fromScene);
  }
}
