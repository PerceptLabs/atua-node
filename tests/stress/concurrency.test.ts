// @vitest-environment node
/**
 * Stress: Concurrency — parallel operations.
 * Tests simultaneous operations to expose shared-state corruption.
 * All operations use real .wasm — zero mocks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';
import { Z_FINISH, Z_SYNC_FLUSH } from '../../src/bindings/binding-zlib.js';
import * as crypto from '../../src/vendor/crypto.js';
import * as vm from '../../src/vendor/vm.js';

beforeAll(async () => {
  if (hasWasm('libcrypto')) bindingCrypto.init(await loadReactor('libcrypto') as any);
  if (hasWasm('zlib')) bindingZlib.init(await loadReactor('zlib') as any);
  if (hasWasm('ada')) bindingUrl.init(await loadReactor('ada') as any);
});

describe('Concurrency: crypto', () => {
  it('100 concurrent SHA-256 hashes produce correct distinct results', async () => {
    const inputs = Array.from({ length: 100 }, (_, i) => `unique data ${i} ${crypto.randomUUID()}`);

    const results = await Promise.all(inputs.map(async (input) => {
      const h = crypto.createHash('sha256');
      h.update(input);
      return h.digest('hex');
    }));

    // All results should be 64-char hex strings
    results.forEach(r => expect(r).toHaveLength(64));

    // All should be distinct (unique inputs → unique hashes)
    const unique = new Set(results);
    expect(unique.size).toBe(100);
  });
});

describe('Concurrency: zlib', () => {
  it('100 concurrent deflate/inflate round-trips all correct', async () => {
    const inputs = Array.from({ length: 100 }, (_, i) =>
      new TextEncoder().encode(`Concurrent zlib data #${i} ${'x'.repeat(100)}`)
    );

    const results = await Promise.all(inputs.map(async (input) => {
      const d = bindingZlib.createDeflate();
      const { data: compressed } = d.process(input, Z_FINISH);
      d.end();

      const inf = bindingZlib.createInflate();
      const { data: decompressed } = inf.process(compressed, Z_SYNC_FLUSH);
      inf.end();

      return new TextDecoder().decode(decompressed);
    }));

    // Verify each round-trip is correct
    inputs.forEach((input, i) => {
      expect(results[i]).toBe(new TextDecoder().decode(input));
    });
  });
});

describe('Concurrency: vm', () => {
  it('50 concurrent vm.runInNewContext produce correct results', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => {
        return Promise.resolve(vm.runInNewContext('n * 2', { n: i }));
      })
    );

    const expected = Array.from({ length: 50 }, (_, i) => i * 2);
    expect(results).toEqual(expected);
  });
});

describe('Concurrency: URL parsing', () => {
  it('50 concurrent URL parses all correct', async () => {
    const urls = Array.from({ length: 50 }, (_, i) =>
      `http://example${i}.com:${3000 + i}/path?q=${i}`
    );

    const results = await Promise.all(urls.map(async (url) => {
      return bindingUrl.parse(url);
    }));

    results.forEach((result, i) => {
      expect(result.valid).toBe(true);
      expect(result.hostname).toBe(`example${i}.com`);
      expect(result.port).toBe(String(3000 + i));
    });
  });
});
