import { describe, it, expect, vi } from 'vitest';
import { channel, hasSubscribers, __atua } from '../src/vendor/diagnostics_channel.js';

describe('vendor/diagnostics_channel', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('channel returns Channel', () => {
    const ch = channel('test-chan');
    expect(ch).toBeDefined();
    expect(ch.name).toBe('test-chan');
  });
  it('subscribe receives published message', () => {
    const ch = channel('sub-test');
    const fn = vi.fn();
    ch.subscribe(fn);
    ch.publish({ hello: 'world' });
    expect(fn).toHaveBeenCalledWith({ hello: 'world' }, 'sub-test');
  });
  it('unsubscribe stops delivery', () => {
    const ch = channel('unsub-test');
    const fn = vi.fn();
    ch.subscribe(fn);
    ch.unsubscribe(fn);
    ch.publish('msg');
    expect(fn).not.toHaveBeenCalled();
  });
  it('hasSubscribers reflects state', () => {
    const ch = channel('has-sub-test');
    expect(ch.hasSubscribers).toBe(false);
    const fn = () => {};
    ch.subscribe(fn);
    expect(ch.hasSubscribers).toBe(true);
    ch.unsubscribe(fn);
    expect(ch.hasSubscribers).toBe(false);
  });
  it('module-level hasSubscribers works', () => {
    const ch = channel('mod-has-sub');
    const fn = () => {};
    ch.subscribe(fn);
    expect(hasSubscribers('mod-has-sub')).toBe(true);
  });
});
