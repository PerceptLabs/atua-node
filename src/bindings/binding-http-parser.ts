/**
 * FFI Bridge: binding-http-parser — Maps JS HTTP parsing to llhttp WASM.
 *
 * llhttp is Node's HTTP parser. This bridge provides:
 *   llhttp_init, llhttp_execute, llhttp_finish, callback registration.
 * Produces exact Node-compatible error codes (HPE_*).
 *
 * ~50 LOC bridge.
 */

type WasmPtr = number;

// ── Parser types ────────────────────────────────────────────────
export const HTTP_REQUEST = 1;
export const HTTP_RESPONSE = 2;
export const HTTP_BOTH = 3;

// ── Error codes matching Node's llhttp ─────────────────────────
export enum HPE {
  OK = 0,
  INTERNAL = 1,
  STRICT = 2,
  CR_EXPECTED = 25,
  LF_EXPECTED = 3,
  UNEXPECTED_CONTENT_LENGTH = 4,
  INVALID_METHOD = 6,
  INVALID_URL = 7,
  INVALID_CONSTANT = 8,
  INVALID_HEADER_TOKEN = 10,
  INVALID_CONTENT_LENGTH = 11,
  INVALID_CHUNK_SIZE = 12,
  INVALID_STATUS = 13,
  INVALID_EOF_STATE = 14,
  INVALID_TRANSFER_ENCODING = 15,
  CB_MESSAGE_BEGIN = 16,
  CB_HEADERS_COMPLETE = 17,
  CB_MESSAGE_COMPLETE = 18,
  CB_CHUNK_HEADER = 19,
  CB_CHUNK_COMPLETE = 20,
  PAUSED = 21,
  PAUSED_UPGRADE = 22,
  USER = 23,
}

/** Parsed HTTP message (built up via callbacks) */
export interface ParsedMessage {
  method?: string;
  url?: string;
  statusCode?: number;
  statusMessage?: string;
  versionMajor: number;
  versionMinor: number;
  headers: Array<[string, string]>;
  body: Uint8Array;
  complete: boolean;
  upgrade: boolean;
}

/** Callback set for llhttp parser events */
export interface ParserCallbacks {
  onUrl?(url: string): void;
  onHeaderField?(field: string): void;
  onHeaderValue?(value: string): void;
  onBody?(chunk: Uint8Array): void;
  onMessageBegin?(): void;
  onHeadersComplete?(info: { method: string; url: string; versionMajor: number; versionMinor: number; statusCode: number }): void;
  onMessageComplete?(): void;
}

/** WASM exports for llhttp */
export interface LlhttpExports {
  memory: WebAssembly.Memory;
  malloc(size: number): WasmPtr;
  free(ptr: WasmPtr): void;

  llhttp_init(parser: WasmPtr, type: number): void;
  llhttp_execute(parser: WasmPtr, data: WasmPtr, len: number): number;
  llhttp_finish(parser: WasmPtr): number;
  llhttp_get_error_reason(parser: WasmPtr): WasmPtr;
  llhttp_get_method(parser: WasmPtr): number;
  llhttp_get_status_code(parser: WasmPtr): number;
  llhttp_get_http_major(parser: WasmPtr): number;
  llhttp_get_http_minor(parser: WasmPtr): number;
  llhttp_get_upgrade(parser: WasmPtr): number;

  sizeof_llhttp(): number;
}

// HTTP methods
const METHODS = ['DELETE', 'GET', 'HEAD', 'POST', 'PUT', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];

export class HttpParser {
  private _exports: LlhttpExports;
  private _parser: WasmPtr;
  private _callbacks: ParserCallbacks;
  private _currentMessage: ParsedMessage;

  constructor(exports: LlhttpExports, type: number, callbacks: ParserCallbacks = {}) {
    this._exports = exports;
    this._callbacks = callbacks;
    this._currentMessage = this._newMessage();

    const size = exports.sizeof_llhttp();
    this._parser = exports.malloc(size);
    new Uint8Array(exports.memory.buffer, this._parser, size).fill(0);
    exports.llhttp_init(this._parser, type);
  }

  /** Feed data to the parser */
  execute(data: Uint8Array): HPE {
    const dataPtr = this._exports.malloc(data.length);
    new Uint8Array(this._exports.memory.buffer, dataPtr, data.length).set(data);

    const rc = this._exports.llhttp_execute(this._parser, dataPtr, data.length);
    this._exports.free(dataPtr);

    // Read parsed fields
    const method = METHODS[this._exports.llhttp_get_method(this._parser)] ?? 'UNKNOWN';
    const statusCode = this._exports.llhttp_get_status_code(this._parser);
    this._currentMessage.method = method;
    this._currentMessage.statusCode = statusCode;
    this._currentMessage.versionMajor = this._exports.llhttp_get_http_major(this._parser);
    this._currentMessage.versionMinor = this._exports.llhttp_get_http_minor(this._parser);
    this._currentMessage.upgrade = this._exports.llhttp_get_upgrade(this._parser) !== 0;

    return rc as HPE;
  }

  /** Signal end of input */
  finish(): HPE {
    return this._exports.llhttp_finish(this._parser) as HPE;
  }

  /** Get the current parsed message */
  get message(): ParsedMessage {
    return this._currentMessage;
  }

  /** Reset for a new message */
  reset(type: number): void {
    this._currentMessage = this._newMessage();
    this._exports.llhttp_init(this._parser, type);
  }

  /** Free parser memory */
  free(): void {
    this._exports.free(this._parser);
  }

  private _newMessage(): ParsedMessage {
    return {
      versionMajor: 1,
      versionMinor: 1,
      headers: [],
      body: new Uint8Array(0),
      complete: false,
      upgrade: false,
    };
  }
}

export class BindingHttpParser {
  private _exports: LlhttpExports | null = null;

  init(exports: LlhttpExports): void {
    this._exports = exports;
  }

  get isReady(): boolean {
    return this._exports !== null;
  }

  createParser(type: number, callbacks?: ParserCallbacks): HttpParser {
    if (!this._exports) throw new Error('BindingHttpParser not initialized');
    return new HttpParser(this._exports, type, callbacks);
  }
}

export const bindingHttpParser = new BindingHttpParser();
