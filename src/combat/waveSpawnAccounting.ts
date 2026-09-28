export interface DynamicSpawnAccountingContext {
  waveInvaderTotal: number;
  readonly killsThisWave: number;
  readonly killCounterText?: { setText(text: string): unknown };
}

/** Keep the wave HUD denominator aligned with invaders summoned at runtime. */
export function registerDynamicSpawn(ctx: DynamicSpawnAccountingContext): void {
  ctx.waveInvaderTotal += 1;
  ctx.killCounterText?.setText(`💀 ${ctx.killsThisWave} / ${ctx.waveInvaderTotal}`);
}

/**
 * HUD "잔여" count after `leaving` departs (killed or reached the heart). A
 * killed invader stays `active` through its death animation, so it must be
 * excluded explicitly.
 */
export function remainingInvaderCount(
  invaders: readonly { readonly active: boolean }[],
  leaving: { readonly active: boolean },
): number {
  return invaders.filter(invader => invader !== leaving && invader.active).length;
}
