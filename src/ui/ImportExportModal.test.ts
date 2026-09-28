import { EventEmitter } from 'node:events';
import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importGameState } from '../data/wisdom';
import { showImportConfirm } from './ImportExportModal';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../data/wisdom', () => ({ importGameState: vi.fn(() => ({ success: true })) }));

class Display extends EventEmitter {
  active = true;
  list: Display[] = [];
  constructor(public text = '') { super(); }
  setDepth() { return this; }
  setInteractive() { return this; }
  setOrigin() { return this; }
  setText(text: string) { this.text = text; return this; }
  fillStyle() { return this; }
  fillRoundedRect() { return this; }
  lineStyle() { return this; }
  strokeRoundedRect() { return this; }
  add(child: Display) { this.list.push(child); return this; }
  destroy() {
    if (!this.active) return;
    this.active = false;
    this.emit('destroy');
    this.list.forEach(child => child.destroy());
    this.removeAllListeners();
  }
}

function fixture() {
  const displays: Display[] = [];
  const add = (_x?: number, _y?: number, text?: string) => {
    const value = new Display(text); displays.push(value); return value;
  };
  const scene = {
    add: { container: add, rectangle: add, graphics: add, text: add },
    events: new EventEmitter(),
    scene: { start: vi.fn() },
    time: { delayedCall: (ms: number, callback: () => void) => {
      const timer = setTimeout(callback, ms);
      return { remove: () => clearTimeout(timer) };
    } },
  };
  const parent = new Display();
  const toast = vi.fn();
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const readText = vi.fn(() => new Promise<string>((yes, no) => { resolve = yes; reject = no; }));
  vi.stubGlobal('navigator', { clipboard: { readText } });
  showImportConfirm(scene as unknown as Phaser.Scene, parent as unknown as Phaser.GameObjects.Container, toast);
  const confirm = displays.find(item => item.text === '확인')!;
  const cancel = displays.find(item => item.text === '취소')!;
  return { scene, parent, toast, readText, confirm, cancel, dialog: displays[0], backdrop: displays[1], resolve: (code: string) => resolve(code), reject: () => reject(new Error('Denied')) };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.mocked(importGameState).mockReset().mockReturnValue({ success: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('save import modal asynchronous ownership', () => {
  it('admits only one clipboard read, import and restart for repeated confirmation', async () => {
    const f = fixture();
    f.confirm.emit('pointerdown'); f.confirm.emit('pointerdown');
    expect(f.readText).toHaveBeenCalledTimes(1);
    f.resolve('  saved-code  '); await settle();
    expect(importGameState).toHaveBeenCalledExactlyOnceWith('saved-code');
    vi.advanceTimersByTime(800);
    expect(f.scene.scene.start).toHaveBeenCalledExactlyOnceWith('DungeonHomeScene');
    expect(f.scene.events.listenerCount('shutdown')).toBe(0);
    expect(f.parent.listenerCount('destroy')).toBe(0);
  });

  it.each(['cancel', 'backdrop', 'parent', 'shutdown'] as const)('ignores a clipboard result after %s', async way => {
    const f = fixture(); f.confirm.emit('pointerdown');
    if (way === 'cancel') f.cancel.emit('pointerdown');
    if (way === 'backdrop') f.backdrop.emit('pointerdown');
    if (way === 'parent') f.parent.destroy();
    if (way === 'shutdown') f.scene.events.emit('shutdown');
    f.resolve('obsolete-code'); await settle(); vi.runAllTimers();
    expect(importGameState).not.toHaveBeenCalled();
    expect(f.toast).not.toHaveBeenCalled();
    expect(f.scene.scene.start).not.toHaveBeenCalled();
    expect(f.dialog.active).toBe(false);
    expect(f.scene.events.listenerCount('shutdown')).toBe(0);
    expect(f.parent.listenerCount('destroy')).toBe(0);
  });

  it('ignores a late clipboard rejection after cancellation', async () => {
    const f = fixture(); f.confirm.emit('pointerdown'); f.cancel.emit('pointerdown');
    f.reject(); await settle();
    expect(f.toast).not.toHaveBeenCalled();
    expect(importGameState).not.toHaveBeenCalled();
  });

  it('reports permission failure and keeps the settings available for retry', async () => {
    const f = fixture(); f.confirm.emit('pointerdown'); f.reject(); await settle();
    expect(f.toast).toHaveBeenCalledWith('클립보드 접근 실패', '#ff8888');
    expect(f.dialog.active).toBe(false);
    expect(f.parent.active).toBe(true);
    expect(f.scene.events.listenerCount('shutdown')).toBe(0);
  });

  it('handles an unavailable clipboard API without an uncaught exception', async () => {
    const f = fixture(); vi.stubGlobal('navigator', {});
    expect(() => f.confirm.emit('pointerdown')).not.toThrow(); await settle();
    expect(f.toast).toHaveBeenCalledWith('클립보드 접근 실패', '#ff8888');
    expect(importGameState).not.toHaveBeenCalled();
  });

  it('cancels the successful import restart when the scene shuts down', async () => {
    const f = fixture(); f.confirm.emit('pointerdown'); f.resolve('saved-code'); await settle();
    f.scene.events.emit('shutdown'); vi.runAllTimers();
    expect(importGameState).toHaveBeenCalledTimes(1);
    expect(f.scene.scene.start).not.toHaveBeenCalled();
    expect(f.scene.events.listenerCount('shutdown')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports invalid data without scheduling a restart', async () => {
    vi.mocked(importGameState).mockReturnValue({ success: false, error: '유효하지 않은 세이브 데이터' });
    const f = fixture(); f.confirm.emit('pointerdown'); f.resolve('bad-code'); await settle();
    expect(f.toast).toHaveBeenCalledWith('유효하지 않은 세이브 데이터', '#ff8888');
    expect(vi.getTimerCount()).toBe(0);
    expect(f.scene.events.listenerCount('shutdown')).toBe(0);
  });
});
