/**
 * Node.js zlib module facade.
 *
 * Provides the public require('zlib') API by delegating to
 * internalBinding('zlib') which wraps zlib.wasm.
 */
export const __atua = true;

import { internalBinding } from './internal-binding.js';

const binding = internalBinding('zlib') as {
  Zlib: new (mode: 'deflate' | 'inflate', level?: number, windowBits?: number, memLevel?: number, strategy?: number) => {
    process(input: Uint8Array, flush: number): { data: Uint8Array; rc: number };
    params(level: number, strategy: number): number;
    close(): void;
  };
  Z_NO_FLUSH: number;
  Z_PARTIAL_FLUSH: number;
  Z_SYNC_FLUSH: number;
  Z_FULL_FLUSH: number;
  Z_FINISH: number;
  Z_OK: number;
  Z_STREAM_END: number;
  Z_DEFAULT_COMPRESSION: number;
  Z_DEFAULT_STRATEGY: number;
};

// Re-export constants
export const Z_NO_FLUSH = binding.Z_NO_FLUSH;
export const Z_PARTIAL_FLUSH = binding.Z_PARTIAL_FLUSH;
export const Z_SYNC_FLUSH = binding.Z_SYNC_FLUSH;
export const Z_FULL_FLUSH = binding.Z_FULL_FLUSH;
export const Z_FINISH = binding.Z_FINISH;
export const Z_OK = binding.Z_OK;
export const Z_STREAM_END = binding.Z_STREAM_END;
export const Z_DEFAULT_COMPRESSION = binding.Z_DEFAULT_COMPRESSION;
export const Z_DEFAULT_STRATEGY = binding.Z_DEFAULT_STRATEGY;

export const Z_BEST_SPEED = 1;
export const Z_BEST_COMPRESSION = 9;
export const Z_NO_COMPRESSION = 0;
export const Z_FILTERED = 1;
export const Z_HUFFMAN_ONLY = 2;
export const Z_RLE = 3;
export const Z_FIXED = 4;

export interface ZlibOptions {
  flush?: number;
  finishFlush?: number;
  chunkSize?: number;
  windowBits?: number;
  level?: number;
  memLevel?: number;
  strategy?: number;
}

class ZlibTransform {
  private _zlib;
  private _flush: number;

  constructor(mode: 'deflate' | 'inflate', options: ZlibOptions = {}) {
    const level = options.level ?? Z_DEFAULT_COMPRESSION;
    const windowBits = options.windowBits ?? 15;
    const memLevel = options.memLevel ?? 8;
    const strategy = options.strategy ?? Z_DEFAULT_STRATEGY;
    this._flush = options.flush ?? Z_NO_FLUSH;
    this._zlib = new binding.Zlib(mode, level, windowBits, memLevel, strategy);
  }

  processChunk(data: Uint8Array, flush?: number): Uint8Array {
    const { data: result } = this._zlib.process(data, flush ?? this._flush);
    return result;
  }

  close(): void {
    this._zlib.close();
  }
}

export function createGzip(options?: ZlibOptions) {
  return new ZlibTransform('deflate', { ...options, windowBits: (options?.windowBits ?? 15) + 16 });
}

export function createGunzip(options?: ZlibOptions) {
  return new ZlibTransform('inflate', { ...options, windowBits: (options?.windowBits ?? 15) + 16 });
}

export function createDeflate(options?: ZlibOptions) {
  return new ZlibTransform('deflate', options);
}

export function createInflate(options?: ZlibOptions) {
  return new ZlibTransform('inflate', options);
}

export function createDeflateRaw(options?: ZlibOptions) {
  return new ZlibTransform('deflate', { ...options, windowBits: -(options?.windowBits ?? 15) });
}

export function createInflateRaw(options?: ZlibOptions) {
  return new ZlibTransform('inflate', { ...options, windowBits: -(options?.windowBits ?? 15) });
}

export function deflateSync(data: Uint8Array, options?: ZlibOptions): Uint8Array {
  const z = createDeflate(options);
  const result = z.processChunk(data, Z_FINISH);
  z.close();
  return result;
}

export function inflateSync(data: Uint8Array, options?: ZlibOptions): Uint8Array {
  const z = createInflate(options);
  const result = z.processChunk(data, Z_SYNC_FLUSH);
  z.close();
  return result;
}

export function gzipSync(data: Uint8Array, options?: ZlibOptions): Uint8Array {
  const z = createGzip(options);
  const result = z.processChunk(data, Z_FINISH);
  z.close();
  return result;
}

export function gunzipSync(data: Uint8Array, options?: ZlibOptions): Uint8Array {
  const z = createGunzip(options);
  const result = z.processChunk(data, Z_SYNC_FLUSH);
  z.close();
  return result;
}

export const constants = {
  Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END,
  Z_NO_COMPRESSION, Z_BEST_SPEED, Z_BEST_COMPRESSION, Z_DEFAULT_COMPRESSION,
  Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, Z_FIXED, Z_DEFAULT_STRATEGY,
};

// ── Brotli (not yet available in zlib.wasm) ─────────────────
export function brotliCompress(_buffer: Uint8Array, _options: any, _callback?: Function): never {
  throw new Error('ERR_NOT_SUPPORTED: brotliCompress is not supported — Brotli not available in zlib.wasm');
}

export function brotliCompressSync(_buffer: Uint8Array, _options?: any): never {
  throw new Error('ERR_NOT_SUPPORTED: brotliCompressSync is not supported — Brotli not available in zlib.wasm');
}

export function brotliDecompress(_buffer: Uint8Array, _options: any, _callback?: Function): never {
  throw new Error('ERR_NOT_SUPPORTED: brotliDecompress is not supported — Brotli not available in zlib.wasm');
}

export function brotliDecompressSync(_buffer: Uint8Array, _options?: any): never {
  throw new Error('ERR_NOT_SUPPORTED: brotliDecompressSync is not supported — Brotli not available in zlib.wasm');
}

export class BrotliCompress {
  constructor() {
    throw new Error('ERR_NOT_SUPPORTED: BrotliCompress is not supported — Brotli not available in zlib.wasm');
  }
}

export class BrotliDecompress {
  constructor() {
    throw new Error('ERR_NOT_SUPPORTED: BrotliDecompress is not supported — Brotli not available in zlib.wasm');
  }
}

// ── CRC-32 (pure JS implementation) ────────────────────────
const _crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

export function crc32(data: Uint8Array | string, value?: number): number {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let crc = (value ?? 0) ^ 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = _crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export default {
  createGzip, createGunzip, createDeflate, createInflate,
  createDeflateRaw, createInflateRaw,
  deflateSync, inflateSync, gzipSync, gunzipSync,
  constants,
  Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END, Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY,
  Z_BEST_SPEED, Z_BEST_COMPRESSION, Z_NO_COMPRESSION,
  brotliCompress, brotliCompressSync,
  brotliDecompress, brotliDecompressSync,
  BrotliCompress, BrotliDecompress,
  crc32,
};
