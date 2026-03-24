import { describe, it, expect } from 'vitest';
import { parse, stringify, __atua } from '../src/vendor/querystring.js';

describe('vendor/querystring', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('parse parses query string', () => {
    const result = parse('a=1&b=2');
    expect(result.a).toBe('1');
    expect(result.b).toBe('2');
  });
  it('parse handles empty string', () => {
    const result = parse('');
    expect(Object.keys(result).length).toBe(0);
  });
  it('stringify creates query string', () => {
    const result = stringify({ a: '1' });
    expect(result).toBe('a=1');
  });
  it('stringify handles multiple keys', () => {
    const result = stringify({ a: '1', b: '2' });
    expect(result).toContain('a=1');
    expect(result).toContain('b=2');
  });
  it('roundtrip parse/stringify', () => {
    const obj = parse('x=hello&y=world');
    const str = stringify(obj);
    expect(str).toContain('x=hello');
    expect(str).toContain('y=world');
  });
});
