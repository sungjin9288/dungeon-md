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
