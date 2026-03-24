import { describe, it, expect } from 'vitest';
import { encode, decode, toASCII, __atua } from '../src/vendor/punycode.js';

describe('vendor/punycode', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('encode/decode roundtrip for ASCII', () => {
    const encoded = encode('abc');
    const decoded = decode(encoded);
    expect(decoded).toBe('abc');
  });
  it('encode produces punycode string', () => {
    const result = encode('Munich');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
  it('decode reverses encode', () => {
    const original = 'test';
    expect(decode(encode(original))).toBe(original);
  });
  it('toASCII converts domain', () => {
    const result = toASCII('example.com');
    expect(result).toBe('example.com');
  });
  it('toASCII is a function', () => {
    expect(typeof toASCII).toBe('function');
  });
});
