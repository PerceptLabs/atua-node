import { describe, it, expect } from 'vitest';
import { format, inspect, __atua } from '../src/vendor/sys.js';

describe('vendor/sys', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('exports format from util', () => {
    expect(typeof format).toBe('function');
    expect(format('%s', 'hello')).toBe('hello');
  });
  it('exports inspect from util', () => {
    expect(typeof inspect).toBe('function');
    expect(typeof inspect(42)).toBe('string');
  });
  it('format does printf-style formatting', () => {
    expect(format('%d + %d = %d', 1, 2, 3)).toBe('1 + 2 = 3');
  });
  it('inspect handles objects', () => {
    const result = inspect({ a: 1 });
    expect(result).toContain('a');
    expect(result).toContain('1');
  });
});
