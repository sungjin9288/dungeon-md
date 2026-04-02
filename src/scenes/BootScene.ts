import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH } from '../constants/layout';
import { INVADER_DEFS, type InvaderType } from '../data/invaders';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { getMonsterSpriteData, drawMonsterSprite } from '../art/PixelMonsters';
import { drawInvaderShape } from '../art/InvaderShapes';
import { loadGameState } from '../data/wisdom';
import { getCinematic } from '../data/cinematics';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
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

    // Load AI-generated invader sprites
    const invaderTypes = Object.keys(INVADER_DEFS) as InvaderType[];
    invaderTypes.forEach(type => {
      this.load.image(`invader-ai-${type}`, `/assets/invaders/${type}.jpg`);
    });

    // Load AI-generated monster portraits (Ch1-5 pre-loaded; Ch6 loaded lazily)
    const monsterIds = [
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
  }

  create(): void {
    this.generateTextures();
    this.generateMonsterTextures();

    // First launch: show prologue cinematic before home screen
    const gs = loadGameState();
    const isFirstLaunch = !gs.cinematicSeen || gs.cinematicSeen.length === 0;
    if (isFirstLaunch && getCinematic('ch1_opening')) {
      this.scene.start('CinematicScene', {
        cinematicId: 'ch1_opening',
        nextScene: 'DungeonHomeScene',
      });
    } else {
      this.scene.start('DungeonHomeScene');
    }
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

    // Invader textures: use AI sprites if available, else procedural fallback
    const allInvaderTypes = Object.keys(INVADER_DEFS) as InvaderType[];
    allInvaderTypes.forEach((type) => {
      const def = INVADER_DEFS[type];
      const r   = def.radius;
      const aiKey = `invader-ai-${type}`;

      const finalKey = `invader-${type}`;
      let aiProcessed = false;
      if (this.textures.exists(aiKey)) {
        try {
          const src = this.textures.get(aiKey).getSourceImage() as HTMLImageElement;
          if (src && (src as HTMLImageElement).naturalWidth > 0) {
            const SIZE = 128;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(src, 0, 0, SIZE, SIZE);
            const id = ctx.getImageData(0, 0, SIZE, SIZE);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i] > 215 && d[i + 1] > 215 && d[i + 2] > 215) d[i + 3] = 0;
            }
            ctx.putImageData(id, 0, 0);
            if (this.textures.exists(finalKey)) this.textures.remove(finalKey);
            this.textures.addCanvas(finalKey, canvas);
            aiProcessed = true;
          }
        } catch (_) { /* fall through to procedural */ }
      }
      if (!aiProcessed) {
        // Fallback: procedural chibi shape
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        drawInvaderShape(g, type, def);
        g.generateTexture(finalKey, r * 2, r * 2);
        g.destroy();
      }
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
