/**
 * FFI Bridge: binding-encoding — Maps JS string transcoding to simdutf WASM.
 *
 * simdutf provides high-performance UTF-8/UTF-16 validation and conversion.
 * In WASM, the scalar fallback is used (SIMD not available).
 *
 * ~50 LOC bridge.
 */

type WasmPtr = number;

/** WASM exports for simdutf */
export interface SimdutfExports {
  memory: WebAssembly.Memory;
  malloc(size: number): WasmPtr;
  free(ptr: WasmPtr): void;

  validate_utf8(buf: WasmPtr, len: number): number;
  validate_utf16(buf: WasmPtr, len: number): number;
  convert_utf8_to_utf16(input: WasmPtr, inputLen: number, output: WasmPtr): number;
  convert_utf16_to_utf8(input: WasmPtr, inputLen: number, output: WasmPtr): number;
  utf8_length_from_utf16(input: WasmPtr, inputLen: number): number;
  utf16_length_from_utf8(input: WasmPtr, inputLen: number): number;
  detect_encoding(buf: WasmPtr, len: number): number;
}

// Encoding detection results
export const ENCODING_UTF8 = 1;
export const ENCODING_UTF16_LE = 2;
export const ENCODING_UTF16_BE = 3;
export const ENCODING_UNKNOWN = 0;

export class EncodingConverter {
  private _exports: SimdutfExports;

  constructor(exports: SimdutfExports) {
    this._exports = exports;
  }

  /** Validate that a byte sequence is valid UTF-8 */
  validateUtf8(data: Uint8Array): boolean {
    const ptr = this._exports.malloc(data.length);
    new Uint8Array(this._exports.memory.buffer, ptr, data.length).set(data);
    const result = this._exports.validate_utf8(ptr, data.length);
    this._exports.free(ptr);
    return result !== 0;
  }

  /** Validate that a byte sequence is valid UTF-16 */
  validateUtf16(data: Uint8Array): boolean {
    const ptr = this._exports.malloc(data.length);
    new Uint8Array(this._exports.memory.buffer, ptr, data.length).set(data);
    const result = this._exports.validate_utf16(ptr, data.length / 2);
    this._exports.free(ptr);
    return result !== 0;
  }

  /** Convert UTF-8 bytes to UTF-16 bytes */
  utf8ToUtf16(input: Uint8Array): Uint8Array {
    const inPtr = this._exports.malloc(input.length);
    new Uint8Array(this._exports.memory.buffer, inPtr, input.length).set(input);

    // Calculate output size
    const outLen = this._exports.utf16_length_from_utf8(inPtr, input.length);
    const outPtr = this._exports.malloc(outLen * 2); // UTF-16 = 2 bytes per code unit

    const written = this._exports.convert_utf8_to_utf16(inPtr, input.length, outPtr);
    const result = new Uint8Array(this._exports.memory.buffer, outPtr, written * 2).slice();

    this._exports.free(inPtr);
    this._exports.free(outPtr);
    return result;
  }

  /** Convert UTF-16 bytes to UTF-8 bytes */
  utf16ToUtf8(input: Uint8Array): Uint8Array {
    const inPtr = this._exports.malloc(input.length);
    new Uint8Array(this._exports.memory.buffer, inPtr, input.length).set(input);

    const codeUnits = input.length / 2;
    // Calculate output size
    const outLen = this._exports.utf8_length_from_utf16(inPtr, codeUnits);
    const outPtr = this._exports.malloc(outLen);

    const written = this._exports.convert_utf16_to_utf8(inPtr, codeUnits, outPtr);
    const result = new Uint8Array(this._exports.memory.buffer, outPtr, written).slice();

    this._exports.free(inPtr);
    this._exports.free(outPtr);
    return result;
  }

  /** Detect the encoding of a byte sequence */
  detectEncoding(data: Uint8Array): number {
    const ptr = this._exports.malloc(data.length);
    new Uint8Array(this._exports.memory.buffer, ptr, data.length).set(data);
    const result = this._exports.detect_encoding(ptr, data.length);
    this._exports.free(ptr);
    return result;
  }
}

export class BindingEncoding {
  private _exports: SimdutfExports | null = null;
  private _converter: EncodingConverter | null = null;

  init(exports: SimdutfExports): void {
    this._exports = exports;
    this._converter = new EncodingConverter(exports);
  }

  get isReady(): boolean {
    return this._exports !== null;
  }

  validateUtf8(data: Uint8Array): boolean {
    if (!this._converter) throw new Error('BindingEncoding not initialized');
    return this._converter.validateUtf8(data);
  }

  validateUtf16(data: Uint8Array): boolean {
    if (!this._converter) throw new Error('BindingEncoding not initialized');
    return this._converter.validateUtf16(data);
  }

  utf8ToUtf16(input: Uint8Array): Uint8Array {
    if (!this._converter) throw new Error('BindingEncoding not initialized');
    return this._converter.utf8ToUtf16(input);
  }

  utf16ToUtf8(input: Uint8Array): Uint8Array {
    if (!this._converter) throw new Error('BindingEncoding not initialized');
    return this._converter.utf16ToUtf8(input);
  }

  detectEncoding(data: Uint8Array): number {
    if (!this._converter) throw new Error('BindingEncoding not initialized');
    return this._converter.detectEncoding(data);
  }
}

export const bindingEncoding = new BindingEncoding();
