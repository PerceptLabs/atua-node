/**
 * FFI Bridge: binding-zlib — Maps JS zlib API to zlib WASM.
 *
 * Stateful but simpler than crypto — one z_stream struct per operation.
 * Supports all flush modes, deflateParams mid-stream, and exact windowBits.
 *
 * ~80 LOC bridge code.
 */

type WasmPtr = number;

// ── Flush modes ─────────────────────────────────────────────────
export const Z_NO_FLUSH = 0;
export const Z_PARTIAL_FLUSH = 1;
export const Z_SYNC_FLUSH = 2;
export const Z_FULL_FLUSH = 3;
export const Z_FINISH = 4;

// ── Return codes ────────────────────────────────────────────────
export const Z_OK = 0;
export const Z_STREAM_END = 1;
export const Z_NEED_DICT = 2;
export const Z_BUF_ERROR = -5;

// ── Compression levels ──────────────────────────────────────────
export const Z_NO_COMPRESSION = 0;
export const Z_BEST_SPEED = 1;
export const Z_BEST_COMPRESSION = 9;
export const Z_DEFAULT_COMPRESSION = -1;

// ── Strategy ────────────────────────────────────────────────────
export const Z_DEFAULT_STRATEGY = 0;
export const Z_FILTERED = 1;
export const Z_HUFFMAN_ONLY = 2;

/** WASM exports for zlib */
export interface ZlibExports {
  memory: WebAssembly.Memory;
  malloc(size: number): WasmPtr;
  free(ptr: WasmPtr): void;

  deflateInit2(strm: WasmPtr, level: number, method: number,
    windowBits: number, memLevel: number, strategy: number): number;
  deflate(strm: WasmPtr, flush: number): number;
  deflateEnd(strm: WasmPtr): number;
  deflateParams(strm: WasmPtr, level: number, strategy: number): number;

  inflateInit2(strm: WasmPtr, windowBits: number): number;
  inflate(strm: WasmPtr, flush: number): number;
  inflateEnd(strm: WasmPtr): number;

  // z_stream struct size
  sizeof_z_stream(): number;
}

// z_stream field offsets (standardized by zlib ABI)
const ZSTREAM_NEXT_IN = 0;      // pointer
const ZSTREAM_AVAIL_IN = 4;     // uint
const ZSTREAM_TOTAL_IN = 8;     // ulong
const ZSTREAM_NEXT_OUT = 12;    // pointer
const ZSTREAM_AVAIL_OUT = 16;   // uint
const ZSTREAM_TOTAL_OUT = 20;   // ulong
const Z_DEFLATED = 8;           // method

function writeU32(exports: ZlibExports, ptr: WasmPtr, offset: number, value: number): void {
  new Uint32Array(exports.memory.buffer, ptr + offset, 1)[0] = value;
}

function readU32(exports: ZlibExports, ptr: WasmPtr, offset: number): number {
  return new Uint32Array(exports.memory.buffer, ptr + offset, 1)[0];
}

export class ZlibStream {
  private _exports: ZlibExports;
  private _strm: WasmPtr;
  private _mode: 'deflate' | 'inflate';
  private _ended = false;

  constructor(exports: ZlibExports, strm: WasmPtr, mode: 'deflate' | 'inflate') {
    this._exports = exports;
    this._strm = strm;
    this._mode = mode;
  }

  /** Process input data with the given flush mode */
  process(input: Uint8Array, flush: number, outputSize: number = 16384): { data: Uint8Array; rc: number } {
    if (this._ended) throw new Error('Stream has ended');

    const exports = this._exports;
    const inPtr = exports.malloc(input.length);
    const outPtr = exports.malloc(outputSize);

    new Uint8Array(exports.memory.buffer, inPtr, input.length).set(input);

    writeU32(exports, this._strm, ZSTREAM_NEXT_IN, inPtr);
    writeU32(exports, this._strm, ZSTREAM_AVAIL_IN, input.length);
    writeU32(exports, this._strm, ZSTREAM_NEXT_OUT, outPtr);
    writeU32(exports, this._strm, ZSTREAM_AVAIL_OUT, outputSize);

    const rc = this._mode === 'deflate'
      ? exports.deflate(this._strm, flush)
      : exports.inflate(this._strm, flush);

    const availOut = readU32(exports, this._strm, ZSTREAM_AVAIL_OUT);
    const produced = outputSize - availOut;
    const data = new Uint8Array(exports.memory.buffer, outPtr, produced).slice();

    exports.free(inPtr);
    exports.free(outPtr);

    if (rc === Z_STREAM_END) {
      this._ended = true;
    }

    return { data, rc };
  }

  /** Change compression level and strategy mid-stream (deflate only) */
  params(level: number, strategy: number): number {
    if (this._mode !== 'deflate') throw new Error('deflateParams only available for deflate streams');
    if (this._ended) throw new Error('Stream has ended');
    return this._exports.deflateParams(this._strm, level, strategy);
  }

  /** End the stream and free resources */
  end(): void {
    if (this._ended) return;
    this._ended = true;
    if (this._mode === 'deflate') {
      this._exports.deflateEnd(this._strm);
    } else {
      this._exports.inflateEnd(this._strm);
    }
    this._exports.free(this._strm);
  }

  get isEnded(): boolean {
    return this._ended;
  }
}

export class BindingZlib {
  private _exports: ZlibExports | null = null;

  init(exports: ZlibExports): void {
    this._exports = exports;
  }

  get isReady(): boolean {
    return this._exports !== null;
  }

  private _getExports(): ZlibExports {
    if (!this._exports) throw new Error('BindingZlib not initialized — call init() first');
    return this._exports;
  }

  /**
   * Create a deflate (compression) stream.
   *
   * @param level Compression level (Z_DEFAULT_COMPRESSION to Z_BEST_COMPRESSION)
   * @param windowBits Window size: 8-15 for deflate, +16 for gzip, negative for raw
   * @param memLevel Memory usage level (1-9, default 8)
   * @param strategy Compression strategy
   */
  createDeflate(
    level: number = Z_DEFAULT_COMPRESSION,
    windowBits: number = 15,
    memLevel: number = 8,
    strategy: number = Z_DEFAULT_STRATEGY
  ): ZlibStream {
    const exports = this._getExports();
    const strmSize = exports.sizeof_z_stream();
    const strm = exports.malloc(strmSize);

    // Zero-initialize the struct
    new Uint8Array(exports.memory.buffer, strm, strmSize).fill(0);

    const rc = exports.deflateInit2(strm, level, Z_DEFLATED, windowBits, memLevel, strategy);
    if (rc !== Z_OK) {
      exports.free(strm);
      throw new Error(`deflateInit2 failed with code ${rc}`);
    }

    return new ZlibStream(exports, strm, 'deflate');
  }

  /**
   * Create an inflate (decompression) stream.
   *
   * @param windowBits Window size: 8-15 for deflate, +16 for gzip, +32 for auto-detect, negative for raw
   */
  createInflate(windowBits: number = 15): ZlibStream {
    const exports = this._getExports();
    const strmSize = exports.sizeof_z_stream();
    const strm = exports.malloc(strmSize);

    new Uint8Array(exports.memory.buffer, strm, strmSize).fill(0);

    const rc = exports.inflateInit2(strm, windowBits);
    if (rc !== Z_OK) {
      exports.free(strm);
      throw new Error(`inflateInit2 failed with code ${rc}`);
    }

    return new ZlibStream(exports, strm, 'inflate');
  }
}

export const bindingZlib = new BindingZlib();
