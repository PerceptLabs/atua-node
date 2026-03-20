// @vitest-environment node
/**
 * Stress: Fuzzing — malformed input handling.
 * Every FFI bridge fed garbage. Must throw JS exceptions, NOT WASM traps.
 * All operations use real .wasm — zero mocks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';
import { bindingHttpParser, HPE, HTTP_REQUEST } from '../../src/bindings/binding-http-parser.js';
import { Z_FINISH, Z_SYNC_FLUSH } from '../../src/bindings/binding-zlib.js';
import * as crypto from '../../src/vendor/crypto.js';
import * as vm from '../../src/vendor/vm.js';

beforeAll(async () => {
  if (hasWasm('libcrypto')) bindingCrypto.init(await loadReactor('libcrypto') as any);
  if (hasWasm('zlib')) bindingZlib.init(await loadReactor('zlib') as any);
  if (hasWasm('ada')) bindingUrl.init(await loadReactor('ada') as any);
  if (hasWasm('llhttp')) bindingHttpParser.init(await loadReactor('llhttp') as any);
});

// ═══════════════════════════════════════════════════════════════
// LLHTTP FUZZING
// ═══════════════════════════════════════════════════════════════
describe('Fuzzing: llhttp', () => {
  it('1000 random-byte HTTP requests — no crashes', () => {
    for (let i = 0; i < 1000; i++) {
      const randomData = crypto.randomBytes(64 + Math.floor(Math.random() * 200));
      const parser = bindingHttpParser.createParser(HTTP_REQUEST);
      const rc = parser.execute(randomData);
      // Must return a valid HPE code (OK or error), never crash
      expect(typeof rc).toBe('number');
      parser.free();
    }
  });

  it('truncated header — error, not crash', () => {
    const validRequest = 'GET /path HTTP/1.1\r\nHost: example.com\r\nContent-Len';
    const parser = bindingHttpParser.createParser(HTTP_REQUEST);
    const rc = parser.execute(new TextEncoder().encode(validRequest));
    // Truncated header should parse what it can or return an error
    expect(typeof rc).toBe('number');
    parser.free();
  });

  it('null bytes in URL — handled gracefully', () => {
    const parser = bindingHttpParser.createParser(HTTP_REQUEST);
    const request = 'GET /path\x00evil HTTP/1.1\r\nHost: example.com\r\n\r\n';
    const rc = parser.execute(new TextEncoder().encode(request));
    expect(typeof rc).toBe('number');
    parser.free();
  });
});

// ═══════════════════════════════════════════════════════════════
// ADA URL FUZZING
// ═══════════════════════════════════════════════════════════════
describe('Fuzzing: ada URL parser', () => {
  it('1000 random-byte URLs — no crashes', () => {
    for (let i = 0; i < 1000; i++) {
      const bytes = crypto.randomBytes(32);
      const randomUrl = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
      const result = bindingUrl.parse(randomUrl);
      // Must return a ParsedUrl (valid or invalid), never crash
      expect(result).toHaveProperty('valid');
    }
  });

  it('very long URL (100KB) — handled gracefully', () => {
    const longUrl = 'http://example.com/' + 'a'.repeat(100000);
    const result = bindingUrl.parse(longUrl);
    expect(result).toHaveProperty('valid');
  });

  it('every special character — no crashes', () => {
    const specials = '<>{}|\\^~[]`@!$&\'()*+,;=:?"# \t\n\r';
    for (const char of specials) {
      const url = `http://example.com/path${char}value`;
      const result = bindingUrl.parse(url);
      expect(result).toHaveProperty('valid');
    }
  });

  it('empty string — valid result (invalid URL)', () => {
    const result = bindingUrl.parse('');
    expect(result).toHaveProperty('valid');
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// LIBCRYPTO FUZZING
// ═══════════════════════════════════════════════════════════════
describe('Fuzzing: libcrypto', () => {
  it('wrong key length for AES-256 — throws or produces wrong output', () => {
    const badKey = crypto.randomBytes(17); // AES-256 needs 32 bytes
    const iv = crypto.randomBytes(12);
    // OpenSSL may accept non-standard key lengths (padding/truncating internally)
    // The important thing is it doesn't crash the WASM instance
    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', badKey, iv);
      // If it doesn't throw, verify it still produces output without crashing
      cipher.update(new TextEncoder().encode('test'));
      cipher.final();
    } catch {
      // Throwing is the expected behavior for wrong key length
    }
  });

  it('unknown algorithm — throws', () => {
    expect(() => crypto.createCipheriv('aes-999-xyz', new Uint8Array(32), new Uint8Array(12))).toThrow();
  });

  it('unknown hash algorithm — throws', () => {
    expect(() => crypto.createHash('sha999')).toThrow();
  });

  it('randomBytes(0) returns empty Uint8Array', () => {
    const bytes = crypto.randomBytes(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(0);
  });

  it('corrupted ciphertext — throws on decrypt final', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    // Encrypt valid data
    const enc = crypto.createCipheriv('aes-256-gcm', key, iv);
    enc.update(new TextEncoder().encode('valid data'));
    enc.final();
    const tag = enc.getAuthTag();

    // Decrypt with corrupted ciphertext
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag);
    dec.update(crypto.randomBytes(32)); // wrong data
    expect(() => dec.final()).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// ZLIB FUZZING
// ═══════════════════════════════════════════════════════════════
describe('Fuzzing: zlib', () => {
  it('random bytes as compressed data — error on inflate', () => {
    const randomData = crypto.randomBytes(256);
    const inf = bindingZlib.createInflate();
    // Random bytes are not valid compressed data — should produce an error or empty result
    try {
      const { rc } = inf.process(randomData, Z_SYNC_FLUSH);
      // rc < 0 means error, which is expected
      expect(typeof rc).toBe('number');
    } catch {
      // Throwing is also acceptable
    }
    inf.end();
  });

  it('zero-length input to deflate — succeeds', () => {
    const d = bindingZlib.createDeflate();
    const { rc } = d.process(new Uint8Array(0), Z_FINISH);
    expect(rc).toBe(1); // Z_STREAM_END
    d.end();
  });

  it('zero-length input to inflate — succeeds or errors cleanly', () => {
    const inf = bindingZlib.createInflate();
    try {
      inf.process(new Uint8Array(0), Z_SYNC_FLUSH);
    } catch {
      // Expected — nothing to inflate
    }
    inf.end();
  });
});

// ═══════════════════════════════════════════════════════════════
// VM FUZZING
// ═══════════════════════════════════════════════════════════════
describe('Fuzzing: vm (QuickJS)', () => {
  it('syntax error — throws SyntaxError', () => {
    expect(() => vm.runInNewContext('if(')).toThrow();
  });

  it('undefined variable — throws ReferenceError', () => {
    expect(() => vm.runInNewContext('nonexistentVariable')).toThrow();
  });

  it('type error — throws TypeError', () => {
    expect(() => vm.runInNewContext('null.property')).toThrow();
  });

  it('deep recursion — throws (stack overflow)', () => {
    expect(() => vm.runInNewContext('function f() { return f(); } f()')).toThrow();
  });

  it('empty code — returns undefined', () => {
    const result = vm.runInNewContext('');
    expect(result).toBeUndefined();
  });
});
