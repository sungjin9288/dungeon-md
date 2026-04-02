import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CELL_SIZE } from '../constants/layout';
import { ROOM_DEFS, type RoomData, type RoomType } from '../data/rooms';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import { drawRoomDecoration } from '../art/RoomDecorations';
import { loadGameState } from '../data/wisdom';

export type RoomState = 'empty' | 'occupied' | 'locked' | 'water';

export class Room extends Phaser.GameObjects.Container {
  state: RoomState;
  isSelected = false;
  roomData: RoomData | null = null;
  readonly row: number;
  readonly col: number;

  private bg: Phaser.GameObjects.Graphics;
  private outline: Phaser.GameObjects.Graphics;
  private candleGfx?: Phaser.GameObjects.Graphics;
  private candleTween?: Phaser.Tweens.Tween;
  private emptyLabel?: Phaser.GameObjects.Text;
  private selectionTween?: Phaser.Tweens.Tween;
  private levelBadge?:   Phaser.GameObjects.Graphics;
  private monsterBadge?: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  private roomTypeBadge?: Phaser.GameObjects.Text;

  private roomHpBar?: Phaser.GameObjects.Graphics;
  private roomHpValue = 0;
  private roomHpMax  = 0;
  private waterRipple?: Phaser.GameObjects.Graphics;
  private waterTween?: Phaser.Tweens.Tween;
  private isDestroyed = false;

  private readonly cs: number;   // effective cell size
  private readonly theme: DungeonTheme;

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
    this.theme = getActiveTheme(loadGameState().equippedTheme);

    this.bg = scene.add.graphics();
    this.drawStone();
    this.add(this.bg);

    this.outline = scene.add.graphics();
    this.add(this.outline);

    if (state === 'empty') this.addCandle(scene);
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
    const g = this.bg;
    const s = this.cs;
    const t = this.theme;
    const inset = 7;
    g.clear();
    if (this.state === 'water') return;

    // Outer cave rock frame
    g.fillStyle(t.stoneDark, 1);
    g.fillRect(-s / 2, -s / 2, s, s);

    // Inner cavity
    g.fillStyle(t.bgPrimary, 1);
    g.fillRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2);

    // Faint center gradient illusion
    const ci = inset + 10;
    g.fillStyle(t.stoneMid, 0.08);
    g.fillRect(-s / 2 + ci, -s / 2 + ci, s - ci * 2, s - ci * 2);

    // Rock edge highlights (subtle, organic)
    g.fillStyle(t.stoneLight, 0.06);
    g.fillRect(-s / 2, -s / 2, s, 3);
    g.fillRect(-s / 2, -s / 2, 3, s);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(-s / 2, s / 2 - 3, s, 3);
    g.fillRect(s / 2 - 3, -s / 2, 3, s);

    // Mineral deposit dots (replace gold rivets)
    const ro = 9;
    [[-s/2+ro, -s/2+ro], [s/2-ro, -s/2+ro], [-s/2+ro, s/2-ro], [s/2-ro, s/2-ro]].forEach(([cx, cy]) => {
      g.fillStyle(0x000000, 0.3); g.fillCircle(cx + 1, cy + 1, 2.5);
      g.fillStyle(t.glowColor, 0.6); g.fillCircle(cx, cy, 2.5);
      g.fillStyle(0xffffff, 0.15); g.fillCircle(cx - 0.5, cy - 0.5, 1);
    });

    // Occupied tint + room decoration
    if (this.state === 'occupied' && this.roomData) {
      const def = ROOM_DEFS[this.roomData.type];
      g.fillStyle(def.accentColor, 0.1);
      g.fillRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2);
      drawRoomDecoration(g, this.roomData.type, s, t);
    }
    if (this.state === 'locked') {
      g.fillStyle(0x000000, 0.55);
      g.fillRect(-s / 2, -s / 2, s, s);
    }
  }

  // ─── Candle ─────────────────────────────────────────────────────────────

  private addCandle(scene: Phaser.Scene): void {
    this.candleGfx = scene.add.graphics();
    this.drawCandle();
    this.add(this.candleGfx);

    this.emptyLabel = scene.add.text(0, 26, '방 추가', {
      fontFamily: "Georgia, serif", fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    this.add(this.emptyLabel);

    this.candleTween = scene.tweens.add({
      targets: this.candleGfx,
      scaleX: { from: 0.88, to: 1.12 }, scaleY: { from: 0.9, to: 1.1 },
      alpha:  { from: 0.5,  to: 0.75 },
      duration: Phaser.Math.Between(650, 1000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private drawCandle(): void {
    const g = this.candleGfx!;
    g.clear();
    g.fillStyle(0xd4c8a0, 0.85); g.fillRect(-4, 2, 8, 18);
    g.fillStyle(0xd4c8a0, 0.35); g.fillRect(-3, 18, 4, 5);
    g.fillStyle(COLORS.TORCH_GLOW, 0.9); g.fillTriangle(0, -15, -8, 3, 8, 3);
    g.fillStyle(0xffee44, 0.85);          g.fillTriangle(0, -8,  -4, 3, 4, 3);
  }

  // ─── Selection ──────────────────────────────────────────────────────────

  setHighlight(on: boolean): void {
    this.outline.clear();
    if (on) {
      this.outline.lineStyle(2, COLORS.TORCH_GOLD, 0.5);
      this.outline.strokeRect(-this.cs/2 + 2, -this.cs/2 + 2, this.cs - 4, this.cs - 4);
    }
  }

  select(): void {
    this.isSelected = true;
    this.outline.clear();
    this.outline.lineStyle(3, COLORS.TORCH_GOLD, 1);
    this.outline.strokeRect(-this.cs/2 + 2, -this.cs/2 + 2, this.cs - 4, this.cs - 4);
    this.selectionTween = this.scene.tweens.add({
      targets: this.outline, alpha: { from: 0.6, to: 1.0 },
      duration: 400, yoyo: true, repeat: -1,
    });
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
    this.roomHpValue = Math.max(0, this.roomHpValue - amount);
    this.drawRoomHpBar();
    if (this.roomHpValue <= 0) this.collapseRoom();
  }

  healRoomHp(amount: number): void {
    if (this.isDestroyed) return;
    this.roomHpValue = Math.min(this.roomHpMax, this.roomHpValue + amount);
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
    const g = this.roomHpBar;
    if (!g) return;
    g.clear();
    const s    = this.cs;
    const bw   = s - 16;
    const bh   = 4;
    const bx   = -bw / 2;
    const by   = s / 2 - 8;
    const pct  = this.roomHpMax > 0 ? this.roomHpValue / this.roomHpMax : 1;
    // Background
    g.fillStyle(0x000000, 0.6);
    g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    // Fill — green → yellow → red
    const col = pct > 0.6 ? 0x44cc44 : pct > 0.3 ? 0xddcc00 : 0xcc2200;
    g.fillStyle(col, 1);
    g.fillRect(bx, by, Math.round(bw * pct), bh);
    // Hide bar if full HP
    g.setAlpha(pct < 1 ? 1 : 0);
  }

  private collapseRoom(): void {
    this.isDestroyed = true;
    const s = this.cs;

    // Cave rubble overlay — dark crumbled rock
    const rubble = this.scene.add.graphics().setDepth(this.depth + 3);
    rubble.fillStyle(0x1a1e24, 0.92);
    rubble.fillRect(-s / 2, -s / 2, s, s);
    // Crack lines (cave-themed — jagged, not clean X)
    rubble.lineStyle(2, 0x8b0000, 0.9);
    rubble.lineBetween(-s / 2 + 10, -s / 2 + 6,  0,  8);
    rubble.lineBetween(0,  8,  s / 2 - 8,  -s / 2 + 14);
    rubble.lineBetween(0,  8,  -6,  s / 2 - 10);
    rubble.lineBetween(-6, s / 2 - 10,  s / 2 - 12,  s / 2 - 5);
    rubble.lineStyle(1, 0xff2222, 0.35);
    rubble.strokeRect(-s / 2, -s / 2, s, s);
    this.add(rubble);

    // Cave smoke particles — small circles drifting up
    const spawnSmoke = () => {
      if (!this.active) return;
      for (let i = 0; i < 3; i++) {
        const sx = this.x + (Math.random() - 0.5) * (s * 0.6);
        const sy = this.y + (Math.random() - 0.5) * (s * 0.3);
        const smoke = this.scene.add.graphics().setDepth(this.depth + 10);
        const r = 3 + Math.random() * 4;
        smoke.fillStyle(0x2a2a2a, 0.6);
        smoke.fillCircle(0, 0, r);
        smoke.setPosition(sx, sy);
        this.scene.tweens.add({
          targets: smoke,
          y: sy - 30 - Math.random() * 20,
          alpha: 0,
          scaleX: 1.8, scaleY: 1.8,
          duration: 700 + Math.random() * 500,
          ease: 'Quad.easeOut',
          onComplete: () => smoke.destroy(),
        });
      }
    };
    // Burst on collapse
    spawnSmoke();
    this.scene.time.delayedCall(300, spawnSmoke);
    this.scene.time.delayedCall(700, spawnSmoke);

    // Shake
    this.scene.tweens.add({
      targets: this, x: this.x - 4, y: this.y - 4,
      duration: 50, yoyo: true, repeat: 3,
      onComplete: () => { this.scene.events.emit('roomDestroyed', this.row, this.col); },
    });
  }

  // ─── Occupation ─────────────────────────────────────────────────────────

  occupyWith(type: RoomType): void {
    const def = ROOM_DEFS[type];

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
    const icon = this.scene.add.text(0, -14, def.emoji, { fontSize: '28px' }).setOrigin(0.5);
    this.add(icon);

    // Room name
    const nameLabel = this.scene.add.text(0, 24, def.koreanName, {
      fontFamily: "Georgia, serif", fontSize: '10px', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.add(nameLabel);

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

  upgrade(): void {
    if (!this.roomData || this.roomData.level > 3) return;
    // Level is already updated by caller; just refresh visuals
    this.drawLevelBadge();

    // Brief gold flash
    const flash = this.scene.add.graphics();
    flash.fillStyle(COLORS.TORCH_GOLD, 0.6);
    flash.fillRect(-this.cs / 2 + 7, -this.cs / 2 + 7, this.cs - 14, this.cs - 14);
    this.add(flash);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 350,
      onComplete: () => flash.destroy(),
    });
  }

  private drawLevelBadge(): void {
    const g = this.levelBadge!;
    g.clear();
    if (!this.roomData || this.roomData.level <= 1) return;
    const bx = this.cs / 2 - 14;
    const by = -this.cs / 2 + 6;
    const r  = 8;
    const col = this.roomData.level === 3 ? COLORS.TORCH_GOLD : 0xa8a8c0;
    g.fillStyle(COLORS.BLACK, 0.7); g.fillCircle(bx + 1, by + 1, r);
    g.fillStyle(col, 1);            g.fillCircle(bx, by, r);
    g.lineStyle(1, 0xffffff, 0.25); g.strokeCircle(bx, by, r);
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

  setRoomTypeBadge(icon: string | null): void {
    this.roomTypeBadge?.destroy();
    this.roomTypeBadge = undefined;
    if (!icon) return;
    this.roomTypeBadge = this.scene.add.text(
      -this.cs / 2 + 4, -this.cs / 2 + 2, icon, { fontSize: '11px' },
    ).setOrigin(0, 0).setAlpha(0.85);
    this.add(this.roomTypeBadge);
  }

  setBrokenState(): void {
    const s  = this.cs;

    // Dark cave rubble fill
    const cg = this.scene.add.graphics();
    cg.fillStyle(0x1a0000, 0.5);
    cg.fillRect(-s / 2, -s / 2, s, s);

    // Jagged crack pattern
    cg.lineStyle(2, 0xff2222, 0.8);
    cg.lineBetween(-s / 2 + 18, -s / 2 + 8,  -4,  4);
    cg.lineBetween(-4,  4,  10, -s / 2 + 12);
    cg.lineBetween(-4,  4,  -8,  s / 2 - 12);
    cg.lineBetween(-8,  s / 2 - 12,  s / 2 - 14,  s / 2 - 6);
    cg.lineStyle(1, 0xff0000, 0.45);
    cg.strokeRect(-s / 2, -s / 2, s, s);
    this.add(cg);

    // Pulsing red glow border
    const glow = this.scene.add.graphics();
    glow.lineStyle(3, 0xff0000, 0.7);
    glow.strokeRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
    this.add(glow);
    this.scene.tweens.add({
      targets: glow, alpha: { from: 0.8, to: 0.15 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.add(this.scene.add.text(0, s / 2 - 10, '파손', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ff6666',
      backgroundColor: '#1a0000', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1));
  }

  flashAttack(): void {
    this.scene.tweens.add({
      targets: this.bg, alpha: { from: 1, to: 0.3 },
      duration: 80, yoyo: true, repeat: 2,
    });
  }

  private drawWaterCell(scene: Phaser.Scene): void {
    // Dark water background
    const s  = this.cs;
    const wg = scene.add.graphics().setDepth(this.depth + 1);
    wg.fillStyle(0x001440, 1);
    wg.fillRect(-s / 2, -s / 2, s, s);
    // Animated ripple
    this.waterRipple = scene.add.graphics().setDepth(this.depth + 2);
    this.add(wg);
    this.add(this.waterRipple);
    // Use a scene update interval via tweens
    scene.tweens.add({
      targets: { t: 0 }, t: Math.PI * 2,
      duration: 2000, repeat: -1, ease: 'Linear',
      onUpdate: (tween) => {
        if (!this.waterRipple || !this.active) return;
        this.waterRipple.clear();
        const t = tween.getValue() as number;
        // Draw 3 sine-wave lines
        this.waterRipple.lineStyle(1.5, 0x0066cc, 0.5);
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
    // Disable interaction for water cells
    this.removeInteractive();
  }

  destroy(fromScene?: boolean): void {
    this.candleTween?.stop();
    this.selectionTween?.stop();
    this.waterTween?.stop();
    super.destroy(fromScene);
  }
}
