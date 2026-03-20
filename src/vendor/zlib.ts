/**
 * Node.js zlib module facade.
 *
 * Provides the public require('zlib') API by delegating to
 * internalBinding('zlib') which wraps zlib.wasm.
 */

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

export default {
  createGzip, createGunzip, createDeflate, createInflate,
  createDeflateRaw, createInflateRaw,
  deflateSync, inflateSync, gzipSync, gunzipSync,
  constants,
  Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END, Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY,
  Z_BEST_SPEED, Z_BEST_COMPRESSION, Z_NO_COMPRESSION,
};
