import { describe, it, expect } from 'vitest';
import { isatty, WriteStream, ReadStream, __atua } from '../src/vendor/tty.js';

describe('vendor/tty', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('isatty returns false in browser', () => {
    expect(isatty(0)).toBe(false);
    expect(isatty(1)).toBe(false);
    expect(isatty(2)).toBe(false);
  });
  it('WriteStream has columns and rows as numbers', () => {
    const ws = new WriteStream(1);
    expect(typeof ws.columns).toBe('number');
    expect(typeof ws.rows).toBe('number');
    expect(ws.columns).toBe(80);
    expect(ws.rows).toBe(24);
  });
  it('getColorDepth returns a number', () => {
    const ws = new WriteStream(1);
    expect(typeof ws.getColorDepth()).toBe('number');
  });
  it('hasColors returns false for high counts', () => {
    const ws = new WriteStream(1);
    expect(ws.hasColors(256)).toBe(false);
  });
  it('ReadStream has isTTY false', () => {
    const rs = new ReadStream(0);
    expect(rs.isTTY).toBe(false);
  });
  it('getWindowSize returns tuple', () => {
    const ws = new WriteStream(1);
    const [cols, rows] = ws.getWindowSize();
    expect(cols).toBe(80);
    expect(rows).toBe(24);
  });
});
