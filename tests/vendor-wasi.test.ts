import { describe, it, expect } from 'vitest';
import { WASI, __atua } from '../src/vendor/wasi.js';

describe('vendor/wasi', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('WASI is a constructor', () => {
    expect(typeof WASI).toBe('function');
    const w = new WASI();
    expect(w).toBeDefined();
  });
  it('WASI accepts options', () => {
    const w = new WASI({ args: ['a'], env: { FOO: 'bar' }, version: 'preview1' });
    expect(w).toBeDefined();
  });
  it('getImportObject returns object', () => {
    const w = new WASI();
    const imports = w.getImportObject();
    expect(typeof imports).toBe('object');
    expect(imports).not.toBeNull();
  });
  it('getImportObject has wasi_snapshot_preview1', () => {
    const w = new WASI();
    const imports = w.getImportObject();
    expect('wasi_snapshot_preview1' in imports).toBe(true);
  });
  it('wasiImport returns preview1 imports', () => {
    const w = new WASI();
    const wasiImport = w.wasiImport;
    expect(typeof wasiImport).toBe('object');
    expect('fd_write' in wasiImport).toBe(true);
    expect('proc_exit' in wasiImport).toBe(true);
  });
});
