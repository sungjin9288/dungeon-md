// ─── DM titles ────────────────────────────────────────────────────────────────
// Maps an unlockedFeatures key → display label + color. The Home top bar shows
// the highest earned title. Add new entries here as chapters / events release.

export const DM_TITLE_MAP: Readonly<Record<string, { readonly label: string; readonly color: string }>> = {
  abyss_title:   { label: '원초의 심연 정복자', color: '#cc88ff' },
  heaven_title:  { label: '신계 정복자',         color: '#aaddff' },
  volcano_title: { label: '화염 산맥의 영웅',     color: '#ff9944' },
};

/** Priority order — first match wins (highest prestige first). */
export const DM_TITLE_PRIORITY = ['abyss_title', 'heaven_title', 'volcano_title'] as const;

/**
 * Reward-row text for a quest unlock, or null when the unlock has no effect
 * yet. Only titles are read by the game; other ids are recorded and unused, so
 * advertising them (raw, at that) promised nothing.
 */
export function questUnlockLabel(unlockId: string): string | null {
  const title = DM_TITLE_MAP[unlockId];
  return title ? `칭호 · ${title.label}` : null;
}
