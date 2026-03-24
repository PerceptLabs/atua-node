import { describe, it, expect } from 'vitest';
import { join, dirname, basename, isAbsolute, extname, sep, resolve, normalize, matchesGlob } from '../src/vendor/path.js';

describe('vendor/path', () => {
  it('join combines segments', () => {
    expect(join('a', 'b')).toBe('a/b');
    expect(join('a', 'b', 'c')).toBe('a/b/c');
  });
  it('dirname returns parent', () => {
    expect(dirname('/a/b')).toBe('/a');
  });
  it('basename returns filename', () => {
    expect(basename('/a/b.txt')).toBe('b.txt');
    expect(basename('/a/b.txt', '.txt')).toBe('b');
  });
  it('isAbsolute detects absolute paths', () => {
    expect(isAbsolute('/a')).toBe(true);
    expect(isAbsolute('a')).toBe(false);
  });
  it('extname returns extension', () => {
    expect(extname('file.txt')).toBe('.txt');
    expect(extname('file')).toBe('');
  });
  it('sep exists as string', () => {
    expect(typeof sep).toBe('string');
  });
  it('resolve returns absolute path', () => {
    expect(typeof resolve('a')).toBe('string');
  });
  it('normalize cleans path', () => {
    expect(normalize('/a//b')).toBe('/a/b');
  });
  it('matchesGlob matches patterns', () => {
    expect(matchesGlob('src/foo.ts', 'src/*.ts')).toBe(true);
    expect(matchesGlob('src/foo.ts', 'lib/*.ts')).toBe(false);
  });
});
