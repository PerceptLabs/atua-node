import { describe, it, expect } from 'vitest';
import { performance, PerformanceObserver, monitorEventLoopDelay, __atua } from '../src/vendor/perf_hooks.js';

describe('vendor/perf_hooks', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('performance is an object', () => {
    expect(typeof performance).toBe('object');
    expect(performance).not.toBeNull();
  });
  it('performance.now returns number', () => {
    const now = performance.now();
    expect(typeof now).toBe('number');
    expect(now).toBeGreaterThanOrEqual(0);
  });
  it('PerformanceObserver exists', () => {
    expect(PerformanceObserver).toBeDefined();
  });
  it('monitorEventLoopDelay returns histogram', () => {
    const h = monitorEventLoopDelay();
    expect(typeof h.enable).toBe('function');
    expect(typeof h.disable).toBe('function');
    expect(typeof h.percentile).toBe('function');
    expect(typeof h.reset).toBe('function');
  });
  it('histogram has numeric properties', () => {
    const h = monitorEventLoopDelay();
    expect(typeof h.min).toBe('number');
    expect(typeof h.max).toBe('number');
    expect(typeof h.mean).toBe('number');
  });
});
