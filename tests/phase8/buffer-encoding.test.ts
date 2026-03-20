import { describe, it, expect } from 'vitest';
import { Buffer } from '../../src/vendor/buffer.js';

describe('Buffer encoding round-trips', () => {
  const testString = 'Hello, World! 🌍';

  it('should round-trip utf8', () => {
    const buf = Buffer.from(testString, 'utf8');
    expect(buf.toString('utf8')).toBe(testString);
  });

  it('should round-trip ascii', () => {
    const asciiStr = 'Hello, ASCII!';
    const buf = Buffer.from(asciiStr, 'ascii');
    expect(buf.toString('ascii')).toBe(asciiStr);
  });

  it('should round-trip hex', () => {
    const buf = Buffer.from('hello');
    const hex = buf.toString('hex');
    const decoded = Buffer.from(hex, 'hex');
    expect(decoded.toString('utf8')).toBe('hello');
  });

  it('should round-trip base64', () => {
    const buf = Buffer.from('Hello, Base64!');
    const b64 = buf.toString('base64');
    const decoded = Buffer.from(b64, 'base64');
    expect(decoded.toString('utf8')).toBe('Hello, Base64!');
  });

  it('should round-trip base64url', () => {
    const buf = Buffer.from([0xff, 0xfe, 0xfd]);
    const b64url = buf.toString('base64url');
    expect(b64url).not.toContain('+');
    expect(b64url).not.toContain('/');
    expect(b64url).not.toContain('=');
    const decoded = Buffer.from(b64url, 'base64url');
    expect(decoded[0]).toBe(0xff);
    expect(decoded[1]).toBe(0xfe);
  });

  it('should round-trip latin1/binary', () => {
    const buf = Buffer.from('\xff\xfe\x80', 'latin1');
    expect(buf.length).toBe(3);
    expect(buf.toString('latin1')).toBe('\xff\xfe\x80');
  });

  it('should round-trip utf16le', () => {
    const buf = Buffer.from('ABC', 'utf16le');
    expect(buf.length).toBe(6);
    expect(buf.toString('utf16le')).toBe('ABC');
  });

  it('should handle Buffer.alloc with fill', () => {
    const buf = Buffer.alloc(5, 0x41);
    expect(buf.toString()).toBe('AAAAA');
  });

  it('should handle Buffer.alloc with string fill', () => {
    const buf = Buffer.alloc(5, 'ab');
    expect(buf.toString()).toBe('ababa');
  });

  it('should support zero-length buffers', () => {
    const buf = Buffer.alloc(0);
    expect(buf.length).toBe(0);
    expect(buf.toString()).toBe('');
  });
});
