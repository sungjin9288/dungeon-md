import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { INVADER_DEFS, type InvaderType } from '../data/invaders';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { getMonsterSpriteData, drawMonsterSprite } from '../art/PixelMonsters';
import { getInvaderSpriteData } from '../art/PixelInvaders';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    // Phaser 3.90 loader stalls when maxParallelDownloads (default 32) matches
    // the number of simultaneously-completing files — set high to avoid the deadlock.
    this.load.maxParallelDownloads = 200;

    // Loading bar
    const barBg = this.add.graphics();
    barBg.fillStyle(COLORS.STONE_DARK, 1);
    barBg.fillRoundedRect(CANVAS_WIDTH / 2 - 150, 410, 300, 14, 4);

    const barFill = this.add.graphics();

    this.add.text(CANVAS_WIDTH / 2, 398, '던전 수호자', {
      fontFamily: "Georgia, serif",
      fontSize: '28px',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 1);

    this.add.text(CANVAS_WIDTH / 2, 434, '던전 불러오는 중...', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CSS.PARCHMENT_MUTED,
      letterSpacing: 3,
    }).setOrigin(0.5, 0);

    this.load.on('progress', (v: number) => {
      barFill.clear();
      barFill.fillStyle(COLORS.TORCH_GOLD, 1);
      barFill.fillRoundedRect(CANVAS_WIDTH / 2 - 149, 411, Math.floor(298 * v), 12, 3);
    });

    // Invaders are now procedural pixel art (see PixelInvaders.ts) — no AI
    // invader sprites to preload.

    // Load AI-generated monster portraits (Ch1-5 pre-loaded; Ch6+ loaded lazily)
    // Ch7 assets are NOT pre-loaded here — large files caused loader deadlock
    // (inflight=0 / list>0 stall in Phaser 3.90). They use procedural fallback.
    const monsterIds = [
      // Ch1–5
      'dokkaebi_warrior','dokkaebi_junior','village_archer','gold_turtle','fire_dokkaebi','sage',
      'gumiho_guardian','frost_spirit','white_tiger','sea_god_spear','fox_shaman','iron_mask',
      'death_messenger','thunder_hero','ghost_hunter','mask_dancer','venom_warrior',
      'celestial_dancer','three_legged_crow','great_serpent','moon_rabbit_sage',
      'mountain_god','volcanic_warrior','storm_archer','abyss_mage','celestial_healer',
      'mask_berserker','sea_dragon_lord','fox_spirit_elder',
    ];
    monsterIds.forEach(id => {
      this.load.image(`monster-ai-${id}`, `/assets/monsters/${id}.jpg`);
    });

    // Fail-safe: if loader somehow stalls, force-complete after 8 s
    this.load.once('complete', () => { /* normal path */ });
    this.time.delayedCall(8000, () => {
      if (this.sys.settings.status === 3 /* LOADING */) {
        this.load.emit('complete');
      }
    });
  }

  create(): void {
    this.generateTextures();
    this.generateMonsterTextures();

    this.scene.start('DungeonHomeScene');
  }

  private generateTextures(): void {
    // Ember particle
    const ember = this.make.graphics({ x: 0, y: 0 }, false);
    ember.fillStyle(COLORS.TORCH_GLOW, 1);
    ember.fillCircle(3, 3, 3);
    ember.generateTexture('ember', 7, 7);
    ember.destroy();

    // Dust mote
    const dust = this.make.graphics({ x: 0, y: 0 }, false);
    dust.fillStyle(COLORS.PARCHMENT, 1);
    dust.fillCircle(2, 2, 2);
    dust.generateTexture('dust', 5, 5);
    dust.destroy();

    // Invader textures: procedural pixel-art sprites (24×24 grid, baked at 2×),
    // matching the player monsters' pixel style so the whole battle is cohesive.
    const allInvaderTypes = Object.keys(INVADER_DEFS) as InvaderType[];
    const INV_PX = 2;   // bake scale → 48×48 texture, NEAREST-filtered for crisp pixels
    allInvaderTypes.forEach((type) => {
      const finalKey = `invader-${type}`;
      if (this.textures.exists(finalKey)) this.textures.remove(finalKey);
      const data = getInvaderSpriteData(type);
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      drawMonsterSprite(g, data, INV_PX);
      g.generateTexture(finalKey, 24 * INV_PX, 24 * INV_PX);
      g.destroy();
      this.textures.get(finalKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
  }

  /** Generate 24x24 pixel-art textures for Ch1-5 monsters.
   *  Ch6 monsters are generated lazily on first access via getMonsterTexture(). */
  private generateMonsterTextures(): void {
    const ch6Start = 6;
    for (const [id, def] of Object.entries(MONSTER_DEFS)) {
      // Skip Ch6 (lazy generated later)
      if ((def.chapter ?? 1) >= ch6Start) continue;
      this.createMonsterTexture(id as MonsterId, def);
    }
  }

  private createMonsterTexture(id: MonsterId, def: typeof MONSTER_DEFS[MonsterId]): void {
    const data = getMonsterSpriteData(id, def.tribe, def.type, def.rarityTier);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    drawMonsterSprite(g, data, 1);
    g.generateTexture(`monster-${id}`, 24, 24);
    g.destroy();
  }
}
