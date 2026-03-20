// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';

const wasmExists = hasWasm('libcrypto');

describe.skipIf(!wasmExists)('libcrypto.wasm — real WASI execution', () => {
  it('should export EVP and crypto functions', async () => {
    const exports = await loadReactor('libcrypto');

    // Check key exports exist
    expect(exports.EVP_CIPHER_CTX_new).toBeDefined();
    expect(exports.EVP_CIPHER_CTX_free).toBeDefined();
    expect(exports.EVP_CipherInit_ex).toBeDefined();
    expect(exports.EVP_CipherUpdate).toBeDefined();
    expect(exports.EVP_CipherFinal_ex).toBeDefined();
    expect(exports.EVP_aes_256_gcm).toBeDefined();
    expect(exports.EVP_aes_256_cbc).toBeDefined();
    expect(exports.EVP_des_cbc).toBeDefined();
    expect(exports.EVP_bf_cbc).toBeDefined();
    expect(exports.EVP_rc4).toBeDefined();
    expect(exports.EVP_sha256).toBeDefined();
    expect(exports.EVP_sha512).toBeDefined();
    expect(exports.EVP_sha1).toBeDefined();
    expect(exports.EVP_md5).toBeDefined();

    // DH exports
    expect(exports.DH_new).toBeDefined();
    expect(exports.DH_free).toBeDefined();
    expect(exports.DH_generate_parameters_ex).toBeDefined();

    // RAND
    expect(exports.RAND_bytes).toBeDefined();

    // Error handling
    expect(exports.ERR_get_error).toBeDefined();
    expect(exports.ERR_error_string).toBeDefined();

    // Memory
    expect(exports.malloc).toBeDefined();
    expect(exports.free).toBeDefined();
    expect(exports.memory).toBeDefined();
  });

  it('should generate random bytes via RAND_bytes', async () => {
    const exports = await loadReactor('libcrypto');
    const malloc = exports.malloc as (size: number) => number;
    const free = exports.free as (ptr: number) => void;
    const RAND_bytes = exports.RAND_bytes as (buf: number, num: number) => number;
    const memory = exports.memory as WebAssembly.Memory;

    const size = 32;
    const ptr = malloc(size);
    expect(ptr).toBeGreaterThan(0);

    const rc = RAND_bytes(ptr, size);
    expect(rc).toBe(1); // 1 = success in OpenSSL

    // Read the random bytes
    const bytes = new Uint8Array(memory.buffer, ptr, size).slice();
    free(ptr);

    // Should not be all zeros
    const allZero = bytes.every(b => b === 0);
    expect(allZero).toBe(false);
    expect(bytes.length).toBe(32);
  });

  it('should create and free a cipher context', async () => {
    const exports = await loadReactor('libcrypto');
    const CTX_new = exports.EVP_CIPHER_CTX_new as () => number;
    const CTX_free = exports.EVP_CIPHER_CTX_free as (ctx: number) => void;

    const ctx = CTX_new();
    expect(ctx).toBeGreaterThan(0);

    // Free should not throw
    CTX_free(ctx);
  });

  it('should have correct wasm file size (2-4MB expected)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const wasmBytes = await readFile(join(import.meta.dirname, '..', '..', 'wasm', 'libcrypto.wasm'));

    expect(wasmBytes.length).toBeGreaterThan(1_000_000); // > 1MB
    expect(wasmBytes.length).toBeLessThan(10_000_000);   // < 10MB
  });
});
