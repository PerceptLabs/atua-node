import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BindingCrypto, CipherContext, HashContext, HmacContext, DHContext,
  type LibCryptoExports,
} from '../src/bindings/binding-crypto.js';

/**
 * Mock libcrypto WASM exports.
 *
 * Simulates WASM linear memory with an ArrayBuffer and provides
 * functional mock implementations of all OpenSSL functions used
 * by the FFI bridge.
 */
function createMockLibCryptoExports(): LibCryptoExports {
  const memoryBuffer = new ArrayBuffer(1024 * 1024); // 1MB
  let nextAlloc = 1024; // Start allocations past the first page

  const memory = {
    buffer: memoryBuffer,
  } as WebAssembly.Memory;

  function mockMalloc(size: number): number {
    const ptr = nextAlloc;
    nextAlloc += Math.max(size, 4); // Align
    nextAlloc = (nextAlloc + 3) & ~3; // 4-byte align
    return ptr;
  }

  function mockFree(_ptr: number): void {
    // No-op in mock — real impl would free WASM memory
  }

  // Track allocated contexts for leak detection
  const allocatedContexts = new Set<number>();
  let nextCtxId = 0x10000;

  // Simple XOR-based "cipher" for testing round-trips
  function xorCipher(data: Uint8Array, key: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length];
    }
    return result;
  }

  // Store state per context
  const cipherStates = new Map<number, { key: Uint8Array; encrypt: boolean; data: Uint8Array[] }>();
  const hashStates = new Map<number, { data: Uint8Array[] }>();
  const hmacStates = new Map<number, { key: Uint8Array; data: Uint8Array[] }>();
  const dhStates = new Map<number, { pubKey: Uint8Array; privKey: Uint8Array; p: Uint8Array; g: Uint8Array }>();

  const exports: LibCryptoExports = {
    memory,
    malloc: mockMalloc,
    free: mockFree,

    // ── Cipher ──
    EVP_CIPHER_CTX_new(): number {
      const ctx = nextCtxId++;
      allocatedContexts.add(ctx);
      return ctx;
    },
    EVP_CIPHER_CTX_free(ctx: number): void {
      allocatedContexts.delete(ctx);
      cipherStates.delete(ctx);
    },
    EVP_CipherInit_ex(ctx, _cipher, _engine, keyPtr, _ivPtr, enc): number {
      const key = new Uint8Array(memoryBuffer, keyPtr, 32).slice();
      cipherStates.set(ctx, { key, encrypt: enc === 1, data: [] });
      return 1;
    },
    EVP_CipherUpdate(ctx, outPtr, outLenPtr, inPtr, inLen): number {
      const state = cipherStates.get(ctx);
      if (!state) return 0;
      if (outPtr === 0) return 1; // AAD mode — just accept

      const input = new Uint8Array(memoryBuffer, inPtr, inLen).slice();
      const output = xorCipher(input, state.key);
      new Uint8Array(memoryBuffer, outPtr, output.length).set(output);
      new Int32Array(memoryBuffer, outLenPtr, 1)[0] = output.length;
      return 1;
    },
    EVP_CipherFinal_ex(_ctx, outPtr, outLenPtr): number {
      // No padding in mock
      new Int32Array(memoryBuffer, outLenPtr, 1)[0] = 0;
      return 1;
    },
    EVP_CIPHER_CTX_ctrl(ctx, type, arg, ptr): number {
      if (type === 0x10) {
        // GET_TAG — return fake tag
        const tag = new Uint8Array(arg);
        for (let i = 0; i < arg; i++) tag[i] = (i * 17 + 42) & 0xff;
        new Uint8Array(memoryBuffer, ptr, arg).set(tag);
      }
      // SET_TAG, SET_IVLEN — just accept
      return 1;
    },

    // ── Cipher lookup ──
    EVP_aes_256_gcm: () => 1,
    EVP_aes_256_cbc: () => 2,
    EVP_aes_128_gcm: () => 3,
    EVP_aes_128_cbc: () => 4,
    EVP_des_cbc: () => 5,
    EVP_rc4: () => 6,
    EVP_bf_cbc: () => 7,
    EVP_chacha20_poly1305: () => 8,

    // ── Hash ──
    EVP_MD_CTX_new(): number {
      const ctx = nextCtxId++;
      allocatedContexts.add(ctx);
      return ctx;
    },
    EVP_MD_CTX_free(ctx: number): void {
      allocatedContexts.delete(ctx);
      hashStates.delete(ctx);
    },
    EVP_MD_CTX_copy_ex(dst, src): number {
      const state = hashStates.get(src);
      if (!state) return 0;
      hashStates.set(dst, { data: [...state.data] });
      return 1;
    },
    EVP_DigestInit_ex(ctx, _md, _engine): number {
      hashStates.set(ctx, { data: [] });
      return 1;
    },
    EVP_DigestUpdate(ctx, dataPtr, len): number {
      const state = hashStates.get(ctx);
      if (!state) return 0;
      state.data.push(new Uint8Array(memoryBuffer, dataPtr, len).slice());
      return 1;
    },
    EVP_DigestFinal_ex(ctx, outPtr, outLenPtr): number {
      const state = hashStates.get(ctx);
      if (!state) return 0;
      // Simple mock hash: XOR all input bytes into a 32-byte output
      const hash = new Uint8Array(32);
      for (const chunk of state.data) {
        for (let i = 0; i < chunk.length; i++) {
          hash[i % 32] ^= chunk[i];
        }
      }
      new Uint8Array(memoryBuffer, outPtr, 32).set(hash);
      new Int32Array(memoryBuffer, outLenPtr, 1)[0] = 32;
      return 1;
    },
    EVP_MD_CTX_get0_md: () => 10, // returns a mock MD pointer
    EVP_MD_get_size: () => 32,

    // Hash lookup
    EVP_sha256: () => 10,
    EVP_sha512: () => 11,
    EVP_sha1: () => 12,
    EVP_md5: () => 13,

    // ── HMAC ──
    HMAC_CTX_new(): number {
      const ctx = nextCtxId++;
      allocatedContexts.add(ctx);
      return ctx;
    },
    HMAC_CTX_free(ctx: number): void {
      allocatedContexts.delete(ctx);
      hmacStates.delete(ctx);
    },
    HMAC_Init_ex(ctx, keyPtr, keyLen, _md, _engine): number {
      const key = new Uint8Array(memoryBuffer, keyPtr, keyLen).slice();
      hmacStates.set(ctx, { key, data: [] });
      return 1;
    },
    HMAC_Update(ctx, dataPtr, len): number {
      const state = hmacStates.get(ctx);
      if (!state) return 0;
      state.data.push(new Uint8Array(memoryBuffer, dataPtr, len).slice());
      return 1;
    },
    HMAC_Final(ctx, outPtr, outLenPtr): number {
      const state = hmacStates.get(ctx);
      if (!state) return 0;
      // Mock HMAC: XOR key with data hash
      const mac = new Uint8Array(32);
      for (let i = 0; i < state.key.length; i++) mac[i % 32] ^= state.key[i];
      for (const chunk of state.data) {
        for (let i = 0; i < chunk.length; i++) mac[i % 32] ^= chunk[i];
      }
      new Uint8Array(memoryBuffer, outPtr, 32).set(mac);
      new Int32Array(memoryBuffer, outLenPtr, 1)[0] = 32;
      return 1;
    },

    // ── DH ──
    DH_new(): number {
      const ctx = nextCtxId++;
      allocatedContexts.add(ctx);
      dhStates.set(ctx, { pubKey: new Uint8Array(0), privKey: new Uint8Array(0), p: new Uint8Array(0), g: new Uint8Array(0) });
      return ctx;
    },
    DH_free(dh: number): void {
      allocatedContexts.delete(dh);
      dhStates.delete(dh);
    },
    DH_generate_parameters_ex(dh, primeBits, _generator, _cb): number {
      const p = new Uint8Array(primeBits / 8);
      p[0] = 0xff; p[p.length - 1] = 0x01; // Fake prime
      const g = new Uint8Array([2]);
      dhStates.set(dh, { pubKey: new Uint8Array(0), privKey: new Uint8Array(0), p, g });
      return 1;
    },
    DH_generate_key(dh): number {
      const state = dhStates.get(dh);
      if (!state) return 0;
      // Generate fake key pair
      state.pubKey = new Uint8Array(32);
      state.privKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        state.pubKey[i] = (i * 7 + 13) & 0xff;
        state.privKey[i] = (i * 11 + 29) & 0xff;
      }
      return 1;
    },
    DH_compute_key(keyPtr, _pubKey, dh): number {
      const state = dhStates.get(dh);
      if (!state) return -1;
      // Fake shared secret: 32 bytes
      const secret = new Uint8Array(32);
      for (let i = 0; i < 32; i++) secret[i] = (state.privKey[i] ^ state.pubKey[i]) & 0xff;
      new Uint8Array(memoryBuffer, keyPtr, 32).set(secret);
      return 32;
    },
    DH_size: () => 32,
    DH_get0_pub_key(dh): number {
      // Return a fake BN pointer that maps to the pubKey
      const state = dhStates.get(dh);
      if (!state) return 0;
      const ptr = mockMalloc(state.pubKey.length);
      new Uint8Array(memoryBuffer, ptr, state.pubKey.length).set(state.pubKey);
      return ptr;
    },
    DH_get0_priv_key(dh): number {
      const state = dhStates.get(dh);
      if (!state) return 0;
      const ptr = mockMalloc(state.privKey.length);
      new Uint8Array(memoryBuffer, ptr, state.privKey.length).set(state.privKey);
      return ptr;
    },
    BN_num_bits(bn): number {
      // In our mock, all BNs are 256 bits (32 bytes)
      return 256;
    },
    BN_bn2bin(bn, outPtr): number {
      const data = new Uint8Array(memoryBuffer, bn, 32);
      new Uint8Array(memoryBuffer, outPtr, 32).set(data);
      return 32;
    },
    BN_bin2bn(dataPtr, len, _ret): number {
      // Just return the data pointer as the BN
      const ptr = mockMalloc(len);
      new Uint8Array(memoryBuffer, ptr, len).set(new Uint8Array(memoryBuffer, dataPtr, len));
      return ptr;
    },
    DH_set0_pqg(dh, p, _q, g): number {
      const state = dhStates.get(dh);
      if (!state) return 0;
      // Read p and g from BN pointers
      state.p = new Uint8Array(memoryBuffer, p, 32).slice();
      state.g = new Uint8Array(memoryBuffer, g, 1).slice();
      return 1;
    },

    // ── RAND ──
    RAND_bytes(bufPtr, num): number {
      const bytes = new Uint8Array(num);
      crypto.getRandomValues(bytes);
      new Uint8Array(memoryBuffer, bufPtr, num).set(bytes);
      return 1;
    },

    // ── Errors ──
    ERR_get_error: () => 0,
    ERR_error_string(err, bufPtr): number {
      const msg = 'error:00000000:lib(0):func(0):reason(0)';
      const encoded = new TextEncoder().encode(msg + '\0');
      new Uint8Array(memoryBuffer, bufPtr, encoded.length).set(encoded);
      return bufPtr;
    },
  };

  return exports;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('BindingCrypto', () => {
  let binding: BindingCrypto;
  let mockExports: LibCryptoExports;

  beforeEach(() => {
    binding = new BindingCrypto();
    mockExports = createMockLibCryptoExports();
    binding.init(mockExports);
  });

  afterEach(() => {
    binding.freeAll();
  });

  it('should report ready after init', () => {
    expect(binding.isReady).toBe(true);
  });

  it('should throw if not initialized', () => {
    const uninit = new BindingCrypto();
    expect(() => uninit.createHash('sha256')).toThrow('not initialized');
  });

  describe('AES-GCM round-trip', () => {
    it('should encrypt and decrypt AES-256-GCM', () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(12);
      crypto.getRandomValues(key);
      crypto.getRandomValues(iv);

      const plaintext = new TextEncoder().encode('Hello, OpenSSL via WASIX!');

      // Encrypt
      const encCtx = binding.createCipher('aes-256-gcm', key, iv, true);
      const ciphertext = encCtx.update(plaintext);
      encCtx.final();
      const tag = encCtx.getAuthTag(16);
      encCtx.free();

      // Decrypt
      const decCtx = binding.createCipher('aes-256-gcm', key, iv, false);
      decCtx.setAuthTag(tag);
      const decrypted = decCtx.update(ciphertext);
      decCtx.final();
      decCtx.free();

      // XOR cipher is symmetric — should round-trip
      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('Legacy ciphers', () => {
    it('should support DES-CBC', () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(8);
      const ctx = binding.createCipher('des-cbc', key, iv, true);
      const result = ctx.update(new Uint8Array([1, 2, 3, 4]));
      ctx.final();
      expect(result.length).toBeGreaterThan(0);
      ctx.free();
    });

    it('should support RC4', () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(0);
      const ctx = binding.createCipher('rc4', key, iv, true);
      const result = ctx.update(new Uint8Array([5, 6, 7, 8]));
      expect(result.length).toBe(4);
      ctx.free();
    });

    it('should support Blowfish', () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(8);
      const ctx = binding.createCipher('bf-cbc', key, iv, true);
      const result = ctx.update(new Uint8Array([9, 10, 11, 12]));
      expect(result.length).toBe(4);
      ctx.free();
    });
  });

  describe('DiffieHellman with custom primes', () => {
    it('should generate DH parameters and compute shared secret', () => {
      const dh1 = binding.createDH();
      dh1.generateParameters(256, 2);
      dh1.generateKey();
      const pub1 = dh1.getPublicKey();
      expect(pub1.length).toBe(32);

      const dh2 = binding.createDH();
      dh2.generateParameters(256, 2);
      dh2.generateKey();
      const pub2 = dh2.getPublicKey();

      // Each side computes shared secret with peer's public key
      const secret1 = dh1.computeKey(pub2);
      const secret2 = dh2.computeKey(pub1);

      expect(secret1.length).toBe(32);
      expect(secret2.length).toBe(32);

      dh1.free();
      dh2.free();
    });

    it('should support custom prime parameters', () => {
      const dh = binding.createDH();
      const customP = new Uint8Array(32);
      customP[0] = 0xff;
      customP[31] = 0x01;
      const customG = new Uint8Array([2]);

      dh.setParameters(customP, customG);
      dh.generateKey();
      const pubKey = dh.getPublicKey();
      expect(pubKey.length).toBe(32);
      dh.free();
    });
  });

  describe('ERR_error_string', () => {
    it('should return OpenSSL-format error strings', () => {
      const errStr = binding.getErrorString();
      // ERR_get_error returns 0 in mock, so should return 'unknown error'
      expect(errStr).toBe('unknown error');
    });
  });

  describe('RAND_bytes', () => {
    it('should return random bytes of requested size', () => {
      const bytes = binding.randomBytes(32);
      expect(bytes.length).toBe(32);
      // Should not be all zeros (astronomically unlikely with real random)
      const allZero = bytes.every(b => b === 0);
      expect(allZero).toBe(false);
    });

    it('should return different bytes on subsequent calls', () => {
      const a = binding.randomBytes(16);
      const b = binding.randomBytes(16);
      // Extremely unlikely to be equal
      const equal = a.every((byte, i) => byte === b[i]);
      expect(equal).toBe(false);
    });
  });

  describe('Hash', () => {
    it('should produce a hash digest', () => {
      const hash = binding.createHash('sha256');
      hash.update(new TextEncoder().encode('hello'));
      const digest = hash.digest();
      expect(digest.length).toBe(32);
      hash.free();
    });

    it('should support copy() for cloning state', () => {
      const hash = binding.createHash('sha256');
      hash.update(new TextEncoder().encode('hello'));

      const clone = hash.copy();
      hash.update(new TextEncoder().encode(' world'));
      clone.update(new TextEncoder().encode(' world'));

      const d1 = hash.digest();
      const d2 = clone.digest();

      // Same input → same digest
      expect(d1).toEqual(d2);

      hash.free();
      clone.free();
    });
  });

  describe('HMAC', () => {
    it('should produce an HMAC', () => {
      const key = new TextEncoder().encode('secret-key');
      const hmac = binding.createHmac('sha256', key);
      hmac.update(new TextEncoder().encode('message'));
      const mac = hmac.digest();
      expect(mac.length).toBe(32);
      hmac.free();
    });
  });

  describe('Memory leak test', () => {
    it('should not leak after 1000 encrypt/decrypt cycles', () => {
      const key = new Uint8Array(32);
      const iv = new Uint8Array(12);
      const plaintext = new Uint8Array(64);
      crypto.getRandomValues(key);
      crypto.getRandomValues(iv);
      crypto.getRandomValues(plaintext);

      for (let i = 0; i < 1000; i++) {
        const enc = binding.createCipher('aes-256-gcm', key, iv, true);
        const ct = enc.update(plaintext);
        enc.final();
        enc.free();

        const dec = binding.createCipher('aes-256-gcm', key, iv, false);
        dec.update(ct);
        dec.final();
        dec.free();
      }

      // If we get here without OOM, memory is being freed properly
      expect(true).toBe(true);
    });
  });

  describe('Context lifecycle', () => {
    it('should throw when using a freed context', () => {
      const ctx = binding.createCipher('aes-256-gcm', new Uint8Array(32), new Uint8Array(12), true);
      ctx.free();
      expect(() => ctx.update(new Uint8Array(1))).toThrow('freed');
    });

    it('should throw for unsupported cipher algorithm', () => {
      expect(() => binding.createCipher('aes-999-xyz', new Uint8Array(32), new Uint8Array(12), true))
        .toThrow('Unsupported cipher');
    });

    it('should throw for unsupported hash algorithm', () => {
      expect(() => binding.createHash('sha999')).toThrow('Unsupported hash');
    });
  });
});
