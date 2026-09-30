/**
 * 홈 모달 순서 — 홈에 들어올 때 방치 수익·퀘스트 완료·침략 알림·레벨업이 각자 타이머로 떠서 한 화면에
 * 겹쳤다. 모달은 열릴 때 `trackHomeModal`로 등록하고(파괴되면 자동 해제), 스스로 끼어드는 알림은
 * `whenHomeModalsClear`로 앞의 모달이 모두 닫힌 뒤에 뜬다. Phaser를 import하지 않는다(테스트 가능).
 */

interface Destroyable {
  once(event: 'destroy', fn: () => void): unknown;
}

interface ClockScene {
  readonly time: { delayedCall(delay: number, callback: () => void): unknown };
  readonly sys: { isActive(): boolean };
}

const openCounts = new WeakMap<object, number>();

/** 열린 모달로 등록한다. 모달 오브젝트가 파괴되면(닫힘·씬 종료) 자동으로 빠진다. */
export function trackHomeModal(scene: object, modal: Destroyable): void {
  openCounts.set(scene, (openCounts.get(scene) ?? 0) + 1);
  modal.once('destroy', () => {
    openCounts.set(scene, Math.max(0, (openCounts.get(scene) ?? 1) - 1));
  });
}

export function isHomeModalOpen(scene: object): boolean {
  return (openCounts.get(scene) ?? 0) > 0;
}

/** 폴링 간격과 최대 대기(ms) — 끝까지 닫히지 않는 모달이 있어도 알림은 결국 뜬다. */
export const HOME_MODAL_POLL_MS = 400;
export const HOME_MODAL_MAX_WAIT_MS = 60_000;

/**
 * 열린 모달이 없을 때 `run`을 부른다(지금 없으면 바로). 씬이 멈추면 버린다.
 * 최대 대기를 넘기면 그대로 부른다 — 알림이 영영 사라지는 것보다 겹치는 편이 낫다.
 */
export function whenHomeModalsClear(scene: ClockScene & object, run: () => void, waited = 0): void {
  if (!isHomeModalOpen(scene) || waited >= HOME_MODAL_MAX_WAIT_MS) {
    run();
    return;
  }
  scene.time.delayedCall(HOME_MODAL_POLL_MS, () => {
    if (!scene.sys.isActive()) return;
    whenHomeModalsClear(scene, run, waited + HOME_MODAL_POLL_MS);
  });
}
