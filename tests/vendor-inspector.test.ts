import { describe, it, expect } from 'vitest';
import { Session, open, close, url, __atua } from '../src/vendor/inspector.js';

describe('vendor/inspector', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('Session is a constructor', () => {
    expect(typeof Session).toBe('function');
    const s = new Session();
    expect(s).toBeDefined();
  });
  it('open is a function', () => {
    expect(typeof open).toBe('function');
  });
  it('close is a function', () => {
    expect(typeof close).toBe('function');
  });
  it('url is a function', () => {
    expect(typeof url).toBe('function');
  });
  it('url returns undefined in browser', () => {
    expect(url()).toBeUndefined();
  });
  it('Session has connect/disconnect methods', () => {
    const s = new Session();
    expect(typeof s.connect).toBe('function');
    expect(typeof s.disconnect).toBe('function');
  });
  it('Session connect does not throw', () => {
    const s = new Session();
    expect(() => s.connect()).not.toThrow();
  });
});
