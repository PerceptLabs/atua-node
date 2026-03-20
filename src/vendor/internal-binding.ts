/**
 * internalBinding() dispatch.
 *
 * Central dispatch function that returns binding objects matching what
 * Node's internal code expects. Each binding returns class constructors
 * and functions, not plain function bags.
 *
 * Node's vendored code calls:
 *   const { Hash } = internalBinding('crypto');
 *   const h = new Hash('sha256');
 *   h.update(data);
 *   h.digest();
 */

import {
  bindingCrypto, CipherContext, HashContext, HmacContext, DHContext,
} from '../bindings/binding-crypto.js';
import {
  bindingZlib, ZlibStream,
  Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END, Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY,
} from '../bindings/binding-zlib.js';
import {
  bindingHttpParser, HttpParser, HPE, HTTP_REQUEST, HTTP_RESPONSE,
} from '../bindings/binding-http-parser.js';
import { bindingUrl } from '../bindings/binding-url.js';
import { bindingEncoding } from '../bindings/binding-encoding.js';
import { bindingUv } from '../bindings/binding-uv.js';
import { bindingVm } from '../bindings/binding-vm.js';

// ── Crypto binding wrapper ─────────────────────────────────

class Hash {
  private _ctx: HashContext | null = null;

  constructor(algorithm: string) {
    this._ctx = bindingCrypto.createHash(algorithm);
  }

  update(data: Uint8Array | string): this {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this._ctx!.update(bytes);
    return this;
  }

  digest(encoding?: string): Uint8Array | string {
    const raw = this._ctx!.digest();
    if (encoding === 'hex') return bufToHex(raw);
    if (encoding === 'base64') return btoa(String.fromCharCode(...raw));
    return raw;
  }

  copy(): Hash {
    const h = Object.create(Hash.prototype);
    h._ctx = this._ctx!.copy();
    return h;
  }
}

class Hmac {
  private _ctx: HmacContext | null = null;

  constructor(algorithm: string, key: Uint8Array | string) {
    const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    this._ctx = bindingCrypto.createHmac(algorithm, keyBytes);
  }

  update(data: Uint8Array | string): this {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this._ctx!.update(bytes);
    return this;
  }

  digest(encoding?: string): Uint8Array | string {
    const raw = this._ctx!.digest();
    if (encoding === 'hex') return bufToHex(raw);
    if (encoding === 'base64') return btoa(String.fromCharCode(...raw));
    return raw;
  }
}

class CipherBase {
  private _ctx: CipherContext | null = null;
  private _encrypt: boolean;

  constructor(algorithm: string, key: Uint8Array, iv: Uint8Array, encrypt: boolean) {
    this._encrypt = encrypt;
    this._ctx = bindingCrypto.createCipher(algorithm, key, iv, encrypt);
  }

  update(data: Uint8Array): Uint8Array {
    return this._ctx!.update(data);
  }

  final(): Uint8Array {
    return this._ctx!.final();
  }

  getAuthTag(): Uint8Array {
    return this._ctx!.getAuthTag();
  }

  setAuthTag(tag: Uint8Array): void {
    this._ctx!.setAuthTag(tag);
  }

  setAAD(aad: Uint8Array): void {
    this._ctx!.setAAD(aad);
  }
}

class DiffieHellman {
  private _ctx: DHContext;

  constructor(sizeOrPrime?: number | Uint8Array, generator?: number) {
    this._ctx = bindingCrypto.createDH();
    if (typeof sizeOrPrime === 'number') {
      this._ctx.generateParameters(sizeOrPrime, generator ?? 2);
    } else if (sizeOrPrime instanceof Uint8Array) {
      const g = new Uint8Array([generator ?? 2]);
      this._ctx.setParameters(sizeOrPrime, g);
    }
  }

  generateKeys(): Uint8Array {
    this._ctx.generateKey();
    return this._ctx.getPublicKey();
  }

  getPublicKey(): Uint8Array {
    return this._ctx.getPublicKey();
  }

  computeSecret(otherPublicKey: Uint8Array): Uint8Array {
    return this._ctx.computeKey(otherPublicKey);
  }
}

const cryptoBinding = {
  Hash,
  Hmac,
  CipherBase,
  DiffieHellman,
  randomBytes(size: number): Uint8Array {
    return bindingCrypto.randomBytes(size);
  },
  getSSLErrorString(): string {
    return bindingCrypto.getErrorString();
  },
};

// ── Zlib binding wrapper ────────────────────────────────────

class Zlib {
  private _stream: ZlibStream | null = null;
  private _mode: 'deflate' | 'inflate';

  constructor(mode: 'deflate' | 'inflate', level?: number, windowBits?: number, memLevel?: number, strategy?: number) {
    this._mode = mode;
    if (mode === 'deflate') {
      this._stream = bindingZlib.createDeflate(level, windowBits, memLevel, strategy);
    } else {
      this._stream = bindingZlib.createInflate(windowBits);
    }
  }

  process(input: Uint8Array, flush: number): { data: Uint8Array; rc: number } {
    return this._stream!.process(input, flush);
  }

  params(level: number, strategy: number): number {
    return this._stream!.params(level, strategy);
  }

  close(): void {
    this._stream?.end();
  }
}

const zlibBinding = {
  Zlib,
  Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH,
  Z_OK, Z_STREAM_END,
  Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY,
};

// ── HTTP parser binding wrapper ─────────────────────────────

const httpParserBinding = {
  HTTPParser: HttpParser,
  HPE,
  HTTP_REQUEST,
  HTTP_RESPONSE,
  methods: ['DELETE', 'GET', 'HEAD', 'POST', 'PUT', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'],
};

// ── URL binding wrapper ─────────────────────────────────────

const urlBinding = {
  parse: (url: string) => bindingUrl.parse(url),
};

// ── Encoding binding wrapper ────────────────────────────────

const encodingBinding = {
  validateUtf8: (data: Uint8Array) => bindingEncoding.validateUtf8(data),
  utf8ToUtf16: (data: Uint8Array) => bindingEncoding.utf8ToUtf16(data),
  utf16ToUtf8: (data: Uint8Array) => bindingEncoding.utf16ToUtf8(data),
  detectEncoding: (data: Uint8Array) => bindingEncoding.detectEncoding(data),
};

// ── UV binding wrapper ──────────────────────────────────────

const uvBinding = bindingUv;

// ── VM binding wrapper ──────────────────────────────────────

const vmBinding = bindingVm;

// ── OS binding wrapper ──────────────────────────────────────

const osBinding = {
  type(): string { return 'Linux'; },
  platform(): string { return 'linux'; },
  arch(): string { return 'x64'; },
  release(): string { return '6.1.0-wasm'; },
  hostname(): string { return 'atua'; },
  homedir(): string { return '/home/user'; },
  tmpdir(): string { return '/tmp'; },
  endianness(): string { return 'LE'; },
  cpus() { return [{ model: 'wasm32', speed: 1000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }]; },
  totalmem(): number { return 4 * 1024 * 1024 * 1024; },
  freemem(): number { return 2 * 1024 * 1024 * 1024; },
  uptime(): number { return performance.now() / 1000; },
  loadavg(): number[] { return [0, 0, 0]; },
  networkInterfaces() { return {}; },
  EOL: '\n',
  constants: {
    signals: { SIGINT: 2, SIGTERM: 15, SIGHUP: 1, SIGKILL: 9 },
    errno: {},
  },
};

// ── Constants binding ───────────────────────────────────────

const constantsBinding = {
  os: osBinding.constants,
  fs: {
    O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2,
    O_CREAT: 64, O_EXCL: 128, O_TRUNC: 512, O_APPEND: 1024,
    S_IRUSR: 0o400, S_IWUSR: 0o200, S_IXUSR: 0o100,
    S_IRGRP: 0o040, S_IWGRP: 0o020, S_IXGRP: 0o010,
    S_IROTH: 0o004, S_IWOTH: 0o002, S_IXOTH: 0o001,
    F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
  },
  crypto: {},
  zlib: { Z_NO_FLUSH, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH, Z_OK, Z_STREAM_END },
};

// ── Stream wrap binding ─────────────────────────────────────

const streamWrapBinding = {};

// ── Signal wrap binding ─────────────────────────────────────

const signalWrapBinding = {};

// ── FS binding (delegates to fs-bridge) ─────────────────────

const fsBinding = {};

// ── TCP wrap binding ────────────────────────────────────────

const tcpWrapBinding = {};

// ── TLS wrap binding ────────────────────────────────────────

const tlsWrapBinding = {};

// ── Dispatch ────────────────────────────────────────────────

const bindings = new Map<string, unknown>([
  ['crypto', cryptoBinding],
  ['zlib', zlibBinding],
  ['http_parser', httpParserBinding],
  ['url', urlBinding],
  ['encoding', encodingBinding],
  ['uv', uvBinding],
  ['vm', vmBinding],
  ['os', osBinding],
  ['constants', constantsBinding],
  ['stream_wrap', streamWrapBinding],
  ['signal_wrap', signalWrapBinding],
  ['fs', fsBinding],
  ['tcp_wrap', tcpWrapBinding],
  ['tls_wrap', tlsWrapBinding],
]);

export function internalBinding(name: string): unknown {
  const binding = bindings.get(name);
  if (binding === undefined) {
    throw new Error(`No such binding: '${name}'`);
  }
  return binding;
}

// ── Helpers ─────────────────────────────────────────────────

function bufToHex(buf: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < buf.length; i++) {
    hex += (buf[i] >> 4).toString(16) + (buf[i] & 0xf).toString(16);
  }
  return hex;
}
