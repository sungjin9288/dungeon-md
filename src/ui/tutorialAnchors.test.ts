import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
const { TUTORIAL_STEPS, resolveTutorialStep, TUTORIAL_CARD } = await import('./TutorialOverlay');

// The steps carried fixed rectangles from an older Home layout: step 2 cut the
// first room card in half, step 3 pointed at a "퀘스트 패널 · 방어 버튼" that no
// longer exists and crossed the primary CTA. Steps now resolve against the
// live Home geometry.
const anchors = {
  'room-row':     { x: 8, y: 132, w: 372, h: 131 },
  'first-room':   { x: 8, y: 132, w: 120, h: 131 },
  'command-deck': { x: 8, y: 602, w: 374, h: 142 },
  'invasion-tab': { x: 292.5, y: 780, w: 97.5, h: 64 },
  'invasion-alert': { x: 234, y: 44, w: 132, h: 52 },
};
const contains = (outer: { x: number; y: number; w: number; h: number }, inner: typeof outer) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('tutorial steps follow the live Home layout', () => {
  it.each(TUTORIAL_STEPS.map(step => [step.stage, step] as const))('step %d highlights its whole anchor', (_stage, step) => {
    const resolved = resolveTutorialStep(step, anchors);
    expect(step.anchor).toBeDefined();
    expect(contains(resolved.highlight!, anchors[step.anchor!])).toBe(true);
  });

  it.each(TUTORIAL_STEPS.map(step => [step.stage, step] as const))('step %d card never covers its highlight', (_stage, step) => {
    const resolved = resolveTutorialStep(step, anchors);
    const cardY = TUTORIAL_CARD.cardY(resolved.highlight);
    const card = { x: (390 - TUTORIAL_CARD.w) / 2, y: cardY, w: TUTORIAL_CARD.w, h: TUTORIAL_CARD.h };
    expect(overlaps(card, resolved.highlight!)).toBe(false);
  });

  it('describes the real first-battle route, not the removed quest panel', () => {
    const battle = TUTORIAL_STEPS.find(step => step.anchor === 'command-deck')!;
    expect(battle.body).not.toContain('퀘스트 패널');
    expect(battle.body).toContain('방어 준비');
  });

  it('step 3 can point at the invasion alert instead (it says to start from the alert up top)', () => {
    const battle = TUTORIAL_STEPS.find(step => step.stage === 3)!;
    const resolved = resolveTutorialStep({ ...battle, anchor: 'invasion-alert' }, anchors);
    expect(contains(resolved.highlight!, anchors['invasion-alert'])).toBe(true);
    const card = { x: (390 - TUTORIAL_CARD.w) / 2, y: TUTORIAL_CARD.cardY(resolved.highlight), w: TUTORIAL_CARD.w, h: TUTORIAL_CARD.h };
    expect(overlaps(card, resolved.highlight!)).toBe(false);
  });

  it('keeps the authored rectangle when an anchor is unavailable', () => {
    const step = TUTORIAL_STEPS[0];
    expect(resolveTutorialStep(step, {}).highlight).toEqual(step.highlight);
  });
});
