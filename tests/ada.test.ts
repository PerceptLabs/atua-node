import { describe, it, expect, beforeEach } from 'vitest';
import { BindingUrl, UrlParser, type AdaExports, type ParsedUrl } from '../src/bindings/binding-url.js';

/**
 * Mock ada WASM exports.
 * Simulates WHATWG URL parsing using the browser's URL constructor,
 * with Ada-specific normalization behaviors.
 */
function createMockAdaExports(): AdaExports {
  const memoryBuffer = new ArrayBuffer(256 * 1024);
  let nextAlloc = 4096;
  const memory = { buffer: memoryBuffer } as WebAssembly.Memory;

  // Store parsed URLs by result pointer
  const results = new Map<number, { url: URL | null; input: string }>();

  function malloc(size: number): number {
    const ptr = nextAlloc;
    nextAlloc += Math.max(size, 4);
    nextAlloc = (nextAlloc + 3) & ~3;
    return ptr;
  }

  function writeString(str: string): { ptr: number; len: number } {
    const encoded = new TextEncoder().encode(str);
    const ptr = malloc(encoded.length);
    new Uint8Array(memoryBuffer, ptr, encoded.length).set(encoded);
    return { ptr, len: encoded.length };
  }

  function makeGetter(field: (url: URL) => string) {
    return (result: number, outLenPtr: number): number => {
      const entry = results.get(result);
      if (!entry?.url) {
        new Uint32Array(memoryBuffer, outLenPtr, 1)[0] = 0;
        return 0;
      }
      const value = field(entry.url);
      const { ptr, len } = writeString(value);
      new Uint32Array(memoryBuffer, outLenPtr, 1)[0] = len;
      return ptr;
    };
  }

  const exports: AdaExports = {
    memory,
    malloc,
    free: () => {},

    ada_parse(inputPtr: number, inputLen: number): number {
      const input = new TextDecoder().decode(new Uint8Array(memoryBuffer, inputPtr, inputLen));

      // Ada normalizations:
      // 1. Backslash → forward slash in special schemes
      let normalized = input;
      if (/^(https?|ftp|ws|wss):/.test(normalized)) {
        normalized = normalized.replace(/\\/g, '/');
      }

      const resultPtr = malloc(4);
      try {
        const url = new URL(normalized);
        results.set(resultPtr, { url, input: normalized });
      } catch {
        results.set(resultPtr, { url: null, input: normalized });
      }
      return resultPtr;
    },

    ada_free(result: number): void {
      results.delete(result);
    },

    ada_is_valid(result: number): number {
      return results.get(result)?.url ? 1 : 0;
    },

    ada_get_href: makeGetter(u => u.href),
    ada_get_protocol: makeGetter(u => u.protocol),
    ada_get_hostname: makeGetter(u => u.hostname),
    ada_get_port: makeGetter(u => u.port),
    ada_get_pathname: makeGetter(u => u.pathname),
    ada_get_search: makeGetter(u => u.search),
    ada_get_hash: makeGetter(u => u.hash),
    ada_get_username: makeGetter(u => u.username),
    ada_get_password: makeGetter(u => u.password),
    ada_get_origin: makeGetter(u => u.origin),
  };

  return exports;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('BindingUrl (ada)', () => {
  let binding: BindingUrl;

  beforeEach(() => {
    binding = new BindingUrl();
    binding.init(createMockAdaExports());
  });

  it('should report ready after init', () => {
    expect(binding.isReady).toBe(true);
  });

  it('should throw if not initialized', () => {
    const uninit = new BindingUrl();
    expect(() => uninit.parse('http://example.com')).toThrow('not initialized');
  });

  describe('Basic URL parsing', () => {
    it('should parse a simple HTTP URL', () => {
      const url = binding.parse('http://example.com/path?q=1#hash');
      expect(url.valid).toBe(true);
      expect(url.protocol).toBe('http:');
      expect(url.hostname).toBe('example.com');
      expect(url.pathname).toBe('/path');
      expect(url.search).toBe('?q=1');
      expect(url.hash).toBe('#hash');
    });

    it('should parse HTTPS URL with port', () => {
      const url = binding.parse('https://example.com:8443/api');
      expect(url.valid).toBe(true);
      expect(url.protocol).toBe('https:');
      expect(url.port).toBe('8443');
      expect(url.pathname).toBe('/api');
    });

    it('should parse URL with credentials', () => {
      const url = binding.parse('http://user:pass@example.com/');
      expect(url.valid).toBe(true);
      expect(url.username).toBe('user');
      expect(url.password).toBe('pass');
    });
  });

  describe('IDN normalization', () => {
    it('should handle internationalized domain names', () => {
      // IDN handling depends on the URL parser implementation
      const url = binding.parse('http://例え.jp/path');
      expect(url.valid).toBe(true);
      expect(url.hostname).toBeTruthy();
    });
  });

  describe('Backslash normalization', () => {
    it('should normalize backslashes to forward slashes in HTTP URLs', () => {
      const url = binding.parse('http://example.com\\path\\to\\resource');
      expect(url.valid).toBe(true);
      expect(url.pathname).toBe('/path/to/resource');
    });

    it('should normalize backslashes in HTTPS URLs', () => {
      const url = binding.parse('https://example.com\\api\\v2');
      expect(url.valid).toBe(true);
      expect(url.pathname).toBe('/api/v2');
    });
  });

  describe('Opaque paths', () => {
    it('should handle data URLs', () => {
      const url = binding.parse('data:text/plain;base64,SGVsbG8=');
      expect(url.valid).toBe(true);
      expect(url.protocol).toBe('data:');
    });

    it('should handle javascript URLs', () => {
      const url = binding.parse('javascript:void(0)');
      expect(url.valid).toBe(true);
      expect(url.protocol).toBe('javascript:');
    });
  });

  describe('Invalid URLs', () => {
    it('should mark invalid URLs as not valid', () => {
      const url = binding.parse('not a url');
      expect(url.valid).toBe(false);
    });
  });

  describe('Origin computation', () => {
    it('should compute origin for HTTP URLs', () => {
      const url = binding.parse('http://example.com:8080/path');
      expect(url.origin).toBe('http://example.com:8080');
    });
  });
});
