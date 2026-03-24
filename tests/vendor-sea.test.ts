import { describe, it, expect } from 'vitest';
import { isSea, getAsset, getAssetAsBlob, getRawAsset, __atua } from '../src/vendor/sea.js';

describe('vendor/sea', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('isSea returns false', () => {
    expect(isSea()).toBe(false);
  });
  it('getAsset throws', () => {
    expect(() => getAsset('key')).toThrow(/not supported/i);
  });
  it('getAssetAsBlob throws', () => {
    expect(() => getAssetAsBlob('key')).toThrow(/not supported/i);
  });
  it('getRawAsset throws', () => {
    expect(() => getRawAsset('key')).toThrow(/not supported/i);
  });
  it('getAsset error has code', () => {
    try {
      getAsset('test');
    } catch (e: any) {
      expect(e.code).toBe('ERR_NOT_SUPPORTED');
    }
  });
});
