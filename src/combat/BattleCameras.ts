/**
 * 전투 카메라 두 대 — 가로로 긴 던전(주 통로)을 세로 화면에 담기 위해.
 *
 * - 월드 카메라(main): 방·경로·침입자·효과. 전장 폭이 화면보다 넓으면 가로로 움직인다
 *   (선두 침입자를 따라가고, 손가락으로 끌면 그쪽이 우선).
 * - 고정 카메라: 버튼·스킬 바·시너지·보스 HP·결과창 같은 화면 고정 UI.
 *
 * 왜 두 대인가: 전투 카메라는 DPR 확대(zoom=dpr)를 쓰는데, 기존 `centerOn` 방식에서는 `scrollFactor(0)`이
 * 화면에 고정되지 않는다(메모리: DPR scrollFactor 함정). 두 카메라 모두 원점을 좌상단(0,0)에 두면 확대가
 * 좌상단 기준이 되어 scroll 0에서 기존 화면과 똑같고, 월드 카메라의 scrollX만 움직이면 된다.
 *
 * 어떤 오브젝트를 어느 카메라가 그리는지는 렌더 직전 한 번에 정한다: `markBattleHud`로 표시했거나
 * 깊이가 HUD_OVERLAY_DEPTH 이상(전체 화면 연출·결과창)이면 고정 카메라, 나머지는 월드 카메라.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { isBattleHud } from './battleHudMark';

export { BATTLE_HUD_KEY, HUD_OVERLAY_DEPTH, isBattleHud, markBattleHud } from './battleHudMark';

/** 손으로 끈 뒤 자동 따라가기를 쉬는 시간(ms). */
const MANUAL_PAN_HOLD_MS = 2500;
/** 끌기로 인정하는 최소 이동(px, 논리 좌표) — 그보다 작으면 방 탭이다. */
const DRAG_THRESHOLD = 10;

/** 월드 카메라 가로 스크롤 한계 [0, max]. 전장이 화면보다 좁으면 0. */
export function battleScrollMax(worldWidth: number): number {
  return Math.max(0, Math.ceil(worldWidth - CANVAS_WIDTH));
}

/** 선두 침입자가 화면 오른쪽 40% 지점에 오도록 하는 목표 스크롤(한계 안). */
export function followScrollTarget(leadX: number, worldWidth: number): number {
  return Phaser.Math.Clamp(leadX - CANVAS_WIDTH * 0.6, 0, battleScrollMax(worldWidth));
}

export class BattleCameras {
  private readonly hud: Phaser.Cameras.Scene2D.Camera;
  private manualUntil = 0;
  private dragStartX: number | null = null;
  private dragStartScroll = 0;
  private dragging = false;

  /**
   * @param dragMaxY 이 논리 y보다 아래(웨이브 버튼·미니맵·스킬 바)에서 누른 것은 전장 끌기가 아니다 —
   *   미니맵을 끄는 손가락이 카메라를 반대로 끌지 않도록.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly dragMaxY = Number.POSITIVE_INFINITY,
  ) {
    const world = scene.cameras.main;
    world.setOrigin(0, 0).setScroll(0, 0);
    this.hud = scene.cameras.add(0, 0, world.width, world.height)
      .setOrigin(0, 0).setZoom(world.zoom).setScroll(0, 0).setName('battleHud');
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.assignCameras, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** 전투 update에서 매 프레임: 손으로 끄는 중이 아니면 선두 침입자를 부드럽게 따라간다. */
  follow(leadX: number | null, _now?: number): void {
    if (this.dragging || this.realNow() < this.manualUntil || leadX === null || battleScrollMax(this.worldWidth) === 0) return;
    const world = this.scene.cameras.main;
    const target = followScrollTarget(leadX, this.worldWidth);
    world.scrollX += (target - world.scrollX) * 0.08;
  }

  private assignCameras(): void {
    const world = this.scene.cameras.main;
    for (const child of this.scene.children.list) {
      // cameraFilter = 이 오브젝트를 그리지 않을 카메라의 id 비트
      child.cameraFilter = isBattleHud(child) ? world.id : this.hud.id;
    }
  }

  /** 화면 왼쪽 끝을 이 월드 x에 둔다(미니맵 이동). 한동안 자동 따라가기를 쉰다. */
  panTo(scrollX: number): void {
    this.scene.cameras.main.scrollX = Phaser.Math.Clamp(scrollX, 0, battleScrollMax(this.worldWidth));
    this.manualUntil = this.realNow() + MANUAL_PAN_HOLD_MS;
  }

  /**
   * The manual-pan hold runs on real (unscaled) frame time: the scene clock runs 3× in a
   * 3× battle, which cut the hold to under a second — and the update() time argument is a
   * third clock again, so mixing them ended the hold at once.
   */
  private realNow(): number {
    return this.scene.game.loop.time;
  }

  /** 지금 보이는 월드 가로 범위(미니맵 표시용). */
  view(): { readonly left: number; readonly width: number } {
    return { left: this.scene.cameras.main.scrollX, width: CANVAS_WIDTH };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.y / (this.scene.cameras.main.zoom || 1) > this.dragMaxY) { this.dragStartX = null; return; }
    this.dragStartX = pointer.x;
    this.dragStartScroll = this.scene.cameras.main.scrollX;
    this.dragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragStartX === null || !pointer.isDown || battleScrollMax(this.worldWidth) === 0) return;
    const world = this.scene.cameras.main;
    const dx = (pointer.x - this.dragStartX) / world.zoom;
    if (!this.dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
    this.dragging = true;
    world.scrollX = Phaser.Math.Clamp(this.dragStartScroll - dx, 0, battleScrollMax(this.worldWidth));
  }

  private onPointerUp(): void {
    if (this.dragging) this.manualUntil = this.realNow() + MANUAL_PAN_HOLD_MS;
    this.dragStartX = null;
    this.dragging = false;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.assignCameras, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    if (this.hud.scene) this.scene.cameras.remove(this.hud);
  }
}
