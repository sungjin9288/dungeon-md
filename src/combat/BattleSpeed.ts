// ─── Battle speed ─────────────────────────────────────────────────────────────
// Phaser keeps two independent clocks — `scene.time` (timers, cooldowns) and
// `scene.tweens` (movement, VFX). Every battle-speed change must move both or
// the two drift apart: a 3× battle whose tweens sit at 1× has invaders crawling
// between full-speed attacks. This module is the only place that writes them,
// so setSpeed / pause / per-battle reset / the boss slow-mo all agree.

/** The pieces of a Phaser scene this module touches — keeps it unit-testable. */
export interface BattleClocks {
  readonly time: { timeScale: number };
  readonly tweens: { timeScale: number };
}

export const BATTLE_PAUSED_SCALE = 0;

export function applyBattleSpeed(scene: BattleClocks, scale: number): void {
  scene.time.timeScale = scale;
  scene.tweens.timeScale = scale;
}
