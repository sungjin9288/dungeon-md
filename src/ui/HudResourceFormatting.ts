const KOREAN_COMPACT_NUMBER = new Intl.NumberFormat('ko-KR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatHudResourceValue(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (safeValue < 10_000) return safeValue.toLocaleString('ko-KR');
  return KOREAN_COMPACT_NUMBER.format(safeValue);
}
