import { describe, it, expect } from 'vitest';
import { EventEmitter, once, __atua } from '../src/vendor/events.js';

describe('vendor/events', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('emits and listens to events', () => {
    const ee = new EventEmitter();
    const calls: string[] = [];
    ee.on('data', (v: string) => calls.push(v));
    ee.emit('data', 'hello');
    ee.emit('data', 'world');
    expect(calls).toEqual(['hello', 'world']);
  });
  it('once resolves on first event', async () => {
    const ee = new EventEmitter();
    const p = once(ee, 'done');
    ee.emit('done', 42);
    const result = await p;
    expect(result).toEqual([42]);
  });
  it('removeListener stops delivery', () => {
    const ee = new EventEmitter();
    const calls: number[] = [];
    const fn = (v: number) => calls.push(v);
    ee.on('x', fn);
    ee.emit('x', 1);
    ee.removeListener('x', fn);
    ee.emit('x', 2);
    expect(calls).toEqual([1]);
  });
  it('listenerCount returns count', () => {
    const ee = new EventEmitter();
    ee.on('a', () => {});
    ee.on('a', () => {});
    expect(ee.listenerCount('a')).toBe(2);
  });
});
