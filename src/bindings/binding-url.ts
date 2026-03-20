/**
 * FFI Bridge: binding-url — Maps JS URL parsing to ada (WHATWG URL parser) WASM.
 *
 * Ada handles IDN normalization, backslash-to-slash, opaque paths —
 * matching Node's exact URL parsing behavior.
 *
 * ~50 LOC bridge.
 */

type WasmPtr = number;

/** Parsed URL components */
export interface ParsedUrl {
  href: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  username: string;
  password: string;
  origin: string;
  valid: boolean;
}

/** WASM exports for ada */
export interface AdaExports {
  memory: WebAssembly.Memory;
  malloc(size: number): WasmPtr;
  free(ptr: WasmPtr): void;

  ada_parse(input: WasmPtr, inputLen: number): WasmPtr;
  ada_free(result: WasmPtr): void;
  ada_is_valid(result: WasmPtr): number;
  ada_get_href(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_protocol(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_hostname(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_port(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_pathname(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_search(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_hash(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_username(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_password(result: WasmPtr, outLen: WasmPtr): WasmPtr;
  ada_get_origin(result: WasmPtr, outLen: WasmPtr): WasmPtr;
}

export class UrlParser {
  private _exports: AdaExports;

  constructor(exports: AdaExports) {
    this._exports = exports;
  }

  /** Parse a URL string and return its components */
  parse(input: string): ParsedUrl {
    const encoded = new TextEncoder().encode(input);
    const inputPtr = this._exports.malloc(encoded.length);
    new Uint8Array(this._exports.memory.buffer, inputPtr, encoded.length).set(encoded);

    const result = this._exports.ada_parse(inputPtr, encoded.length);
    this._exports.free(inputPtr);

    const valid = this._exports.ada_is_valid(result) !== 0;

    const parsed: ParsedUrl = {
      href: this._getString(result, 'ada_get_href'),
      protocol: this._getString(result, 'ada_get_protocol'),
      hostname: this._getString(result, 'ada_get_hostname'),
      port: this._getString(result, 'ada_get_port'),
      pathname: this._getString(result, 'ada_get_pathname'),
      search: this._getString(result, 'ada_get_search'),
      hash: this._getString(result, 'ada_get_hash'),
      username: this._getString(result, 'ada_get_username'),
      password: this._getString(result, 'ada_get_password'),
      origin: this._getString(result, 'ada_get_origin'),
      valid,
    };

    this._exports.ada_free(result);
    return parsed;
  }

  private _getString(result: WasmPtr, method: keyof AdaExports): string {
    const lenPtr = this._exports.malloc(4);
    const fn = this._exports[method] as (result: WasmPtr, outLen: WasmPtr) => WasmPtr;
    const strPtr = fn(result, lenPtr);
    const len = new Uint32Array(this._exports.memory.buffer, lenPtr, 1)[0];
    this._exports.free(lenPtr);

    if (len === 0 || !strPtr) return '';
    return new TextDecoder().decode(new Uint8Array(this._exports.memory.buffer, strPtr, len));
  }
}

export class BindingUrl {
  private _exports: AdaExports | null = null;
  private _parser: UrlParser | null = null;

  init(exports: AdaExports): void {
    this._exports = exports;
    this._parser = new UrlParser(exports);
  }

  get isReady(): boolean {
    return this._exports !== null;
  }

  parse(input: string): ParsedUrl {
    if (!this._parser) throw new Error('BindingUrl not initialized');
    return this._parser.parse(input);
  }
}

export const bindingUrl = new BindingUrl();
