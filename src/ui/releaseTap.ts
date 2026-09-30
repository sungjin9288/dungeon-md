/**
 * 손을 뗄 때 반응하는 탭(끌기와 구분하려고 누름이 아니라 뗌에 반응하는 칸들).
 * 누름이 이 대상에서 시작됐을 때만 부른다 — 위에 뜬 창이 누름에 닫힌 뒤 손을 떼는 순간 아래 대상이
 * 눌리는 클릭 관통을 막는다. `blocked`가 참이면(예: 이번 누름이 끌기였다) 부르지 않는다.
 */
import type Phaser from 'phaser';

export function onReleaseTap(
  target: Phaser.GameObjects.GameObject,
  onTap: () => void,
  blocked: () => boolean = () => false,
): void {
  let downAt: number | null = null;
  target.on('pointerdown', (pointer: Phaser.Input.Pointer) => { downAt = pointer.downTime; });
  target.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    const pressedHere = downAt !== null && downAt === pointer.downTime;
    downAt = null;
    if (pressedHere && !blocked()) onTap();
  });
}
