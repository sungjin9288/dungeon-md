import { describe, expect, it } from 'vitest';
import { minimapScrollFor, minimapX, minimapY } from './battleMinimapGeometry';

const rect = { x: 16, y: 560, w: 358, h: 72 };

describe('전장 미니맵 좌표', () => {
  it('월드 x 0..폭을 미니맵 좌우 끝으로, 밖은 끝에 붙인다', () => {
    expect(minimapX(0, 1000, rect)).toBe(16);
    expect(minimapX(1000, 1000, rect)).toBe(374);
    expect(minimapX(500, 1000, rect)).toBe(195);
    expect(minimapX(-50, 1000, rect)).toBe(16);
  });

  it('줄 가운데는 미니맵 줄 가운데로', () => {
    expect(minimapY(130 + 110 * 1.5, 130, 110, rect)).toBe(560 + 36);
  });

  it('누른 지점을 화면 가운데로 — 양 끝에서는 스크롤 한계', () => {
    expect(minimapScrollFor(195, rect, 1000, 390)).toBe(305);
    expect(minimapScrollFor(16, rect, 1000, 390)).toBe(0);
    expect(minimapScrollFor(374, rect, 1000, 390)).toBe(610);
  });
});
