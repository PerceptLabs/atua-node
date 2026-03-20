import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, watch, existsSync } from '../../src/vendor/fs.js';

describe('fs.watch (polling-based)', () => {
  it('should create a watcher with close method', () => {
    writeFileSync('/watch-create.txt', 'data');
    const watcher = watch('/watch-create.txt');
    expect(watcher).toBeDefined();
    expect(typeof (watcher as any).close).toBe('function');
    (watcher as any).close();
  });

  it('should accept a listener callback', () => {
    writeFileSync('/watch-cb.txt', 'data');
    const handler = vi.fn();
    const watcher = watch('/watch-cb.txt', handler);
    expect(watcher).toBeDefined();
    (watcher as any).close();
  });

  it('should emit events on the watcher EventEmitter', () => {
    writeFileSync('/watch-emit.txt', 'data');
    const watcher = watch('/watch-emit.txt');

    const changeHandler = vi.fn();
    watcher.on('change', changeHandler);

    // Manually emit to test the EventEmitter interface
    watcher.emit('change', 'change', '/watch-emit.txt');
    expect(changeHandler).toHaveBeenCalledWith('change', '/watch-emit.txt');

    (watcher as any).close();
  });

  it('should stop watching after close without errors', () => {
    writeFileSync('/watch-stop2.txt', 'data');
    const watcher = watch('/watch-stop2.txt');
    // Close should not throw
    (watcher as any).close();
    // Calling close again should not throw
    (watcher as any).close();
  });
});
