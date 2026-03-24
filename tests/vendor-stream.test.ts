import { describe, it, expect } from 'vitest';
import { Readable, Writable, Transform, Duplex, PassThrough, pipeline, finished, __atua } from '../src/vendor/stream.js';

describe('vendor/stream', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('Readable is a constructor', () => {
    expect(typeof Readable).toBe('function');
    const r = new Readable({ read() {} });
    expect(r).toBeInstanceOf(Readable);
  });
  it('Writable is a constructor', () => {
    expect(typeof Writable).toBe('function');
    const w = new Writable({ write(_c, _e, cb) { cb(); } });
    expect(w).toBeInstanceOf(Writable);
  });
  it('Transform is a constructor', () => {
    expect(typeof Transform).toBe('function');
  });
  it('Duplex is a constructor', () => {
    expect(typeof Duplex).toBe('function');
  });
  it('PassThrough is a constructor', () => {
    expect(typeof PassThrough).toBe('function');
  });
  it('pipeline is a function', () => {
    expect(typeof pipeline).toBe('function');
  });
  it('finished is a function', () => {
    expect(typeof finished).toBe('function');
  });
});
