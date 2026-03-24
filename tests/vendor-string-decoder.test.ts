import { describe, it, expect } from 'vitest';
import { StringDecoder, __atua } from '../src/vendor/string_decoder.js';

describe('vendor/string_decoder', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('StringDecoder is a constructor', () => {
    expect(typeof StringDecoder).toBe('function');
    const sd = new StringDecoder('utf8');
    expect(sd).toBeDefined();
  });
  it('write decodes buffer to string', () => {
    const sd = new StringDecoder('utf8');
    const buf = Buffer.from('hello');
    const result = sd.write(buf);
    expect(result).toBe('hello');
  });
  it('end flushes remaining bytes', () => {
    const sd = new StringDecoder('utf8');
    const result = sd.end(Buffer.from('world'));
    expect(result).toBe('world');
  });
  it('handles empty buffer', () => {
    const sd = new StringDecoder('utf8');
    const result = sd.write(Buffer.alloc(0));
    expect(result).toBe('');
  });
});
