import { describe, it, expect } from 'vitest';
import { serialize, deserialize, getHeapStatistics, cachedDataVersionTag, __atua } from '../src/vendor/v8.js';

describe('vendor/v8', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('serialize returns Uint8Array', () => {
    const result = serialize({ hello: 'world' });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
  it('serialize/deserialize roundtrip', () => {
    const data = { a: 1, b: [2, 3], c: 'test' };
    const buf = serialize(data);
    const restored = deserialize(buf);
    expect(restored).toEqual(data);
  });
  it('getHeapStatistics returns object with heap fields', () => {
    const stats = getHeapStatistics();
    expect(typeof stats).toBe('object');
    expect('total_heap_size' in stats).toBe(true);
    expect('used_heap_size' in stats).toBe(true);
    expect('heap_size_limit' in stats).toBe(true);
    expect(typeof stats.total_heap_size).toBe('number');
  });
  it('cachedDataVersionTag returns 0', () => {
    expect(cachedDataVersionTag()).toBe(0);
  });
  it('getHeapStatistics has all expected fields', () => {
    const stats = getHeapStatistics();
    expect('malloced_memory' in stats).toBe(true);
    expect('external_memory' in stats).toBe(true);
    expect('number_of_native_contexts' in stats).toBe(true);
  });
});
