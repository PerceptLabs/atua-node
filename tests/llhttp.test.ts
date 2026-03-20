import { describe, it, expect, beforeEach } from 'vitest';
import {
  BindingHttpParser, HttpParser, HPE, HTTP_REQUEST, HTTP_RESPONSE,
  type LlhttpExports,
} from '../src/bindings/binding-http-parser.js';

/**
 * Mock llhttp WASM exports.
 * Simulates HTTP parsing by extracting method, URL, headers from raw text.
 */
function createMockLlhttpExports(): LlhttpExports {
  const memoryBuffer = new ArrayBuffer(256 * 1024);
  let nextAlloc = 4096;
  const memory = { buffer: memoryBuffer } as WebAssembly.Memory;

  // Parser state per parser ptr
  const parsers = new Map<number, {
    type: number;
    method: number;
    statusCode: number;
    httpMajor: number;
    httpMinor: number;
    upgrade: number;
    error: HPE;
    errorReason: string;
    url: string;
    headers: Array<[string, string]>;
    body: string;
  }>();

  const METHODS: Record<string, number> = {
    'DELETE': 0, 'GET': 1, 'HEAD': 2, 'POST': 3, 'PUT': 4,
    'CONNECT': 5, 'OPTIONS': 6, 'TRACE': 7, 'PATCH': 8,
  };

  function malloc(size: number): number {
    const ptr = nextAlloc;
    nextAlloc += Math.max(size, 4);
    nextAlloc = (nextAlloc + 3) & ~3;
    return ptr;
  }

  const exports: LlhttpExports = {
    memory,
    malloc,
    free: () => {},
    sizeof_llhttp: () => 256,

    llhttp_init(parser: number, type: number): void {
      parsers.set(parser, {
        type,
        method: 1, // GET
        statusCode: 0,
        httpMajor: 1,
        httpMinor: 1,
        upgrade: 0,
        error: HPE.OK,
        errorReason: '',
        url: '',
        headers: [],
        body: '',
      });
    },

    llhttp_execute(parser: number, dataPtr: number, len: number): number {
      const state = parsers.get(parser);
      if (!state) return HPE.INTERNAL;

      const raw = new TextDecoder().decode(new Uint8Array(memoryBuffer, dataPtr, len));
      const lines = raw.split('\r\n');

      if (lines.length === 0) return HPE.INTERNAL;

      // Parse request/status line
      const firstLine = lines[0];

      if (state.type === HTTP_REQUEST) {
        const match = firstLine.match(/^(\w+)\s+(\S+)\s+HTTP\/(\d)\.(\d)/);
        if (!match) {
          // Check for specific error types
          if (/^[^A-Z]/.test(firstLine)) {
            state.error = HPE.INVALID_METHOD;
            state.errorReason = 'Invalid method';
            return HPE.INVALID_METHOD;
          }
          state.error = HPE.INVALID_URL;
          state.errorReason = 'Invalid request line';
          return HPE.INVALID_URL;
        }

        const [, method, url, major, minor] = match;
        const methodNum = METHODS[method.toUpperCase()];
        if (methodNum === undefined) {
          state.error = HPE.INVALID_METHOD;
          state.errorReason = `Unknown method: ${method}`;
          return HPE.INVALID_METHOD;
        }

        state.method = methodNum;
        state.url = url;
        state.httpMajor = parseInt(major);
        state.httpMinor = parseInt(minor);
      } else {
        // HTTP response
        const match = firstLine.match(/^HTTP\/(\d)\.(\d)\s+(\d+)\s*(.*)/);
        if (!match) {
          state.error = HPE.INVALID_STATUS;
          return HPE.INVALID_STATUS;
        }
        state.httpMajor = parseInt(match[1]);
        state.httpMinor = parseInt(match[2]);
        state.statusCode = parseInt(match[3]);
      }

      // Parse headers
      state.headers = [];
      let bodyStart = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '') {
          bodyStart = i + 1;
          break;
        }
        const colonIdx = lines[i].indexOf(':');
        if (colonIdx === -1) {
          // Check for invalid header token
          if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(lines[i])) {
            state.error = HPE.INVALID_HEADER_TOKEN;
            state.errorReason = 'Invalid header token';
            return HPE.INVALID_HEADER_TOKEN;
          }
          continue;
        }
        const field = lines[i].substring(0, colonIdx).trim();
        const value = lines[i].substring(colonIdx + 1).trim();

        // Check for invalid header token characters
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(field)) {
          state.error = HPE.INVALID_HEADER_TOKEN;
          state.errorReason = 'Invalid character in header field';
          return HPE.INVALID_HEADER_TOKEN;
        }

        state.headers.push([field, value]);
      }

      // Check for duplicate Content-Length with different values
      const contentLengths = state.headers
        .filter(([k]) => k.toLowerCase() === 'content-length')
        .map(([, v]) => v);
      if (contentLengths.length > 1 && new Set(contentLengths).size > 1) {
        state.error = HPE.UNEXPECTED_CONTENT_LENGTH;
        state.errorReason = 'Unexpected content-length';
        return HPE.UNEXPECTED_CONTENT_LENGTH;
      }

      // Body
      if (bodyStart >= 0 && bodyStart < lines.length) {
        state.body = lines.slice(bodyStart).join('\r\n');
      }

      // Check for chunked encoding
      const transferEncoding = state.headers.find(
        ([k]) => k.toLowerCase() === 'transfer-encoding'
      );
      if (transferEncoding && transferEncoding[1].toLowerCase() === 'chunked') {
        // Parse chunked body — just verify the format is valid
        // In real llhttp, this would be handled incrementally
      }

      return HPE.OK;
    },

    llhttp_finish(parser: number): number {
      const state = parsers.get(parser);
      if (!state) return HPE.INTERNAL;
      return state.error;
    },

    llhttp_get_error_reason(parser: number): number {
      const state = parsers.get(parser);
      if (!state) return 0;
      const ptr = malloc(state.errorReason.length + 1);
      const encoded = new TextEncoder().encode(state.errorReason + '\0');
      new Uint8Array(memoryBuffer, ptr, encoded.length).set(encoded);
      return ptr;
    },

    llhttp_get_method(parser: number): number {
      return parsers.get(parser)?.method ?? 0;
    },

    llhttp_get_status_code(parser: number): number {
      return parsers.get(parser)?.statusCode ?? 0;
    },

    llhttp_get_http_major(parser: number): number {
      return parsers.get(parser)?.httpMajor ?? 1;
    },

    llhttp_get_http_minor(parser: number): number {
      return parsers.get(parser)?.httpMinor ?? 1;
    },

    llhttp_get_upgrade(parser: number): number {
      return parsers.get(parser)?.upgrade ?? 0;
    },
  };

  return exports;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('BindingHttpParser (llhttp)', () => {
  let binding: BindingHttpParser;
  let mockExports: LlhttpExports;

  beforeEach(() => {
    binding = new BindingHttpParser();
    mockExports = createMockLlhttpExports();
    binding.init(mockExports);
  });

  it('should report ready after init', () => {
    expect(binding.isReady).toBe(true);
  });

  it('should throw if not initialized', () => {
    const uninit = new BindingHttpParser();
    expect(() => uninit.createParser(HTTP_REQUEST)).toThrow('not initialized');
  });

  describe('Parse GET request', () => {
    it('should parse a valid GET request', () => {
      const parser = binding.createParser(HTTP_REQUEST);
      const request = 'GET /path?q=1 HTTP/1.1\r\nHost: example.com\r\nAccept: text/html\r\n\r\n';
      const rc = parser.execute(new TextEncoder().encode(request));

      expect(rc).toBe(HPE.OK);
      expect(parser.message.method).toBe('GET');
      expect(parser.message.versionMajor).toBe(1);
      expect(parser.message.versionMinor).toBe(1);
      parser.free();
    });
  });

  describe('Parse POST request', () => {
    it('should parse a POST with body', () => {
      const parser = binding.createParser(HTTP_REQUEST);
      const request = 'POST /api/data HTTP/1.1\r\nHost: api.example.com\r\nContent-Type: application/json\r\nContent-Length: 13\r\n\r\n{"key":"val"}';
      const rc = parser.execute(new TextEncoder().encode(request));

      expect(rc).toBe(HPE.OK);
      expect(parser.message.method).toBe('POST');
      parser.free();
    });
  });

  describe('Malformed request error codes', () => {
    it('should return HPE_INVALID_HEADER_TOKEN for invalid header characters', () => {
      const parser = binding.createParser(HTTP_REQUEST);
      const request = 'GET / HTTP/1.1\r\nBad\x01Header: value\r\n\r\n';
      const rc = parser.execute(new TextEncoder().encode(request));

      expect(rc).toBe(HPE.INVALID_HEADER_TOKEN);
      parser.free();
    });

    it('should return HPE_UNEXPECTED_CONTENT_LENGTH for conflicting content-lengths', () => {
      const parser = binding.createParser(HTTP_REQUEST);
      const request = 'GET / HTTP/1.1\r\nContent-Length: 5\r\nContent-Length: 10\r\n\r\n';
      const rc = parser.execute(new TextEncoder().encode(request));

      expect(rc).toBe(HPE.UNEXPECTED_CONTENT_LENGTH);
      parser.free();
    });

    it('should return HPE_INVALID_METHOD for invalid method', () => {
      const parser = binding.createParser(HTTP_REQUEST);
      const request = '123INVALID / HTTP/1.1\r\n\r\n';
      const rc = parser.execute(new TextEncoder().encode(request));

      expect(rc).toBe(HPE.INVALID_METHOD);
      parser.free();
    });
  });

  describe('Chunked encoding', () => {
    it('should accept chunked transfer-encoding', () => {
      const parser = binding.createParser(HTTP_REQUEST);
      const request = 'POST /upload HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n';
      const rc = parser.execute(new TextEncoder().encode(request));

      expect(rc).toBe(HPE.OK);
      parser.free();
    });
  });

  describe('HTTP response parsing', () => {
    it('should parse an HTTP response', () => {
      const parser = binding.createParser(HTTP_RESPONSE);
      const response = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 5\r\n\r\nhello';
      const rc = parser.execute(new TextEncoder().encode(response));

      expect(rc).toBe(HPE.OK);
      expect(parser.message.statusCode).toBe(200);
      expect(parser.message.versionMajor).toBe(1);
      expect(parser.message.versionMinor).toBe(1);
      parser.free();
    });
  });

  describe('Parser reset', () => {
    it('should allow parsing multiple messages via reset', () => {
      const parser = binding.createParser(HTTP_REQUEST);

      const req1 = 'GET /first HTTP/1.1\r\nHost: a.com\r\n\r\n';
      expect(parser.execute(new TextEncoder().encode(req1))).toBe(HPE.OK);
      expect(parser.message.method).toBe('GET');

      parser.reset(HTTP_REQUEST);

      const req2 = 'POST /second HTTP/1.1\r\nHost: b.com\r\n\r\n';
      expect(parser.execute(new TextEncoder().encode(req2))).toBe(HPE.OK);
      expect(parser.message.method).toBe('POST');

      parser.free();
    });
  });
});
