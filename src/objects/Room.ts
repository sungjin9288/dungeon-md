import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CELL_SIZE } from '../constants/layout';
import { ROOM_DEFS, type RoomData, type RoomType } from '../data/rooms';
import { getActiveTheme, type DungeonTheme } from '../themes/themes';
import { drawRoomDecoration } from '../art/RoomDecorations';
import { loadGameState } from '../data/wisdom';

export type RoomState = 'empty' | 'occupied' | 'locked' | 'water';

export interface RoomLoadoutVisualOptions {
  readonly roomTypeIcon: string;
  readonly roomTypeName: string;
  readonly accentColor: number;
  readonly primaryMonsterEmoji?: string | null;
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
  private slotLoadoutGfx?: Phaser.GameObjects.Graphics;
  private slotLoadoutLabels: Phaser.GameObjects.Text[] = [];

  private roomHpBar?: Phaser.GameObjects.Graphics;
  private roomHpValue = 0;
  private roomHpMax  = 0;
  private damageFlash?: Phaser.GameObjects.Graphics;
  private hpCriticalTween?: Phaser.Tweens.Tween;
  private cooldownRing?: Phaser.GameObjects.Graphics;
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

  setInitialRoomLevel(level: number): void {
    if (!this.roomData) return;
    this.roomData.level = Phaser.Math.Clamp(Math.round(level), 1, 3);
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
    this.clearDungeonSlotLoadoutVisual();
    if (this.state !== 'occupied') return;

    const s = this.cs;
    const accent = options.accentColor;
    const accentCSS = `#${accent.toString(16).padStart(6, '0')}`;
    const g = this.scene.add.graphics();
    this.slotLoadoutGfx = g;
    this.add(g);

    const chamberX = -s / 2 + 12;
    const chamberY = -s / 2 + 25;
    const chamberW = s - 24;
    const chamberH = s - 54;
    const floorY = chamberY + chamberH - 13;

    g.fillStyle(0x03070c, 0.86);
    g.fillRoundedRect(chamberX, chamberY, chamberW, chamberH, 7);
    g.lineStyle(1, accent, 0.28);
    g.strokeRoundedRect(chamberX, chamberY, chamberW, chamberH, 7);

    g.fillStyle(0x122336, 0.52);
    g.fillRoundedRect(chamberX + 5, chamberY + 5, chamberW - 10, chamberH * 0.42, 5);
    g.fillStyle(accent, 0.08);
    g.fillRect(chamberX + 7, chamberY + 7, chamberW - 14, Math.max(4, chamberH * 0.18));
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(chamberX + 8, chamberY + 15, chamberX + chamberW - 8, chamberY + 15);

    g.fillStyle(0x0b121a, 0.92);
    g.fillPoints([
      new Phaser.Geom.Point(chamberX + 7, floorY),
      new Phaser.Geom.Point(chamberX + chamberW - 7, floorY),
      new Phaser.Geom.Point(chamberX + chamberW - 3, chamberY + chamberH - 4),
      new Phaser.Geom.Point(chamberX + 3, chamberY + chamberH - 4),
    ], true);
    g.lineStyle(1, accent, 0.18);
    g.lineBetween(chamberX + 8, floorY, chamberX + chamberW - 8, floorY);
    g.lineStyle(1, 0x000000, 0.28);
    g.lineBetween(chamberX + 14, floorY + 5, chamberX + chamberW - 14, floorY + 5);

    const hasGuardian = options.monsterCount > 0;
    const centerY = chamberY + chamberH * 0.52;
    g.fillStyle(0x000000, 0.42);
    g.fillEllipse(0, floorY + 3, 36, 9);
    g.fillStyle(hasGuardian ? accent : 0x27394c, hasGuardian ? 0.24 : 0.14);
    g.fillEllipse(0, floorY + 1, 31, 7);
    g.fillStyle(0x1a2430, 0.96);
    g.fillRoundedRect(-16, centerY + 10, 32, 7, 4);
    g.lineStyle(1, accent, hasGuardian ? 0.42 : 0.18);
    g.strokeRoundedRect(-16, centerY + 10, 32, 7, 4);

    if (options.equipmentCount > 0) {
      g.lineStyle(2, 0xe8c468, 0.34);
      g.strokeCircle(0, centerY + 3, 18);
      g.lineStyle(1, 0xfff0b0, 0.24);
      g.strokeCircle(0, centerY + 3, 22);
      g.fillStyle(0xe8c468, 0.72);
      g.fillCircle(-19, centerY - 6, 1.8);
      g.fillCircle(19, centerY + 7, 1.6);
      g.fillCircle(8, centerY - 17, 1.5);
    }

    const trapFixtures = Math.min(4, options.trapCount);
    for (let i = 0; i < trapFixtures; i++) {
      const fixtureX = chamberX + 10 + i * ((chamberW - 20) / Math.max(1, trapFixtures - 1));
      g.fillStyle(0x5fb854, 0.2);
      g.fillCircle(fixtureX, floorY + 2, 5);
      g.fillStyle(0x5fb854, 0.78);
      g.fillTriangle(fixtureX - 4, floorY + 5, fixtureX, floorY - 6, fixtureX + 4, floorY + 5);
      g.lineStyle(1, 0xcaffde, 0.36);
      g.lineBetween(fixtureX - 5, floorY + 5, fixtureX + 5, floorY + 5);
    }

    g.lineStyle(2, accent, 0.34);
    g.strokeRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10);
    g.fillStyle(accent, 0.22);
    g.fillRoundedRect(-s / 2 + 17, -s / 2 + 8, s - 34, 14, 5);
    g.lineStyle(1, 0xffffff, 0.16);
    g.strokeRoundedRect(-s / 2 + 17, -s / 2 + 8, s - 34, 14, 5);

    const title = this.scene.add.text(0, -s / 2 + 15, `${options.roomTypeIcon} ${options.roomTypeName}`, {
      fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
      fontSize: '8px',
      color: '#f0e6c8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.slotLoadoutLabels.push(title);
    this.add(title);

    const guardianGlyph = options.primaryMonsterEmoji ?? (hasGuardian ? '👾' : '◇');
    const guardian = this.scene.add.text(0, centerY + (hasGuardian ? -1 : 0), guardianGlyph, {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif',
      fontSize: hasGuardian ? '25px' : '15px',
      color: hasGuardian ? '#ffffff' : '#47647b',
      stroke: '#05080c',
      strokeThickness: hasGuardian ? 3 : 1,
    }).setOrigin(0.5);
    this.slotLoadoutLabels.push(guardian);
    this.add(guardian);

    if (options.monsterCount > 1) {
      g.fillStyle(0xff8a45, 0.9);
      g.fillRoundedRect(10, centerY - 17, 18, 11, 4);
      g.lineStyle(1, 0xfff0cc, 0.45);
      g.strokeRoundedRect(10, centerY - 17, 18, 11, 4);
      const count = this.scene.add.text(19, centerY - 11.5, `x${options.monsterCount}`, {
        fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
        fontSize: '7px',
        color: '#f0e6c8',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.slotLoadoutLabels.push(count);
      this.add(count);
    }

    const stripY = s / 2 - 26;
    g.fillStyle(0x140c03, 0.78);
    g.fillRoundedRect(-s / 2 + 11, stripY, s - 22, 14, 5);
    g.lineStyle(1, accent, 0.28);
    g.strokeRoundedRect(-s / 2 + 11, stripY, s - 22, 14, 5);

    const drawPips = (startX: number, y: number, count: number, cap: number, fill: number): void => {
      const safeCap = Math.max(1, Math.min(5, cap));
      for (let i = 0; i < safeCap; i++) {
        g.fillStyle(i < count ? fill : 0x132332, i < count ? 0.95 : 0.9);
        g.fillCircle(startX + i * 6, y, 2.2);
        g.lineStyle(0.6, i < count ? fill : accent, i < count ? 0.55 : 0.22);
        g.strokeCircle(startX + i * 6, y, 2.2);
      }
    };

    drawPips(-s / 2 + 21, stripY + 7, options.monsterCount, options.monsterCapacity, 0xff8a45);
    drawPips(s / 2 - 21 - Math.max(0, Math.min(5, options.trapCapacity) - 1) * 6, stripY + 7, options.trapCount, options.trapCapacity, 0x5fb854);

    if (options.equipmentCount > 0) {
      g.fillStyle(0xe8c468, 0.2);
      g.fillRoundedRect(-s / 2 + 13, stripY - 17, 28, 12, 4);
      g.lineStyle(1, 0xe8c468, 0.5);
      g.strokeRoundedRect(-s / 2 + 13, stripY - 17, 28, 12, 4);
      const equipment = this.scene.add.text(-s / 2 + 27, stripY - 11, `⚙${options.equipmentCount}`, {
        fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
        fontSize: '7px',
        color: '#ffe6a3',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.slotLoadoutLabels.push(equipment);
      this.add(equipment);
    }

    const loadoutLabel = options.equipmentCount > 0
      ? `M${options.monsterCount}/${options.monsterCapacity} E${options.equipmentCount} T${options.trapCount}/${options.trapCapacity}`
      : `M${options.monsterCount}/${options.monsterCapacity} T${options.trapCount}/${options.trapCapacity}`;
    const loadout = this.scene.add.text(0, stripY + 7, loadoutLabel, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: accentCSS,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.slotLoadoutLabels.push(loadout);
    this.add(loadout);
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
    this._flashDamage();
    if (this.roomHpValue <= 0) this.collapseRoom();
  }

  private _flashDamage(): void {
    // Reuse existing graphic to avoid stacking
    if (!this.damageFlash) {
      this.damageFlash = this.scene.add.graphics();
      this.add(this.damageFlash);
    }
    const s = this.cs;
    this.damageFlash.clear();
    this.damageFlash.fillStyle(0xff2222, 0.55);
    this.damageFlash.fillRect(-s / 2, -s / 2, s, s);
    this.damageFlash.setDepth(this.depth + 4).setAlpha(1);
    this.scene.tweens.add({
      targets: this.damageFlash,
      alpha: 0,
      duration: 280,
      ease: 'Power2.easeOut',
    });
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

    // Critical HP pulse: start tween when ≤30%, stop when recovered
    if (pct <= 0.3 && pct > 0 && !this.hpCriticalTween) {
      this.hpCriticalTween = this.scene.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0.25 },
        duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if ((pct > 0.3 || pct <= 0) && this.hpCriticalTween) {
      this.hpCriticalTween.stop();
      this.hpCriticalTween = undefined;
      g.setAlpha(pct < 1 ? 1 : 0);
    }
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

    // Scale bounce: pop to 1.18 then settle
    this.scene.tweens.add({
      targets: this, scaleX: 1.18, scaleY: 1.18,
      duration: 140, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeIn',
        });
      },
    });

    // Star burst: 6 golden ★ flying outward
    const angles = [0, 60, 120, 180, 240, 300];
    for (const deg of angles) {
      const rad  = (deg * Math.PI) / 180;
      const dist = this.cs * 0.7;
      const star = this.scene.add.text(this.x, this.y, '★', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#ffee44',
      }).setOrigin(0.5).setDepth(200).setAlpha(1);
      this.scene.tweens.add({
        targets: star,
        x: this.x + Math.cos(rad) * dist,
        y: this.y + Math.sin(rad) * dist,
        alpha: 0, scaleX: 0.5, scaleY: 0.5,
        duration: 480, ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }
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

  private clearDungeonSlotLoadoutVisual(): void {
    this.slotLoadoutGfx?.destroy();
    this.slotLoadoutGfx = undefined;
    this.slotLoadoutLabels.forEach(label => label.destroy());
    this.slotLoadoutLabels = [];
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

  /** Called from DungeonScene.update() during waves to draw a circular progress ring. */
  updateAttackCooldown(now: number): void {
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
    const pct = Math.min(1, (now - data.lastAttackTime) / data.attackCooldown);
    const r   = 6;
    const cx  = this.cs / 2 - r - 3;   // bottom-right corner in container-local space
    const cy  = this.cs / 2 - r - 3;
    this.cooldownRing.clear();
    // Background circle
    this.cooldownRing.lineStyle(1.5, 0x222222, 0.55);
    this.cooldownRing.strokeCircle(cx, cy, r);
    // Progress arc (clockwise from top)
    if (pct > 0.02) {
      const start = Phaser.Math.DegToRad(-90);
      const end   = start + pct * Phaser.Math.PI2;
      const color = pct >= 0.95 ? 0xffdd44 : 0xaa6622;
      this.cooldownRing.lineStyle(2.5, color, 0.9);
      this.cooldownRing.beginPath();
      this.cooldownRing.arc(cx, cy, r, start, end, false);
      this.cooldownRing.strokePath();
    }
  }

  destroy(fromScene?: boolean): void {
    this.candleTween?.stop();
    this.selectionTween?.stop();
    this.waterTween?.stop();
    super.destroy(fromScene);
  }
}
