import { describe, it, expect } from 'vitest';
import { format, promisify, inherits, types, isDeepStrictEqual, inspect, __atua } from '../src/vendor/util.js';

describe('vendor/util', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('format does printf-style formatting', () => {
    expect(format('%s %d', 'a', 1)).toBe('a 1');
    expect(format('%j', { x: 1 })).toBe('{"x":1}');
  });
  it('promisify wraps callback function', async () => {
    const fn = (a: number, cb: (err: any, res: number) => void) => cb(null, a * 2);
    const p = promisify(fn);
    expect(await p(5)).toBe(10);
  });
  it('inherits sets prototype chain', () => {
    function Parent(this: any) {}
    Parent.prototype.hello = () => 'hi';
    function Child(this: any) {}
    inherits(Child, Parent);
    expect(Object.getPrototypeOf(Child.prototype)).toBe(Parent.prototype);
    expect((Child as any).super_).toBe(Parent);
  });
  it('types.isDate detects dates', () => {
    expect(types.isDate(new Date())).toBe(true);
    expect(types.isDate('2024-01-01')).toBe(false);
  });
  it('isDeepStrictEqual compares deeply', () => {
    expect(isDeepStrictEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(isDeepStrictEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it('inspect returns string', () => {
    expect(typeof inspect({ x: 1 })).toBe('string');
    expect(inspect(null)).toBe('null');
    expect(inspect(42)).toBe('42');
  });
});
