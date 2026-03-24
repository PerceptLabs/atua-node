import { describe, it, expect } from 'vitest';
import { AsyncLocalStorage, __atua } from '../src/vendor/async_hooks.js';

describe('vendor/async_hooks', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('run returns store via getStore', () => {
    const als = new AsyncLocalStorage<string>();
    const result = als.run('mystore', () => als.getStore());
    expect(result).toBe('mystore');
  });
  it('nested run uses inner store', () => {
    const als = new AsyncLocalStorage<number>();
    als.run(1, () => {
      expect(als.getStore()).toBe(1);
      als.run(2, () => {
        expect(als.getStore()).toBe(2);
      });
      expect(als.getStore()).toBe(1);
    });
  });
  it('exit clears store', () => {
    const als = new AsyncLocalStorage<string>();
    als.run('outer', () => {
      const inner = als.exit(() => als.getStore());
      expect(inner).toBeUndefined();
    });
  });
  it('enterWith sets store', () => {
    const als = new AsyncLocalStorage<number>();
    als.enterWith(42);
    expect(als.getStore()).toBe(42);
  });
  it('getStore returns undefined when empty', () => {
    const als = new AsyncLocalStorage<string>();
    expect(als.getStore()).toBeUndefined();
  });
  it('run returns callback return value', () => {
    const als = new AsyncLocalStorage<string>();
    const result = als.run('ctx', () => 'hello');
    expect(result).toBe('hello');
  });
});
