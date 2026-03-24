import { describe, it, expect } from 'vitest';
import { __atua } from '../src/vendor/constants.js';
import constants from '../src/vendor/constants.js';

describe('vendor/constants', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('has fs constant O_RDONLY', () => {
    expect('O_RDONLY' in constants).toBe(true);
    expect(typeof constants.O_RDONLY).toBe('number');
  });
  it('has fs constant O_WRONLY', () => {
    expect('O_WRONLY' in constants).toBe(true);
  });
  it('has fs constant O_RDWR', () => {
    expect('O_RDWR' in constants).toBe(true);
  });
  it('has signal constants', () => {
    expect('SIGTERM' in constants).toBe(true);
    expect(typeof constants.SIGTERM).toBe('number');
  });
  it('has SIGINT', () => {
    expect('SIGINT' in constants).toBe(true);
    expect(typeof constants.SIGINT).toBe('number');
  });
  it('default export is object', () => {
    expect(typeof constants).toBe('object');
    expect(constants).not.toBeNull();
  });
});
