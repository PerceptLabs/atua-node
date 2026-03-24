import { describe, it, expect } from 'vitest';
import { builtinModules, isBuiltin, __atua } from '../src/vendor/module.js';

describe('vendor/module', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('builtinModules has 44+ entries', () => {
    expect(builtinModules.length).toBeGreaterThanOrEqual(44);
  });
  it('isBuiltin("fs") returns true', () => {
    expect(isBuiltin('fs')).toBe(true);
  });
  it('isBuiltin("node:fs") returns true', () => {
    expect(isBuiltin('node:fs')).toBe(true);
  });
  it('isBuiltin("foo") returns false', () => {
    expect(isBuiltin('foo')).toBe(false);
  });
  it('isBuiltin works for various modules', () => {
    expect(isBuiltin('path')).toBe(true);
    expect(isBuiltin('node:path')).toBe(true);
    expect(isBuiltin('events')).toBe(true);
    expect(isBuiltin('crypto')).toBe(true);
  });
  it('builtinModules includes common modules', () => {
    expect(builtinModules).toContain('fs');
    expect(builtinModules).toContain('path');
    expect(builtinModules).toContain('util');
    expect(builtinModules).toContain('stream');
  });
});
