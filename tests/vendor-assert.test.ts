import { describe, it, expect } from 'vitest';
import { strictEqual, throws, deepStrictEqual, ok, __atua } from '../src/vendor/assert.js';

describe('vendor/assert', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('strictEqual passes on equal values', () => {
    expect(() => strictEqual(1, 1)).not.toThrow();
  });
  it('strictEqual throws on unequal', () => {
    expect(() => strictEqual(1, 2)).toThrow();
  });
  it('throws catches thrown error', () => {
    expect(() => throws(() => { throw new Error('boom'); })).not.toThrow();
  });
  it('throws fails when no error thrown', () => {
    expect(() => throws(() => {})).toThrow();
  });
  it('deepStrictEqual compares objects', () => {
    expect(() => deepStrictEqual({ a: 1 }, { a: 1 })).not.toThrow();
    expect(() => deepStrictEqual({ a: 1 }, { a: 2 })).toThrow();
  });
  it('ok passes on truthy', () => {
    expect(() => ok(1)).not.toThrow();
    expect(() => ok(true)).not.toThrow();
  });
  it('ok fails on falsy', () => {
    expect(() => ok(0)).toThrow();
    expect(() => ok(false)).toThrow();
  });
});
