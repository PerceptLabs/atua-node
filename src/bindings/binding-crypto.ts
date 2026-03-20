/**
 * FFI Bridge: binding-crypto — Maps JS crypto API to libcrypto (OpenSSL 3.x) WASM.
 *
 * Manages EVP_CIPHER_CTX, EVP_MD_CTX, HMAC_CTX, DH lifecycles in WASM linear memory.
 * All context pointers are tracked and freed on cleanup to prevent WASM memory leaks.
 *
 * ~350 LOC — larger than other FFI bridges because OpenSSL EVP API uses
 * stateful object lifecycles with context allocation/deallocation in WASM memory.
 */

/** Pointer to a location in WASM linear memory */
type WasmPtr = number;

/** Represents the WASM module's exported functions */
export interface LibCryptoExports {
  memory: WebAssembly.Memory;

  // Memory management
  malloc(size: number): WasmPtr;
  free(ptr: WasmPtr): void;

  // EVP Cipher
  EVP_CIPHER_CTX_new(): WasmPtr;
  EVP_CIPHER_CTX_free(ctx: WasmPtr): void;
  EVP_CipherInit_ex(ctx: WasmPtr, cipher: WasmPtr, engine: WasmPtr,
    key: WasmPtr, iv: WasmPtr, enc: number): number;
  EVP_CipherUpdate(ctx: WasmPtr, out: WasmPtr, outLen: WasmPtr,
    inp: WasmPtr, inLen: number): number;
  EVP_CipherFinal_ex(ctx: WasmPtr, out: WasmPtr, outLen: WasmPtr): number;
  EVP_CIPHER_CTX_ctrl(ctx: WasmPtr, type: number, arg: number, ptr: WasmPtr): number;

  // Cipher lookup
  EVP_aes_256_gcm(): WasmPtr;
  EVP_aes_256_cbc(): WasmPtr;
  EVP_aes_128_gcm(): WasmPtr;
  EVP_aes_128_cbc(): WasmPtr;
  EVP_des_cbc(): WasmPtr;
  EVP_rc4(): WasmPtr;
  EVP_bf_cbc(): WasmPtr;
  EVP_chacha20_poly1305(): WasmPtr;

  // EVP Digest (Hash)
  EVP_MD_CTX_new(): WasmPtr;
  EVP_MD_CTX_free(ctx: WasmPtr): void;
  EVP_MD_CTX_copy_ex(dst: WasmPtr, src: WasmPtr): number;
  EVP_DigestInit_ex(ctx: WasmPtr, md: WasmPtr, engine: WasmPtr): number;
  EVP_DigestUpdate(ctx: WasmPtr, data: WasmPtr, len: number): number;
  EVP_DigestFinal_ex(ctx: WasmPtr, out: WasmPtr, outLen: WasmPtr): number;
  EVP_MD_CTX_size(ctx: WasmPtr): number;

  // Hash lookup
  EVP_sha256(): WasmPtr;
  EVP_sha512(): WasmPtr;
  EVP_sha1(): WasmPtr;
  EVP_md5(): WasmPtr;

  // HMAC
  HMAC_CTX_new(): WasmPtr;
  HMAC_CTX_free(ctx: WasmPtr): void;
  HMAC_Init_ex(ctx: WasmPtr, key: WasmPtr, keyLen: number,
    md: WasmPtr, engine: WasmPtr): number;
  HMAC_Update(ctx: WasmPtr, data: WasmPtr, len: number): number;
  HMAC_Final(ctx: WasmPtr, out: WasmPtr, outLen: WasmPtr): number;

  // DH
  DH_new(): WasmPtr;
  DH_free(dh: WasmPtr): void;
  DH_generate_parameters_ex(dh: WasmPtr, primeBits: number,
    generator: number, cb: WasmPtr): number;
  DH_generate_key(dh: WasmPtr): number;
  DH_compute_key(key: WasmPtr, pubKey: WasmPtr, dh: WasmPtr): number;
  DH_size(dh: WasmPtr): number;
  DH_get0_pub_key(dh: WasmPtr): WasmPtr;
  DH_get0_priv_key(dh: WasmPtr): WasmPtr;
  BN_num_bytes(bn: WasmPtr): number;
  BN_bn2bin(bn: WasmPtr, out: WasmPtr): number;
  BN_bin2bn(data: WasmPtr, len: number, ret: WasmPtr): WasmPtr;
  DH_set0_pqg(dh: WasmPtr, p: WasmPtr, q: WasmPtr, g: WasmPtr): number;

  // RAND
  RAND_bytes(buf: WasmPtr, num: number): number;

  // Error handling
  ERR_get_error(): number;
  ERR_error_string(err: number, buf: WasmPtr): WasmPtr;
}

// EVP_CIPHER_CTX_ctrl types
const EVP_CTRL_GCM_SET_TAG = 0x11;
const EVP_CTRL_GCM_GET_TAG = 0x10;
const EVP_CTRL_GCM_SET_IVLEN = 0x9;

// Shared scratch buffer size for small operations
const SCRATCH_SIZE = 8192;

/**
 * Manages a WASM memory scratch buffer for reducing allocation overhead
 * on small operations.
 */
class ScratchBuffer {
  private _ptr: WasmPtr = 0;
  private _exports: LibCryptoExports | null = null;

  init(exports: LibCryptoExports): void {
    this._exports = exports;
    this._ptr = exports.malloc(SCRATCH_SIZE);
  }

  get ptr(): WasmPtr {
    return this._ptr;
  }

  /** Copy data into the scratch buffer, return start pointer */
  write(data: Uint8Array): WasmPtr {
    if (!this._exports) throw new Error('ScratchBuffer not initialized');
    if (data.length > SCRATCH_SIZE) {
      throw new Error(`Data too large for scratch buffer: ${data.length} > ${SCRATCH_SIZE}`);
    }
    const view = new Uint8Array(this._exports.memory.buffer, this._ptr, SCRATCH_SIZE);
    view.set(data);
    return this._ptr;
  }

  /** Read bytes from a WASM pointer */
  read(ptr: WasmPtr, length: number): Uint8Array {
    if (!this._exports) throw new Error('ScratchBuffer not initialized');
    return new Uint8Array(this._exports.memory.buffer, ptr, length).slice();
  }

  destroy(): void {
    if (this._exports && this._ptr) {
      this._exports.free(this._ptr);
      this._ptr = 0;
    }
  }
}

/**
 * Write bytes to WASM memory at a given pointer or via malloc.
 */
function writeToWasm(exports: LibCryptoExports, data: Uint8Array): WasmPtr {
  const ptr = exports.malloc(data.length);
  new Uint8Array(exports.memory.buffer, ptr, data.length).set(data);
  return ptr;
}

/** Read bytes from WASM memory */
function readFromWasm(exports: LibCryptoExports, ptr: WasmPtr, length: number): Uint8Array {
  return new Uint8Array(exports.memory.buffer, ptr, length).slice();
}

/** Read a 32-bit integer from WASM memory */
function readI32(exports: LibCryptoExports, ptr: WasmPtr): number {
  return new Int32Array(exports.memory.buffer, ptr, 1)[0];
}

/** Get OpenSSL error string */
function getOpenSSLError(exports: LibCryptoExports): string {
  const errCode = exports.ERR_get_error();
  if (errCode === 0) return 'unknown error';
  const bufPtr = exports.malloc(256);
  exports.ERR_error_string(errCode, bufPtr);
  const bytes = readFromWasm(exports, bufPtr, 256);
  exports.free(bufPtr);
  const nullIdx = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, nullIdx === -1 ? bytes.length : nullIdx));
}

// ── Cipher Context ──────────────────────────────────────────────

export class CipherContext {
  private _ctx: WasmPtr;
  private _exports: LibCryptoExports;
  private _freed = false;

  constructor(exports: LibCryptoExports, cipherPtr: WasmPtr, key: Uint8Array, iv: Uint8Array, encrypt: boolean) {
    this._exports = exports;
    this._ctx = exports.EVP_CIPHER_CTX_new();
    if (!this._ctx) throw new Error('Failed to create cipher context');

    const keyPtr = writeToWasm(exports, key);
    const ivPtr = writeToWasm(exports, iv);

    const rc = exports.EVP_CipherInit_ex(this._ctx, cipherPtr, 0, keyPtr, ivPtr, encrypt ? 1 : 0);
    exports.free(keyPtr);
    exports.free(ivPtr);

    if (rc !== 1) {
      this.free();
      throw new Error(`EVP_CipherInit_ex failed: ${getOpenSSLError(exports)}`);
    }
  }

  /** Set AAD for AEAD ciphers (GCM, ChaCha20-Poly1305) */
  setAAD(aad: Uint8Array): void {
    this._checkFreed();
    const aadPtr = writeToWasm(this._exports, aad);
    const outLenPtr = this._exports.malloc(4);
    const rc = this._exports.EVP_CipherUpdate(this._ctx, 0, outLenPtr, aadPtr, aad.length);
    this._exports.free(aadPtr);
    this._exports.free(outLenPtr);
    if (rc !== 1) throw new Error(`setAAD failed: ${getOpenSSLError(this._exports)}`);
  }

  /** Feed data through the cipher */
  update(data: Uint8Array): Uint8Array {
    this._checkFreed();
    const inPtr = writeToWasm(this._exports, data);
    const outPtr = this._exports.malloc(data.length + 32); // Extra block for padding
    const outLenPtr = this._exports.malloc(4);

    const rc = this._exports.EVP_CipherUpdate(this._ctx, outPtr, outLenPtr, inPtr, data.length);
    this._exports.free(inPtr);

    if (rc !== 1) {
      this._exports.free(outPtr);
      this._exports.free(outLenPtr);
      throw new Error(`EVP_CipherUpdate failed: ${getOpenSSLError(this._exports)}`);
    }

    const outLen = readI32(this._exports, outLenPtr);
    const result = readFromWasm(this._exports, outPtr, outLen);
    this._exports.free(outPtr);
    this._exports.free(outLenPtr);
    return result;
  }

  /** Finalize the cipher operation */
  final(): Uint8Array {
    this._checkFreed();
    const outPtr = this._exports.malloc(32);
    const outLenPtr = this._exports.malloc(4);

    const rc = this._exports.EVP_CipherFinal_ex(this._ctx, outPtr, outLenPtr);
    if (rc !== 1) {
      this._exports.free(outPtr);
      this._exports.free(outLenPtr);
      throw new Error(`EVP_CipherFinal_ex failed: ${getOpenSSLError(this._exports)}`);
    }

    const outLen = readI32(this._exports, outLenPtr);
    const result = readFromWasm(this._exports, outPtr, outLen);
    this._exports.free(outPtr);
    this._exports.free(outLenPtr);
    return result;
  }

  /** Get auth tag for AEAD ciphers */
  getAuthTag(tagLength: number = 16): Uint8Array {
    this._checkFreed();
    const tagPtr = this._exports.malloc(tagLength);
    const rc = this._exports.EVP_CIPHER_CTX_ctrl(this._ctx, EVP_CTRL_GCM_GET_TAG, tagLength, tagPtr);
    if (rc !== 1) {
      this._exports.free(tagPtr);
      throw new Error(`getAuthTag failed: ${getOpenSSLError(this._exports)}`);
    }
    const result = readFromWasm(this._exports, tagPtr, tagLength);
    this._exports.free(tagPtr);
    return result;
  }

  /** Set auth tag for AEAD decryption */
  setAuthTag(tag: Uint8Array): void {
    this._checkFreed();
    const tagPtr = writeToWasm(this._exports, tag);
    const rc = this._exports.EVP_CIPHER_CTX_ctrl(this._ctx, EVP_CTRL_GCM_SET_TAG, tag.length, tagPtr);
    this._exports.free(tagPtr);
    if (rc !== 1) throw new Error(`setAuthTag failed: ${getOpenSSLError(this._exports)}`);
  }

  /** Free the cipher context — must be called to avoid WASM memory leaks */
  free(): void {
    if (!this._freed && this._ctx) {
      this._exports.EVP_CIPHER_CTX_free(this._ctx);
      this._freed = true;
    }
  }

  private _checkFreed(): void {
    if (this._freed) throw new Error('CipherContext has been freed');
  }
}

// ── Hash (Digest) Context ───────────────────────────────────────

export class HashContext {
  private _ctx: WasmPtr;
  private _exports: LibCryptoExports;
  private _freed = false;

  constructor(exports: LibCryptoExports, mdPtr: WasmPtr) {
    this._exports = exports;
    this._ctx = exports.EVP_MD_CTX_new();
    if (!this._ctx) throw new Error('Failed to create hash context');

    const rc = exports.EVP_DigestInit_ex(this._ctx, mdPtr, 0);
    if (rc !== 1) {
      this.free();
      throw new Error(`EVP_DigestInit_ex failed: ${getOpenSSLError(exports)}`);
    }
  }

  update(data: Uint8Array): void {
    this._checkFreed();
    const dataPtr = writeToWasm(this._exports, data);
    const rc = this._exports.EVP_DigestUpdate(this._ctx, dataPtr, data.length);
    this._exports.free(dataPtr);
    if (rc !== 1) throw new Error(`EVP_DigestUpdate failed: ${getOpenSSLError(this._exports)}`);
  }

  digest(): Uint8Array {
    this._checkFreed();
    const size = this._exports.EVP_MD_CTX_size(this._ctx);
    const outPtr = this._exports.malloc(size);
    const outLenPtr = this._exports.malloc(4);

    const rc = this._exports.EVP_DigestFinal_ex(this._ctx, outPtr, outLenPtr);
    if (rc !== 1) {
      this._exports.free(outPtr);
      this._exports.free(outLenPtr);
      throw new Error(`EVP_DigestFinal_ex failed: ${getOpenSSLError(this._exports)}`);
    }

    const outLen = readI32(this._exports, outLenPtr);
    const result = readFromWasm(this._exports, outPtr, outLen);
    this._exports.free(outPtr);
    this._exports.free(outLenPtr);
    return result;
  }

  /** Clone the current hash state */
  copy(): HashContext {
    this._checkFreed();
    const clone = Object.create(HashContext.prototype) as HashContext;
    clone._exports = this._exports;
    clone._freed = false;
    clone._ctx = this._exports.EVP_MD_CTX_new();
    const rc = this._exports.EVP_MD_CTX_copy_ex(clone._ctx, this._ctx);
    if (rc !== 1) {
      this._exports.EVP_MD_CTX_free(clone._ctx);
      throw new Error(`EVP_MD_CTX_copy_ex failed: ${getOpenSSLError(this._exports)}`);
    }
    return clone;
  }

  free(): void {
    if (!this._freed && this._ctx) {
      this._exports.EVP_MD_CTX_free(this._ctx);
      this._freed = true;
    }
  }

  private _checkFreed(): void {
    if (this._freed) throw new Error('HashContext has been freed');
  }
}

// ── HMAC Context ────────────────────────────────────────────────

export class HmacContext {
  private _ctx: WasmPtr;
  private _exports: LibCryptoExports;
  private _freed = false;

  constructor(exports: LibCryptoExports, key: Uint8Array, mdPtr: WasmPtr) {
    this._exports = exports;
    this._ctx = exports.HMAC_CTX_new();
    if (!this._ctx) throw new Error('Failed to create HMAC context');

    const keyPtr = writeToWasm(exports, key);
    const rc = exports.HMAC_Init_ex(this._ctx, keyPtr, key.length, mdPtr, 0);
    exports.free(keyPtr);
    if (rc !== 1) {
      this.free();
      throw new Error(`HMAC_Init_ex failed: ${getOpenSSLError(exports)}`);
    }
  }

  update(data: Uint8Array): void {
    this._checkFreed();
    const dataPtr = writeToWasm(this._exports, data);
    const rc = this._exports.HMAC_Update(this._ctx, dataPtr, data.length);
    this._exports.free(dataPtr);
    if (rc !== 1) throw new Error(`HMAC_Update failed: ${getOpenSSLError(this._exports)}`);
  }

  digest(): Uint8Array {
    this._checkFreed();
    const outPtr = this._exports.malloc(64); // Max hash size
    const outLenPtr = this._exports.malloc(4);
    const rc = this._exports.HMAC_Final(this._ctx, outPtr, outLenPtr);
    if (rc !== 1) {
      this._exports.free(outPtr);
      this._exports.free(outLenPtr);
      throw new Error(`HMAC_Final failed: ${getOpenSSLError(this._exports)}`);
    }
    const outLen = readI32(this._exports, outLenPtr);
    const result = readFromWasm(this._exports, outPtr, outLen);
    this._exports.free(outPtr);
    this._exports.free(outLenPtr);
    return result;
  }

  free(): void {
    if (!this._freed && this._ctx) {
      this._exports.HMAC_CTX_free(this._ctx);
      this._freed = true;
    }
  }

  private _checkFreed(): void {
    if (this._freed) throw new Error('HmacContext has been freed');
  }
}

// ── DiffieHellman Context ───────────────────────────────────────

export class DHContext {
  private _dh: WasmPtr;
  private _exports: LibCryptoExports;
  private _freed = false;

  constructor(exports: LibCryptoExports) {
    this._exports = exports;
    this._dh = exports.DH_new();
    if (!this._dh) throw new Error('Failed to create DH context');
  }

  /** Generate DH parameters with given prime length and generator */
  generateParameters(primeBits: number, generator: number = 2): void {
    this._checkFreed();
    const rc = this._exports.DH_generate_parameters_ex(this._dh, primeBits, generator, 0);
    if (rc !== 1) throw new Error(`DH_generate_parameters_ex failed: ${getOpenSSLError(this._exports)}`);
  }

  /** Set custom prime (p) and generator (g) */
  setParameters(p: Uint8Array, g: Uint8Array): void {
    this._checkFreed();
    const pPtr = writeToWasm(this._exports, p);
    const gPtr = writeToWasm(this._exports, g);
    const pBn = this._exports.BN_bin2bn(pPtr, p.length, 0);
    const gBn = this._exports.BN_bin2bn(gPtr, g.length, 0);
    this._exports.free(pPtr);
    this._exports.free(gPtr);

    const rc = this._exports.DH_set0_pqg(this._dh, pBn, 0, gBn);
    if (rc !== 1) throw new Error(`DH_set0_pqg failed: ${getOpenSSLError(this._exports)}`);
  }

  /** Generate the key pair */
  generateKey(): void {
    this._checkFreed();
    const rc = this._exports.DH_generate_key(this._dh);
    if (rc !== 1) throw new Error(`DH_generate_key failed: ${getOpenSSLError(this._exports)}`);
  }

  /** Get the public key as bytes */
  getPublicKey(): Uint8Array {
    this._checkFreed();
    const pubBn = this._exports.DH_get0_pub_key(this._dh);
    const size = this._exports.BN_num_bytes(pubBn);
    const outPtr = this._exports.malloc(size);
    this._exports.BN_bn2bin(pubBn, outPtr);
    const result = readFromWasm(this._exports, outPtr, size);
    this._exports.free(outPtr);
    return result;
  }

  /** Compute shared secret from peer's public key */
  computeKey(peerPublicKey: Uint8Array): Uint8Array {
    this._checkFreed();
    const peerPtr = writeToWasm(this._exports, peerPublicKey);
    const peerBn = this._exports.BN_bin2bn(peerPtr, peerPublicKey.length, 0);
    this._exports.free(peerPtr);

    const size = this._exports.DH_size(this._dh);
    const keyPtr = this._exports.malloc(size);
    const rc = this._exports.DH_compute_key(keyPtr, peerBn, this._dh);
    if (rc < 0) {
      this._exports.free(keyPtr);
      throw new Error(`DH_compute_key failed: ${getOpenSSLError(this._exports)}`);
    }

    const result = readFromWasm(this._exports, keyPtr, rc);
    this._exports.free(keyPtr);
    return result;
  }

  free(): void {
    if (!this._freed && this._dh) {
      this._exports.DH_free(this._dh);
      this._freed = true;
    }
  }

  private _checkFreed(): void {
    if (this._freed) throw new Error('DHContext has been freed');
  }
}

// ── RAND ────────────────────────────────────────────────────────

export function randBytes(exports: LibCryptoExports, size: number): Uint8Array {
  const ptr = exports.malloc(size);
  const rc = exports.RAND_bytes(ptr, size);
  if (rc !== 1) {
    exports.free(ptr);
    throw new Error(`RAND_bytes failed: ${getOpenSSLError(exports)}`);
  }
  const result = readFromWasm(exports, ptr, size);
  exports.free(ptr);
  return result;
}

// ── Top-level binding ───────────────────────────────────────────

export class BindingCrypto {
  private _exports: LibCryptoExports | null = null;
  private _scratch = new ScratchBuffer();
  private _contexts = new Set<{ free(): void }>();

  /** Initialize with WASM module exports */
  init(exports: LibCryptoExports): void {
    this._exports = exports;
    this._scratch.init(exports);
  }

  get isReady(): boolean {
    return this._exports !== null;
  }

  private _getExports(): LibCryptoExports {
    if (!this._exports) throw new Error('BindingCrypto not initialized — call init() first');
    return this._exports;
  }

  createCipher(algorithm: string, key: Uint8Array, iv: Uint8Array, encrypt: boolean): CipherContext {
    const exports = this._getExports();
    const cipherPtr = this._lookupCipher(algorithm);
    const ctx = new CipherContext(exports, cipherPtr, key, iv, encrypt);
    this._contexts.add(ctx);
    return ctx;
  }

  createHash(algorithm: string): HashContext {
    const exports = this._getExports();
    const mdPtr = this._lookupHash(algorithm);
    const ctx = new HashContext(exports, mdPtr);
    this._contexts.add(ctx);
    return ctx;
  }

  createHmac(algorithm: string, key: Uint8Array): HmacContext {
    const exports = this._getExports();
    const mdPtr = this._lookupHash(algorithm);
    const ctx = new HmacContext(exports, key, mdPtr);
    this._contexts.add(ctx);
    return ctx;
  }

  createDH(): DHContext {
    const exports = this._getExports();
    const ctx = new DHContext(exports);
    this._contexts.add(ctx);
    return ctx;
  }

  randomBytes(size: number): Uint8Array {
    return randBytes(this._getExports(), size);
  }

  getErrorString(): string {
    return getOpenSSLError(this._getExports());
  }

  /** Free all tracked contexts — call on cleanup */
  freeAll(): void {
    for (const ctx of this._contexts) {
      ctx.free();
    }
    this._contexts.clear();
    this._scratch.destroy();
  }

  private _lookupCipher(algorithm: string): WasmPtr {
    const exports = this._getExports();
    const map: Record<string, () => WasmPtr> = {
      'aes-256-gcm': () => exports.EVP_aes_256_gcm(),
      'aes-256-cbc': () => exports.EVP_aes_256_cbc(),
      'aes-128-gcm': () => exports.EVP_aes_128_gcm(),
      'aes-128-cbc': () => exports.EVP_aes_128_cbc(),
      'des-cbc': () => exports.EVP_des_cbc(),
      'rc4': () => exports.EVP_rc4(),
      'bf-cbc': () => exports.EVP_bf_cbc(),
      'chacha20-poly1305': () => exports.EVP_chacha20_poly1305(),
    };
    const lookup = map[algorithm.toLowerCase()];
    if (!lookup) throw new Error(`Unsupported cipher algorithm: ${algorithm}`);
    return lookup();
  }

  private _lookupHash(algorithm: string): WasmPtr {
    const exports = this._getExports();
    const map: Record<string, () => WasmPtr> = {
      'sha256': () => exports.EVP_sha256(),
      'sha512': () => exports.EVP_sha512(),
      'sha1': () => exports.EVP_sha1(),
      'md5': () => exports.EVP_md5(),
    };
    const lookup = map[algorithm.toLowerCase()];
    if (!lookup) throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    return lookup();
  }
}

export const bindingCrypto = new BindingCrypto();
