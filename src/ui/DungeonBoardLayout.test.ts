import { describe, expect, it } from 'vitest';
import { buildDungeonBoardLayout } from './DungeonBoardLayout';

describe('DungeonBoardLayout — vertical cutaway', () => {
  it('reveals outer-wall chambers before filling the centre shaft', () => {
    const layout = buildDungeonBoardLayout({
      unlockedSlots: 1,
      totalSlots: 9,
      regionTop: 96,
      regionBottom: 594,
      canvasWidth: 390,
      mode: 'vertical-cutaway',
    });

    const first = layout.cellsByIdx.get(0);
    const next = layout.cellsByIdx.get(1);
    const centre = layout.cellsByIdx.get(2);

    expect(first?.colInFloor).toBe(0);
    expect(next?.colInFloor).toBe(2);
    expect(centre?.colInFloor).toBe(1);
    expect(first?.rect.x).toBeLessThan(centre?.rect.x ?? 0);
    expect(next?.rect.x).toBeGreaterThan(centre?.rect.x ?? 0);
    expect(layout.route).toEqual([0]);
  });
});

describe('corridor 모드 (가로 단면도)', () => {
  const layout = buildDungeonBoardLayout({
    unlockedSlots: 0, totalSlots: 0, regionTop: 96, regionBottom: 430, canvasWidth: 390, mode: 'corridor',
    plan: { corridor: [2, 0, 1], sides: [{ slot: 3, anchor: 1, side: 'up' }] },
  });

  it('주 통로는 가운데 띠에 입구 쪽부터 순서대로, 곁방은 붙은 방의 바로 위', () => {
    const [a, b, c] = [layout.cellsByIdx.get(2)!, layout.cellsByIdx.get(0)!, layout.cellsByIdx.get(1)!];
    expect([a.floor, b.floor, c.floor]).toEqual([1, 1, 1]);
    expect(a.center.x).toBeLessThan(b.center.x);
    expect(b.center.x).toBeLessThan(c.center.x);
    const side = layout.cellsByIdx.get(3)!;
    expect(side.floor).toBe(0);
    expect(side.center.x).toBe(b.center.x);
    expect(layout.route).toEqual([2, 0, 1]);
  });

  it('입구(왼쪽) → 주 통로 → 심장부(오른쪽) 경로, 심장부는 굴착 자리 뒤', () => {
    const xs = layout.routePolyline.map(p => p.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    const corridorDig = layout.digSpots!.find(s => s.kind === 'corridor')!;
    expect(corridorDig.anchor).toBe(3);
    expect(layout.heart.x).toBeGreaterThan(corridorDig.rect.x + corridorDig.rect.w);
  });

  it('굴착 자리: 주 통로 끝 하나 + 각 방의 빈 위·아래(이미 곁방이 있는 자리는 제외)', () => {
    const spots = layout.digSpots!.map(s => `${s.kind}:${s.anchor}`).sort();
    expect(spots).toEqual(['corridor:3', 'down:0', 'down:1', 'down:2', 'up:0', 'up:2'].sort());
  });

  it('보드가 화면보다 넓어질 수 있다(보드 안 가로 스크롤)', () => {
    const long = buildDungeonBoardLayout({
      unlockedSlots: 0, totalSlots: 0, regionTop: 96, regionBottom: 430, canvasWidth: 390, mode: 'corridor',
      plan: { corridor: [0, 1, 2, 3, 4, 5, 6, 7, 8], sides: [] },
    });
    expect(long.boardRect.w).toBeGreaterThan(390);
  });
});
