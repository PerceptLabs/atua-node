import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BindingZlib, ZlibStream, type ZlibExports,
  Z_NO_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_PARTIAL_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END, Z_DEFAULT_COMPRESSION, Z_BEST_SPEED, Z_BEST_COMPRESSION,
  Z_DEFAULT_STRATEGY, Z_FILTERED,
} from '../src/bindings/binding-zlib.js';

/**
 * Mock zlib WASM exports.
 *
 * Simulates zlib deflate/inflate using a simple identity transform
 * with a header byte indicating the flush mode. This allows testing
 * the FFI bridge logic without real zlib compilation.
 */
function createMockZlibExports(): ZlibExports {
  const memoryBuffer = new ArrayBuffer(512 * 1024); // 512KB
  let nextAlloc = 4096;

  const memory = { buffer: memoryBuffer } as WebAssembly.Memory;

  // Track stream states
  const streams = new Map<number, {
    mode: 'deflate' | 'inflate';
    level: number;
    windowBits: number;
    strategy: number;
    ended: boolean;
  }>();

  function malloc(size: number): number {
    const ptr = nextAlloc;
    nextAlloc += Math.max(size, 4);
    nextAlloc = (nextAlloc + 3) & ~3;
    return ptr;
  }

  // z_stream field offsets
  const NEXT_IN = 0, AVAIL_IN = 4, NEXT_OUT = 12, AVAIL_OUT = 16;

  function readU32(ptr: number, offset: number): number {
    return new Uint32Array(memoryBuffer, ptr + offset, 1)[0];
  }
  function writeU32(ptr: number, offset: number, val: number): void {
    new Uint32Array(memoryBuffer, ptr + offset, 1)[0] = val;
  }

  const exports: ZlibExports = {
    memory,
    malloc,
    free: () => {},
    sizeof_z_stream: () => 64,

    deflateInit2(strm, level, _method, windowBits, _memLevel, strategy): number {
      streams.set(strm, { mode: 'deflate', level, windowBits, strategy, ended: false });
      return Z_OK;
    },

    deflate(strm, flush): number {
      const state = streams.get(strm);
      if (!state) return -2;

      const nextIn = readU32(strm, NEXT_IN);
      const availIn = readU32(strm, AVAIL_IN);
      const nextOut = readU32(strm, NEXT_OUT);
      const availOut = readU32(strm, AVAIL_OUT);

      // Mock compression: copy input to output with a 2-byte header
      // [flush_mode, windowBits, ...data]
      const headerSize = 2;
      const toCopy = Math.min(availIn, availOut - headerSize);

      if (availOut < headerSize + toCopy) {
        return -5; // Z_BUF_ERROR
      }

      // Write header
      new Uint8Array(memoryBuffer, nextOut, 1)[0] = flush;
      new Uint8Array(memoryBuffer, nextOut + 1, 1)[0] = state.windowBits & 0xff;

      // Copy data
      if (toCopy > 0) {
        const src = new Uint8Array(memoryBuffer, nextIn, toCopy);
        new Uint8Array(memoryBuffer, nextOut + headerSize, toCopy).set(src);
      }

      // Update avail_out
      writeU32(strm, AVAIL_OUT, availOut - headerSize - toCopy);
      writeU32(strm, AVAIL_IN, availIn - toCopy);

      if (flush === Z_FINISH) {
        state.ended = true;
        return Z_STREAM_END;
      }

      return Z_OK;
    },

    deflateEnd(strm): number {
      streams.delete(strm);
      return Z_OK;
    },

    deflateParams(strm, level, strategy): number {
      const state = streams.get(strm);
      if (!state) return -2;
      state.level = level;
      state.strategy = strategy;
      return Z_OK;
    },

    inflateInit2(strm, windowBits): number {
      streams.set(strm, { mode: 'inflate', level: 0, windowBits, strategy: 0, ended: false });
      return Z_OK;
    },

    inflate(strm, flush): number {
      const state = streams.get(strm);
      if (!state) return -2;

      const nextIn = readU32(strm, NEXT_IN);
      const availIn = readU32(strm, AVAIL_IN);
      const nextOut = readU32(strm, NEXT_OUT);
      const availOut = readU32(strm, AVAIL_OUT);

      // Mock decompression: skip 2-byte header, copy rest
      const headerSize = 2;
      if (availIn < headerSize) return -5;

      const origFlush = new Uint8Array(memoryBuffer, nextIn, 1)[0];
      const dataSize = availIn - headerSize;
      const toCopy = Math.min(dataSize, availOut);

      if (toCopy > 0) {
        const src = new Uint8Array(memoryBuffer, nextIn + headerSize, toCopy);
        new Uint8Array(memoryBuffer, nextOut, toCopy).set(src);
      }

      writeU32(strm, AVAIL_OUT, availOut - toCopy);
      writeU32(strm, AVAIL_IN, 0);

      if (origFlush === Z_FINISH) {
        state.ended = true;
        return Z_STREAM_END;
      }

      return Z_OK;
    },

    inflateEnd(strm): number {
      streams.delete(strm);
      return Z_OK;
    },
  };

  return exports;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('BindingZlib', () => {
  let binding: BindingZlib;
  let mockExports: ZlibExports;

  beforeEach(() => {
    binding = new BindingZlib();
    mockExports = createMockZlibExports();
    binding.init(mockExports);
  });

  it('should report ready after init', () => {
    expect(binding.isReady).toBe(true);
  });

  it('should throw if not initialized', () => {
    const uninit = new BindingZlib();
    expect(() => uninit.createDeflate()).toThrow('not initialized');
  });

  describe('Deflate/Inflate round-trip', () => {
    it('should compress and decompress data', () => {
      const input = new TextEncoder().encode('Hello, zlib via WASIX!');

      // Compress
      const deflate = binding.createDeflate();
      const { data: compressed, rc: drc } = deflate.process(input, Z_FINISH);
      expect(drc).toBe(Z_STREAM_END);
      expect(compressed.length).toBeGreaterThan(0);
      deflate.end();

      // Decompress
      const inflate = binding.createInflate();
      const { data: decompressed, rc: irc } = inflate.process(compressed, Z_NO_FLUSH);
      expect(irc).toBe(Z_STREAM_END); // Original flush was Z_FINISH
      expect(new TextDecoder().decode(decompressed)).toBe('Hello, zlib via WASIX!');
      inflate.end();
    });
  });

  describe('Flush modes', () => {
    it('should handle Z_SYNC_FLUSH', () => {
      const deflate = binding.createDeflate();
      const input = new TextEncoder().encode('sync flush test');
      const { rc } = deflate.process(input, Z_SYNC_FLUSH);
      expect(rc).toBe(Z_OK);
      deflate.end();
    });

    it('should handle Z_FULL_FLUSH', () => {
      const deflate = binding.createDeflate();
      const input = new TextEncoder().encode('full flush test');
      const { rc } = deflate.process(input, Z_FULL_FLUSH);
      expect(rc).toBe(Z_OK);
      deflate.end();
    });

    it('should handle Z_PARTIAL_FLUSH', () => {
      const deflate = binding.createDeflate();
      const input = new TextEncoder().encode('partial flush test');
      const { rc } = deflate.process(input, Z_PARTIAL_FLUSH);
      expect(rc).toBe(Z_OK);
      deflate.end();
    });

    it('should handle Z_FINISH', () => {
      const deflate = binding.createDeflate();
      const input = new TextEncoder().encode('finish test');
      const { rc } = deflate.process(input, Z_FINISH);
      expect(rc).toBe(Z_STREAM_END);
      expect(deflate.isEnded).toBe(true);
    });
  });

  describe('deflateParams mid-stream', () => {
    it('should change compression level mid-stream', () => {
      const deflate = binding.createDeflate(Z_BEST_SPEED);

      // Compress some data at low compression
      const input1 = new TextEncoder().encode('first chunk at best speed');
      deflate.process(input1, Z_SYNC_FLUSH);

      // Change to best compression mid-stream
      const rc = deflate.params(Z_BEST_COMPRESSION, Z_DEFAULT_STRATEGY);
      expect(rc).toBe(Z_OK);

      // Continue compressing at new level
      const input2 = new TextEncoder().encode('second chunk at best compression');
      deflate.process(input2, Z_SYNC_FLUSH);

      deflate.end();
    });

    it('should change strategy mid-stream', () => {
      const deflate = binding.createDeflate(Z_DEFAULT_COMPRESSION);
      deflate.process(new TextEncoder().encode('data'), Z_SYNC_FLUSH);

      const rc = deflate.params(Z_DEFAULT_COMPRESSION, Z_FILTERED);
      expect(rc).toBe(Z_OK);

      deflate.end();
    });

    it('should throw when calling params on inflate stream', () => {
      const inflate = binding.createInflate();
      expect(() => inflate.params(Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY))
        .toThrow('deflateParams only available for deflate');
      inflate.end();
    });
  });

  describe('windowBits edge cases', () => {
    it('should support deflate windowBits (8-15)', () => {
      for (const wb of [8, 9, 10, 11, 12, 13, 14, 15]) {
        const deflate = binding.createDeflate(Z_DEFAULT_COMPRESSION, wb);
        const { rc } = deflate.process(new TextEncoder().encode('test'), Z_FINISH);
        expect(rc).toBe(Z_STREAM_END);
        deflate.end();
      }
    });

    it('should support gzip windowBits (+16)', () => {
      // windowBits = 15 + 16 = 31 → gzip format
      const deflate = binding.createDeflate(Z_DEFAULT_COMPRESSION, 31);
      const { rc } = deflate.process(new TextEncoder().encode('gzip test'), Z_FINISH);
      expect(rc).toBe(Z_STREAM_END);
      deflate.end();
    });

    it('should support raw windowBits (negative)', () => {
      // windowBits = -15 → raw deflate (no header/trailer)
      const deflate = binding.createDeflate(Z_DEFAULT_COMPRESSION, -15);
      const { rc } = deflate.process(new TextEncoder().encode('raw test'), Z_FINISH);
      expect(rc).toBe(Z_STREAM_END);
      deflate.end();
    });

    it('should support auto-detect windowBits (+32) for inflate', () => {
      // windowBits = 15 + 32 = 47 → auto-detect gzip/deflate
      const inflate = binding.createInflate(47);
      expect(inflate.isEnded).toBe(false);
      inflate.end();
    });
  });

  describe('Stream lifecycle', () => {
    it('should throw when processing after end', () => {
      const deflate = binding.createDeflate();
      deflate.process(new TextEncoder().encode('data'), Z_FINISH);
      expect(() => deflate.process(new TextEncoder().encode('more'), Z_SYNC_FLUSH))
        .toThrow('Stream has ended');
    });

    it('should be idempotent on double end', () => {
      const deflate = binding.createDeflate();
      deflate.end();
      deflate.end(); // Should not throw
    });
  });
});
