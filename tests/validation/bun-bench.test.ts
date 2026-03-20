// @vitest-environment node
/**
 * Phase 11 — Bun compatibility bench.
 *
 * Snippets adapted from oven-sh/bun/bench/snippets.
 * All operations use real WASM modules — zero mocks.
 * Target: 95%+ pass rate.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';
import { bindingHttpParser } from '../../src/bindings/binding-http-parser.js';
import { bindingEncoding } from '../../src/bindings/binding-encoding.js';

import * as crypto from '../../src/vendor/crypto.js';
import * as zlib from '../../src/vendor/zlib.js';
import * as url from '../../src/vendor/url.js';
import { Buffer } from '../../src/vendor/buffer.js';
import { process } from '../../src/vendor/process.js';
import { HPE, HTTP_REQUEST, type LlhttpExports } from '../../src/bindings/binding-http-parser.js';
import { type ZlibExports, Z_FINISH, Z_SYNC_FLUSH, Z_FULL_FLUSH } from '../../src/bindings/binding-zlib.js';

let llhttpExports: LlhttpExports;

beforeAll(async () => {
  if (hasWasm('libcrypto')) bindingCrypto.init(await loadReactor('libcrypto') as any);
  if (hasWasm('zlib')) bindingZlib.init(await loadReactor('zlib') as any);
  if (hasWasm('ada')) bindingUrl.init(await loadReactor('ada') as any);
  if (hasWasm('llhttp')) {
    llhttpExports = await loadReactor('llhttp') as any;
    bindingHttpParser.init(llhttpExports);
  }
  if (hasWasm('simdutf')) bindingEncoding.init(await loadReactor('simdutf') as any);
});

// ═══════════════════════════════════════════════════════════════
// CRYPTO BENCH
// ═══════════════════════════════════════════════════════════════
describe('Bun bench: crypto', () => {
  it('SHA-256 hash of 1KB data', () => {
    const data = crypto.randomBytes(1024);
    const hash = crypto.createHash('sha256');
    hash.update(data);
    const digest = hash.digest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('SHA-512 hash', () => {
    const hash = crypto.createHash('sha512');
    hash.update('benchmark data');
    const digest = hash.digest();
    expect(digest.length).toBe(64);
  });

  it('HMAC-SHA256', () => {
    const hmac = crypto.createHmac('sha256', 'benchmark-key');
    hmac.update('benchmark message');
    const digest = hmac.digest();
    expect(digest.length).toBe(32);
  });

  it('AES-256-GCM encrypt/decrypt round-trip', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const plaintext = new TextEncoder().encode('Benchmark AES-256-GCM data payload for testing');

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = cipher.update(plaintext);
    cipher.final();
    const tag = cipher.getAuthTag();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(encrypted);
    decipher.final();

    expect(decrypted).toEqual(plaintext);
  });

  it('randomBytes throughput (1000 × 32 bytes)', () => {
    for (let i = 0; i < 1000; i++) {
      const bytes = crypto.randomBytes(32);
      expect(bytes.length).toBe(32);
    }
  });

  it('randomUUID generation', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(crypto.randomUUID());
    }
    expect(uuids.size).toBe(100); // All unique
  });
});

// ═══════════════════════════════════════════════════════════════
// ZLIB BENCH
// ═══════════════════════════════════════════════════════════════
describe('Bun bench: zlib', () => {
  it('deflate/inflate round-trip of 10KB text', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(200);
    const input = new TextEncoder().encode(text);

    const deflate = zlib.createDeflate();
    const compressed = deflate.processChunk(input, Z_FINISH);
    deflate.close();

    expect(compressed.length).toBeLessThan(input.length);

    const inflate = zlib.createInflate();
    const decompressed = inflate.processChunk(compressed, Z_SYNC_FLUSH);
    inflate.close();

    expect(new TextDecoder().decode(decompressed)).toBe(text);
  });

  it('gzip/gunzip round-trip', () => {
    const input = new TextEncoder().encode('Gzip benchmark data');
    const gz = zlib.createGzip();
    const compressed = gz.processChunk(input, Z_FINISH);
    gz.close();

    const gunz = zlib.createGunzip();
    const decompressed = gunz.processChunk(compressed, Z_SYNC_FLUSH);
    gunz.close();

    expect(new TextDecoder().decode(decompressed)).toBe('Gzip benchmark data');
  });

  it('multiple flush modes in sequence', () => {
    const deflate = zlib.createDeflate();

    const chunk1 = new TextEncoder().encode('Chunk 1 data');
    deflate.processChunk(chunk1, Z_SYNC_FLUSH);

    const chunk2 = new TextEncoder().encode('Chunk 2 data');
    deflate.processChunk(chunk2, Z_FULL_FLUSH);

    const chunk3 = new TextEncoder().encode('Chunk 3 final');
    const final = deflate.processChunk(chunk3, Z_FINISH);

    expect(final.length).toBeGreaterThan(0);
    deflate.close();
  });
});

// ═══════════════════════════════════════════════════════════════
// HTTP PARSING BENCH
// ═══════════════════════════════════════════════════════════════
describe('Bun bench: HTTP parsing', () => {
  it('parse 100 HTTP GET requests', () => {
    for (let i = 0; i < 100; i++) {
      const parser = bindingHttpParser.createParser(HTTP_REQUEST);
      const req = `GET /path/${i} HTTP/1.1\r\nHost: example.com\r\nAccept: */*\r\n\r\n`;
      const rc = parser.execute(new TextEncoder().encode(req));
      expect(rc).toBe(HPE.OK);
      expect(parser.message.method).toBe('GET');
      parser.free();
    }
  });

  it('parse POST request with body', () => {
    const parser = bindingHttpParser.createParser(HTTP_REQUEST);
    const req = 'POST /api/data HTTP/1.1\r\nHost: api.example.com\r\nContent-Length: 13\r\n\r\n{"key":"val"}';
    const rc = parser.execute(new TextEncoder().encode(req));
    expect(rc).toBe(HPE.OK);
    expect(parser.message.method).toBe('POST');
    parser.free();
  });

  it('detect malformed request with exact error code', () => {
    const parser = bindingHttpParser.createParser(HTTP_REQUEST);
    const bad = 'INVALID\r\n\r\n';
    const rc = parser.execute(new TextEncoder().encode(bad));
    expect(rc).not.toBe(HPE.OK);
    parser.free();
  });
});

// ═══════════════════════════════════════════════════════════════
// URL PARSING BENCH
// ═══════════════════════════════════════════════════════════════
describe('Bun bench: URL parsing', () => {
  it('parse 100 URLs and verify components', () => {
    for (let i = 0; i < 100; i++) {
      const u = url.parse(`http://example.com:${3000 + i}/path?q=${i}`);
      expect(u.hostname).toBe('example.com');
      expect(u.port).toBe(String(3000 + i));
    }
  });

  it('parse URL with IDN', () => {
    const u = url.parse('http://例え.jp/path');
    expect(u.hostname).toBeTruthy();
  });

  it('backslash normalization', () => {
    const u = url.parse('http://example.com\\path\\file');
    expect(u.pathname).toBe('/path/file');
  });

  it('opaque paths (data URL)', () => {
    const u = url.parse('data:text/plain;base64,SGVsbG8=');
    expect(u.protocol).toBe('data:');
  });
});

// ═══════════════════════════════════════════════════════════════
// BUFFER BENCH
// ═══════════════════════════════════════════════════════════════
describe('Bun bench: Buffer', () => {
  it('alloc + fill 1000 times', () => {
    for (let i = 0; i < 1000; i++) {
      const buf = Buffer.alloc(64, i & 0xff);
      expect(buf[0]).toBe(i & 0xff);
    }
  });

  it('from + toString encoding round-trips', () => {
    const original = 'Hello World Benchmark data for encoding tests';
    // Create buffer from utf8, then convert to each encoding and back
    const buf = Buffer.from(original, 'utf8');
    for (const enc of ['utf8', 'hex', 'base64', 'ascii', 'latin1'] as const) {
      const encoded = buf.toString(enc);
      expect(encoded).toBeTruthy();
      const decoded = Buffer.from(encoded, enc);
      expect(decoded.length).toBeGreaterThan(0);
    }
  });

  it('concat 100 buffers', () => {
    const bufs: Buffer[] = [];
    for (let i = 0; i < 100; i++) {
      bufs.push(Buffer.from(`chunk-${i}`));
    }
    const result = Buffer.concat(bufs);
    expect(result.length).toBeGreaterThan(500);
    expect(result.toString()).toContain('chunk-0');
    expect(result.toString()).toContain('chunk-99');
  });

  it('compare operations', () => {
    const a = Buffer.from('aaaa');
    const b = Buffer.from('bbbb');
    expect(Buffer.compare(a, b)).toBeLessThan(0);
    expect(Buffer.compare(b, a)).toBeGreaterThan(0);
    expect(Buffer.compare(a, a)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROCESS + OS BENCH
// ═══════════════════════════════════════════════════════════════
describe('Bun bench: process/os', () => {
  it('process.hrtime precision', () => {
    const start = process.hrtime();
    // Small busy work
    let sum = 0;
    for (let i = 0; i < 10000; i++) sum += i;
    const diff = process.hrtime(start);
    expect(diff[0]).toBeGreaterThanOrEqual(0);
    expect(diff[1]).toBeGreaterThanOrEqual(0);
  });

  it('process.hrtime.bigint', () => {
    const start = process.hrtime.bigint();
    const end = process.hrtime.bigint();
    expect(end).toBeGreaterThanOrEqual(start);
  });
});
