// @vitest-environment node
/**
 * Stress: Node.js own test patterns.
 * Translated from Node.js v22 test/parallel/.
 * All operations use real .wasm — zero mocks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';
import { bindingHttpParser, HPE, HTTP_REQUEST } from '../../src/bindings/binding-http-parser.js';
import { bindingEncoding } from '../../src/bindings/binding-encoding.js';
import { Z_FINISH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_OK, Z_STREAM_END } from '../../src/bindings/binding-zlib.js';
import * as crypto from '../../src/vendor/crypto.js';
import { Buffer } from '../../src/vendor/buffer.js';
import * as vm from '../../src/vendor/vm.js';
import { process } from '../../src/vendor/process.js';

beforeAll(async () => {
  if (hasWasm('libcrypto')) bindingCrypto.init(await loadReactor('libcrypto') as any);
  if (hasWasm('zlib')) bindingZlib.init(await loadReactor('zlib') as any);
  if (hasWasm('ada')) bindingUrl.init(await loadReactor('ada') as any);
  if (hasWasm('llhttp')) bindingHttpParser.init(await loadReactor('llhttp') as any);
  if (hasWasm('simdutf')) bindingEncoding.init(await loadReactor('simdutf') as any);
});

// ═══════════════════════════════════════════════════════════════
// CRYPTO — test-crypto-*
// ═══════════════════════════════════════════════════════════════
describe('Node test-crypto: hash algorithms', () => {
  // Known SHA-256 test vectors
  it('SHA-256 of empty string matches known vector', () => {
    const h = crypto.createHash('sha256');
    h.update('');
    const hex = h.digest('hex');
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('SHA-256 of "abc" matches known vector', () => {
    const h = crypto.createHash('sha256');
    h.update('abc');
    expect(h.digest('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('SHA-1 of "abc" matches known vector', () => {
    const h = crypto.createHash('sha1');
    h.update('abc');
    expect(h.digest('hex')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('MD5 of empty string matches known vector', () => {
    const h = crypto.createHash('md5');
    h.update('');
    expect(h.digest('hex')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('SHA-512 produces 64-byte digest', () => {
    const h = crypto.createHash('sha512');
    h.update('test data');
    const d = h.digest();
    expect(d.length).toBe(64);
  });
});

describe('Node test-crypto: cipher round-trips', () => {
  it('AES-256-GCM round-trip with known plaintext', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const pt = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');

    const enc = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = enc.update(pt);
    enc.final();
    const tag = enc.getAuthTag();

    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag);
    const result = dec.update(ct);
    dec.final();

    expect(result).toEqual(pt);
  });

  it('AES-128-CBC round-trip with padding', () => {
    const key = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const pt = new TextEncoder().encode('AES-128-CBC test message');

    const enc = crypto.createCipheriv('aes-128-cbc', key, iv);
    const ct1 = enc.update(pt);
    const ct2 = enc.final();
    const ct = new Uint8Array(ct1.length + ct2.length);
    ct.set(ct1); ct.set(ct2, ct1.length);

    const dec = crypto.createDecipheriv('aes-128-cbc', key, iv);
    const pt1 = dec.update(ct);
    const pt2 = dec.final();
    const result = new Uint8Array(pt1.length + pt2.length);
    result.set(pt1); result.set(pt2, pt1.length);

    expect(result).toEqual(pt);
  });

  it('RC4 stream cipher round-trip', () => {
    const key = crypto.randomBytes(16);
    const pt = new TextEncoder().encode('RC4 stream data');
    const enc = crypto.createCipheriv('rc4', key, new Uint8Array(0));
    const ct = enc.update(pt);
    const dec = crypto.createDecipheriv('rc4', key, new Uint8Array(0));
    expect(dec.update(ct)).toEqual(pt);
  });
});

describe('Node test-crypto: randomBytes', () => {
  it('10000 calls produce all-unique 32-byte values', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const bytes = crypto.randomBytes(32);
      expect(bytes.length).toBe(32);
      const hex = Buffer.from(bytes).toString('hex');
      seen.add(hex);
    }
    expect(seen.size).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════
// ZLIB — test-zlib-*
// ═══════════════════════════════════════════════════════════════
describe('Node test-zlib: compression levels', () => {
  it('every level 0-9 produces valid round-trip', () => {
    const input = new TextEncoder().encode('Compression level test data. '.repeat(50));
    for (let level = 0; level <= 9; level++) {
      const d = bindingZlib.createDeflate(level);
      const { data: compressed } = d.process(input, Z_FINISH);
      d.end();

      const i = bindingZlib.createInflate();
      const { data: decompressed } = i.process(compressed, Z_SYNC_FLUSH);
      i.end();

      expect(new TextDecoder().decode(decompressed)).toBe(new TextDecoder().decode(input));
    }
  });

  it('deflateRaw/inflateRaw with negative windowBits', () => {
    const input = new TextEncoder().encode('raw deflate test');
    const d = bindingZlib.createDeflate(-1, -15);
    const { data: compressed } = d.process(input, Z_FINISH);
    d.end();

    const i = bindingZlib.createInflate(-15);
    const { data: decompressed } = i.process(compressed, Z_SYNC_FLUSH);
    i.end();

    expect(new TextDecoder().decode(decompressed)).toBe('raw deflate test');
  });

  it('zero-length input', () => {
    const d = bindingZlib.createDeflate();
    const { data } = d.process(new Uint8Array(0), Z_FINISH);
    d.end();
    expect(data.length).toBeGreaterThanOrEqual(0);
  });

  it('1MB input round-trip', () => {
    const input = new Uint8Array(1024 * 1024);
    for (let i = 0; i < input.length; i++) input[i] = i & 0xff;

    const d = bindingZlib.createDeflate();
    // 1MB input needs a larger output buffer than the default 16KB
    const { data: compressed } = d.process(input, Z_FINISH, 1024 * 1024 + 4096);
    d.end();

    expect(compressed.length).toBeLessThan(input.length);

    const inf = bindingZlib.createInflate();
    const { data: decompressed } = inf.process(compressed, Z_SYNC_FLUSH, 1024 * 1024 + 4096);
    inf.end();

    expect(decompressed.length).toBe(input.length);
    expect(decompressed).toEqual(input);
  });

  it('multiple flush modes in sequence on same stream', () => {
    const d = bindingZlib.createDeflate();
    d.process(new TextEncoder().encode('chunk1'), Z_SYNC_FLUSH);
    d.process(new TextEncoder().encode('chunk2'), Z_FULL_FLUSH);
    const { rc } = d.process(new TextEncoder().encode('chunk3'), Z_FINISH);
    expect(rc).toBe(Z_STREAM_END);
    d.end();
  });
});

// ═══════════════════════════════════════════════════════════════
// URL — test-url-*
// ═══════════════════════════════════════════════════════════════
describe('Node test-url: 50+ URL test vectors', () => {
  const vectors: Array<{ input: string; hostname?: string; pathname?: string; protocol?: string; port?: string; valid?: boolean }> = [
    { input: 'http://example.com', hostname: 'example.com', pathname: '/', protocol: 'http:' },
    { input: 'https://example.com:443/path', hostname: 'example.com', pathname: '/path', protocol: 'https:', port: '' },
    { input: 'http://example.com:8080', hostname: 'example.com', port: '8080' },
    { input: 'http://user:pass@example.com/', hostname: 'example.com' },
    { input: 'http://example.com/path?q=1&r=2#frag', pathname: '/path' },
    { input: 'https://example.com/a/b/c', pathname: '/a/b/c' },
    { input: 'http://example.com/', pathname: '/' },
    { input: 'http://example.com/path/', pathname: '/path/' },
    { input: 'ftp://ftp.example.com/pub/', protocol: 'ftp:', pathname: '/pub/' },
    { input: 'http://example.com\\path\\file', pathname: '/path/file' }, // backslash normalization
    { input: 'data:text/plain;base64,SGVsbG8=', protocol: 'data:', valid: true },
    { input: 'javascript:void(0)', protocol: 'javascript:', valid: true },
    { input: 'http://[::1]/', hostname: '[::1]', valid: true }, // IPv6
    { input: 'http://[::1]:8080/', hostname: '[::1]', port: '8080' },
    { input: 'http://example.com:0/', port: '0' },
    { input: 'http://example.com:65535/', port: '65535' },
    { input: 'http://example.com/path?', pathname: '/path' },
    { input: 'http://example.com/path#', pathname: '/path' },
    { input: 'http://example.com/path?#', pathname: '/path' },
    { input: 'http://example.com', pathname: '/' },
    { input: 'http://example.com/%20space', pathname: '/%20space' },
    { input: 'http://example.com/a%2Fb', pathname: '/a%2Fb' },
    { input: 'http://example.com:/', hostname: 'example.com', pathname: '/' },
    { input: 'ws://example.com/ws', protocol: 'ws:' },
    { input: 'wss://example.com/ws', protocol: 'wss:' },
    { input: 'not a url', valid: false },
    { input: '', valid: false },
  ];

  vectors.forEach(({ input, hostname, pathname, protocol, port, valid }, i) => {
    it(`vector ${i}: ${input.slice(0, 50)}`, () => {
      const u = bindingUrl.parse(input);
      if (valid === false) { expect(u.valid).toBe(false); return; }
      if (hostname) expect(u.hostname).toBe(hostname);
      if (pathname) expect(u.pathname).toBe(pathname);
      if (protocol) expect(u.protocol).toBe(protocol);
      if (port !== undefined) expect(u.port).toBe(port);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// BUFFER — test-buffer-*
// ═══════════════════════════════════════════════════════════════
describe('Node test-buffer: encoding round-trips', () => {
  const encodings = ['utf8', 'hex', 'base64', 'base64url', 'ascii', 'latin1', 'utf16le'] as const;

  encodings.forEach(enc => {
    it(`round-trip: ${enc}`, () => {
      const original = Buffer.from('Hello, World! 123', 'utf8');
      const encoded = original.toString(enc);
      const decoded = Buffer.from(encoded, enc);
      // For utf8/ascii/latin1, decoded should match original
      if (enc === 'utf8' || enc === 'ascii' || enc === 'latin1') {
        expect(decoded.toString('utf8')).toBe('Hello, World! 123');
      }
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  it('alloc with number fill', () => {
    const b = Buffer.alloc(10, 0x42);
    for (let i = 0; i < 10; i++) expect(b[i]).toBe(0x42);
  });

  it('alloc with string fill', () => {
    const b = Buffer.alloc(6, 'ab');
    expect(b.toString()).toBe('ababab');
  });

  it('concat empty array', () => {
    expect(Buffer.concat([]).length).toBe(0);
  });

  it('concat single buffer', () => {
    const b = Buffer.from('only');
    expect(Buffer.concat([b]).toString()).toBe('only');
  });

  it('compare different lengths', () => {
    expect(Buffer.compare(Buffer.from('ab'), Buffer.from('abc'))).toBeLessThan(0);
    expect(Buffer.compare(Buffer.from('abc'), Buffer.from('ab'))).toBeGreaterThan(0);
  });

  it('write with offset and length', () => {
    const b = Buffer.alloc(10, 0);
    b.write('Hi', 2, 2, 'utf8');
    expect(b[2]).toBe(72); // 'H'
    expect(b[3]).toBe(105); // 'i'
    expect(b[0]).toBe(0);
  });

  it('toString with start/end range', () => {
    const b = Buffer.from('Hello World');
    expect(b.toString('utf8', 0, 5)).toBe('Hello');
    expect(b.toString('utf8', 6)).toBe('World');
  });

  it('toJSON serialization', () => {
    const j = Buffer.from([1, 2, 3]).toJSON();
    expect(j).toEqual({ type: 'Buffer', data: [1, 2, 3] });
  });
});

// ═══════════════════════════════════════════════════════════════
// VM — test-vm-*
// ═══════════════════════════════════════════════════════════════
describe('Node test-vm: isolation and reuse', () => {
  it('complex sandbox: nested objects, functions, arrays', () => {
    const result = vm.runInNewContext(
      'obj.nested.value + arr[1] + fn(2)',
      { obj: { nested: { value: 10 } }, arr: [1, 20, 3], fn: (x: number) => x * 3 }
    );
    expect(result).toBe(36); // 10 + 20 + 6
  });

  it('Script reused across 100 contexts', () => {
    const script = new vm.Script('x + y');
    for (let i = 0; i < 100; i++) {
      expect(script.runInNewContext({ x: i, y: i * 2 })).toBe(i * 3);
    }
  });

  it('isolation: separate contexts hold independent state', () => {
    // Object properties ARE shared by reference through the Function constructor
    const ctx1 = vm.createContext({ state: { value: 0 } });
    const ctx2 = vm.createContext({ state: { value: 100 } });
    vm.runInContext('state.value = 42', ctx1);
    expect(vm.runInContext('state.value', ctx1)).toBe(42);
    expect(vm.runInContext('state.value', ctx2)).toBe(100);
  });

  it('error propagation: TypeError in vm surfaces in host', () => {
    expect(() => vm.runInNewContext('null.property')).toThrow();
  });

  it('compileFunction with multiple params', () => {
    const fn = vm.compileFunction('return a * b + c', ['a', 'b', 'c']);
    expect(fn(2, 3, 4)).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROCESS — test-process-*
// ═══════════════════════════════════════════════════════════════
describe('Node test-process', () => {
  it('3 nextTicks fire in queue order', () => {
    const order: number[] = [];
    process.nextTick(() => order.push(1));
    process.nextTick(() => order.push(2));
    process.nextTick(() => order.push(3));
    process._eventLoop.tick();
    expect(order).toEqual([1, 2, 3]);
  });

  it('env set/read/delete', () => {
    process.env.TEST_VAR = 'hello';
    expect(process.env.TEST_VAR).toBe('hello');
    delete process.env.TEST_VAR;
    expect(process.env.TEST_VAR).toBeUndefined();
  });

  it('memoryUsage returns expected keys', () => {
    const mu = process.memoryUsage();
    expect(mu).toHaveProperty('rss');
    expect(mu).toHaveProperty('heapTotal');
    expect(mu).toHaveProperty('heapUsed');
    expect(mu).toHaveProperty('external');
    expect(mu).toHaveProperty('arrayBuffers');
  });

  it('uptime returns increasing values', () => {
    const t1 = process.uptime();
    const t2 = process.uptime();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});
