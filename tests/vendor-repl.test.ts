import { describe, it, expect } from 'vitest';
import { start, REPLServer, REPL_MODE_SLOPPY, REPL_MODE_STRICT, __atua } from '../src/vendor/repl.js';

describe('vendor/repl', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('start is a function', () => {
    expect(typeof start).toBe('function');
  });
  it('REPLServer is a constructor', () => {
    expect(typeof REPLServer).toBe('function');
    const r = new REPLServer();
    expect(r).toBeDefined();
  });
  it('REPL_MODE_SLOPPY exists', () => {
    expect(REPL_MODE_SLOPPY).toBeDefined();
    expect(typeof REPL_MODE_SLOPPY).toBe('symbol');
  });
  it('REPL_MODE_STRICT exists', () => {
    expect(REPL_MODE_STRICT).toBeDefined();
    expect(typeof REPL_MODE_STRICT).toBe('symbol');
  });
  it('start returns REPLServer', () => {
    const r = start({ prompt: '> ' });
    expect(r).toBeInstanceOf(REPLServer);
  });
  it('REPLServer has close method', () => {
    const r = new REPLServer();
    expect(typeof r.close).toBe('function');
  });
  it('REPLServer has defineCommand method', () => {
    const r = new REPLServer();
    expect(typeof r.defineCommand).toBe('function');
  });
});
