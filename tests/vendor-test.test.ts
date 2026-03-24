import { describe, it, expect } from 'vitest';
import { test as nodeTest, describe as nodeDescribe, it as nodeIt, mock, __atua } from '../src/vendor/test.js';

describe('vendor/test', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('test is a function', () => {
    expect(typeof nodeTest).toBe('function');
  });
  it('describe is a function', () => {
    expect(typeof nodeDescribe).toBe('function');
  });
  it('it is a function', () => {
    expect(typeof nodeIt).toBe('function');
  });
  it('mock.fn returns callable spy', () => {
    const spy = mock.fn();
    expect(typeof spy).toBe('function');
    spy('a', 'b');
    expect(spy.mock.callCount()).toBe(1);
    expect(spy.mock.calls[0].arguments).toEqual(['a', 'b']);
  });
  it('mock.fn wraps original', () => {
    const spy = mock.fn((x: number) => x * 2);
    expect(spy(3)).toBe(6);
    expect(spy.mock.callCount()).toBe(1);
  });
  it('mock.fn resetCalls works', () => {
    const spy = mock.fn();
    spy();
    spy();
    expect(spy.mock.callCount()).toBe(2);
    spy.mock.resetCalls();
    expect(spy.mock.callCount()).toBe(0);
  });
});
