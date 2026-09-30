import { describe, expect, it } from 'vitest';
import { HOME_MODAL_MAX_WAIT_MS, isHomeModalOpen, trackHomeModal, whenHomeModalsClear } from './homeModalQueue';

function fakeScene() {
  const timers: Array<() => void> = [];
  let active = true;
  return {
    timers,
    setActive: (v: boolean) => { active = v; },
    time: { delayedCall: (_ms: number, fn: () => void) => { timers.push(fn); } },
    sys: { isActive: () => active },
    tick() { const due = timers.splice(0); due.forEach(fn => fn()); },
  };
}

function fakeModal() {
  let onDestroy: (() => void) | null = null;
  return { once: (_e: 'destroy', fn: () => void) => { onDestroy = fn; }, destroy: () => onDestroy?.() };
}

describe('홈 모달 순서', () => {
  it('모달이 없으면 바로, 있으면 모두 닫힌 뒤에 뜬다', () => {
    const scene = fakeScene();
    const shown: string[] = [];
    whenHomeModalsClear(scene, () => shown.push('now'));
    expect(shown).toEqual(['now']);

    const idle = fakeModal();
    const quest = fakeModal();
    trackHomeModal(scene, idle);
    trackHomeModal(scene, quest);
    whenHomeModalsClear(scene, () => shown.push('invasion'));
    scene.tick();
    expect(shown).toEqual(['now']);
    idle.destroy();
    scene.tick();
    expect(shown).toEqual(['now']);
    quest.destroy();
    expect(isHomeModalOpen(scene)).toBe(false);
    scene.tick();
    expect(shown).toEqual(['now', 'invasion']);
  });

  it('씬이 멈추면 버리고, 닫히지 않는 모달이 있어도 최대 대기 뒤에는 뜬다', () => {
    const stopped = fakeScene();
    trackHomeModal(stopped, fakeModal());
    let ran = false;
    whenHomeModalsClear(stopped, () => { ran = true; });
    stopped.setActive(false);
    stopped.tick();
    expect(ran).toBe(false);

    const stuck = fakeScene();
    trackHomeModal(stuck, fakeModal());
    let late = false;
    whenHomeModalsClear(stuck, () => { late = true; });
    for (let waited = 0; waited <= HOME_MODAL_MAX_WAIT_MS && !late; waited += 400) stuck.tick();
    expect(late).toBe(true);
  });
});
