import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { onReleaseTap } from './releaseTap';

const target = () => new EventEmitter() as unknown as Phaser.GameObjects.GameObject & EventEmitter;
const pointer = (downTime: number) => ({ downTime }) as Phaser.Input.Pointer;

describe('onReleaseTap', () => {
  it('fires on release when the press started on the same target', () => {
    const z = target(); const tap = vi.fn();
    onReleaseTap(z, tap);
    z.emit('pointerdown', pointer(100)); z.emit('pointerup', pointer(100));
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('ignores a release whose press landed on something else (a popup closed on press)', () => {
    const z = target(); const tap = vi.fn();
    onReleaseTap(z, tap);
    z.emit('pointerup', pointer(200));
    z.emit('pointerdown', pointer(300)); z.emit('pointerup', pointer(300)); z.emit('pointerup', pointer(300));
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('ignores a release while blocked (the press was a drag)', () => {
    const z = target(); const tap = vi.fn();
    onReleaseTap(z, tap, () => true);
    z.emit('pointerdown', pointer(400)); z.emit('pointerup', pointer(400));
    expect(tap).not.toHaveBeenCalled();
  });
});
