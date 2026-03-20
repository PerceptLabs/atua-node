import { describe, it, expect } from 'vitest';
import { Buffer } from '../../src/vendor/buffer.js';

describe('Buffer implementation', () => {
  it('should be an instance of Uint8Array', () => {
    const buf = Buffer.alloc(10);
    expect(buf instanceof Uint8Array).toBe(true);
  });

  it('should create from string (utf8)', () => {
    const buf = Buffer.from('hello');
    expect(buf.length).toBe(5);
    expect(buf.toString('utf8')).toBe('hello');
  });

  it('should create from string (hex)', () => {
    const buf = Buffer.from('48656c6c6f', 'hex');
    expect(buf.toString('utf8')).toBe('Hello');
  });

  it('should create from string (base64)', () => {
    const buf = Buffer.from('SGVsbG8=', 'base64');
    expect(buf.toString('utf8')).toBe('Hello');
  });

  it('should convert to hex', () => {
    const buf = Buffer.from('Hello');
    expect(buf.toString('hex')).toBe('48656c6c6f');
  });

  it('should convert to base64', () => {
    const buf = Buffer.from('Hello');
    expect(buf.toString('base64')).toBe('SGVsbG8=');
  });

  it('should handle latin1/binary encoding', () => {
    const buf = Buffer.from('\xff\xfe', 'latin1');
    expect(buf.length).toBe(2);
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xfe);
  });

  it('should handle utf16le encoding', () => {
    const buf = Buffer.from('Hi', 'utf16le');
    expect(buf.length).toBe(4); // 2 chars × 2 bytes
    expect(buf.toString('utf16le')).toBe('Hi');
  });

  it('should concat buffers', () => {
    const a = Buffer.from('Hello');
    const b = Buffer.from(' World');
    const c = Buffer.concat([a, b]);
    expect(c.toString()).toBe('Hello World');
  });

  it('should compare buffers', () => {
    const a = Buffer.from('abc');
    const b = Buffer.from('abc');
    const c = Buffer.from('def');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(Buffer.compare(a, c)).toBeLessThan(0);
  });

  it('should copy between buffers', () => {
    const src = Buffer.from('Hello');
    const dst = Buffer.alloc(5);
    src.copy(dst);
    expect(dst.toString()).toBe('Hello');
  });

  it('should check isBuffer', () => {
    expect(Buffer.isBuffer(Buffer.alloc(0))).toBe(true);
    expect(Buffer.isBuffer(new Uint8Array(0))).toBe(false);
    expect(Buffer.isBuffer('string')).toBe(false);
  });

  it('should check isEncoding', () => {
    expect(Buffer.isEncoding('utf8')).toBe(true);
    expect(Buffer.isEncoding('hex')).toBe(true);
    expect(Buffer.isEncoding('base64')).toBe(true);
    expect(Buffer.isEncoding('invalid')).toBe(false);
  });

  it('should calculate byteLength', () => {
    expect(Buffer.byteLength('hello')).toBe(5);
    expect(Buffer.byteLength('hello', 'utf8')).toBe(5);
    expect(Buffer.byteLength('48656c6c6f', 'hex')).toBe(5);
  });

  it('should serialize to JSON', () => {
    const buf = Buffer.from([1, 2, 3]);
    const json = buf.toJSON();
    expect(json.type).toBe('Buffer');
    expect(json.data).toEqual([1, 2, 3]);
  });
});
