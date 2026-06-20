/**
 * SceneAtmosphere.ts — reusable "premium" atmosphere layer for any scene.
 *
 * Management-game polish gap #1 is flat, lifeless backgrounds. This adds three
 * cheap, baked-once layers that sit BETWEEN the background (depth -10) and the
 * content (depth ≥ 0), so they enrich the scene without dimming the UI:
 *   • warm top-down torch glow (ADD blend) — "lit from above" depth
 *   • drifting embers / dust motes (reduced-motion gated) — life
 *   • soft edge vignette — frames the screen, focuses the eye
 *
 * All textures are baked on first use (Canvas2D) and shared across scenes.
 * Pure rendering — no input, no game state.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { getReducedMotion } from '../utils/reducedMotion';

const VIGNETTE_KEY = 'atmo-vignette';
const GLOW_KEY     = 'atmo-glow';
const MOTE_KEY     = 'atmo-mote';

function bakeTextures(scene: Phaser.Scene): void {
  const W = CANVAS_WIDTH, H = CANVAS_HEIGHT;

  if (!scene.textures.exists(VIGNETTE_KEY)) {
    const tex = scene.textures.createCanvas(VIGNETTE_KEY, W, H);
    const ctx = tex?.context;
    if (tex && ctx) {
      const g = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.30, W / 2, H * 0.5, Math.max(W, H) * 0.66);
      g.addColorStop(0,    'rgba(0,0,0,0)');
      g.addColorStop(0.72, 'rgba(8,4,2,0.14)');
      g.addColorStop(1,    'rgba(4,2,1,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      tex.refresh();
    }
  }

  if (!scene.textures.exists(GLOW_KEY)) {
    const tex = scene.textures.createCanvas(GLOW_KEY, W, H);
    const ctx = tex?.context;
    if (tex && ctx) {
      // Warm torch glow pooling from above the top edge.
      const g = ctx.createRadialGradient(W / 2, -H * 0.08, 40, W / 2, -H * 0.08, H * 0.9);
      g.addColorStop(0,   'rgba(255,170,72,0.22)');
      g.addColorStop(0.5, 'rgba(255,140,50,0.07)');
      g.addColorStop(1,   'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      tex.refresh();
    }
  }

  if (!scene.textures.exists(MOTE_KEY)) {
    const S = 16;
    const tex = scene.textures.createCanvas(MOTE_KEY, S, S);
    const ctx = tex?.context;
    if (tex && ctx) {
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0,   'rgba(255,232,184,1)');
      g.addColorStop(0.4, 'rgba(255,208,140,0.55)');
      g.addColorStop(1,   'rgba(255,196,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.fill();
      tex.refresh();
    }
  }
}

export interface AtmosphereOptions {
  glow?:    boolean;   // warm top torch glow (default true)
  embers?:  boolean;   // drifting ember/dust motes (default true)
  vignette?: boolean;  // soft edge vignette (default true)
  /** Base depth; the three layers occupy [base-2, base] so they stay below content. */
  baseDepth?: number;  // default -4 (above background -10, below content ≥ 0)
}

/**
 * Adds the atmosphere layers to a scene. Call once in create() after the
 * background is drawn. Safe on any scene; respects reduced-motion for embers.
 */
export function addSceneAtmosphere(scene: Phaser.Scene, opts: AtmosphereOptions = {}): void {
  bakeTextures(scene);
  const base = opts.baseDepth ?? -4;

  if (opts.glow !== false) {
    scene.add.image(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, GLOW_KEY)
      .setScrollFactor(0)
      .setDepth(base - 2)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  if (opts.embers !== false && !getReducedMotion()) {
    const emitter = scene.add.particles(0, 0, MOTE_KEY, {
      x: { min: 0, max: CANVAS_WIDTH },
      y: CANVAS_HEIGHT + 12,
      lifespan: 9000,
      speedY: { min: -24, max: -10 },
      speedX: { min: -7, max: 7 },
      scale:  { min: 0.16, max: 0.5 },
      alpha:  { start: 0.55, end: 0 },
      frequency: 520,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setScrollFactor(0).setDepth(base - 1);
  }

  if (opts.vignette !== false) {
    scene.add.image(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, VIGNETTE_KEY)
      .setScrollFactor(0)
      .setDepth(base);
  }
}
