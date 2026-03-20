import { describe, it, expect } from 'vitest';
import * as vm from '../../src/vendor/vm.js';

describe('vm module facade', () => {
  it('should evaluate simple expression via runInNewContext', () => {
    const result = vm.runInNewContext('1 + 1');
    expect(result).toBe(2);
  });

  it('should access sandbox globals', () => {
    const result = vm.runInNewContext('x + 1', { x: 42 });
    expect(result).toBe(43);
  });

  it('should create and check context', () => {
    const ctx = vm.createContext({ a: 1, b: 2 });
    expect(vm.isContext(ctx)).toBe(true);
    expect(vm.isContext({})).toBe(false);
  });

  it('should run code in existing context', () => {
    const ctx = vm.createContext({ x: 10 });
    const result = vm.runInContext('x * 2', ctx);
    expect(result).toBe(20);
  });

  it('should support Script class', () => {
    const script = new vm.Script('a + b');
    const r1 = script.runInNewContext({ a: 1, b: 2 });
    expect(r1).toBe(3);
    const r2 = script.runInNewContext({ a: 10, b: 20 });
    expect(r2).toBe(30);
  });

  it('should support compileFunction', () => {
    const fn = vm.compileFunction('return x + y', ['x', 'y']);
    expect(fn(3, 4)).toBe(7);
  });

  it('should provide context isolation (objects are separate)', () => {
    const ctx1 = vm.createContext({ x: 1 });
    const ctx2 = vm.createContext({ x: 100 });
    expect(vm.runInContext('x', ctx1)).toBe(1);
    expect(vm.runInContext('x', ctx2)).toBe(100);
  });
});
