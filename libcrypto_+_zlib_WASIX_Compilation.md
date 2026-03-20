# libcrypto + zlib WASIX Compilation

## Overview

Compile OpenSSL 3.x `libcrypto` and `zlib` to WASIX. These close the two largest functional gaps in the existing compat layer: crypto (legacy ciphers, DiffieHellman, OpenSSL error strings) and compression (zlib flush modes, `deflateParams`, exact `windowBits`). This ticket can run **in parallel** with T3-T5 since it only depends on T2 (build toolchain).

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/e8d6adc2-f1f5-41ba-9b3b-f72a74dd337c` (Epic Brief — Crypto gap, Compression gap), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/9d8e95a2-8fa6-4df2-95e6-2f7c23480ac5` (Core Flows — Flow 5: WASIX C Library Execution, crypto example), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §3.2 FFI Bridge Stubs: `binding-crypto`, `binding-zlib`)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/8a35ff6a-9c66-4dd2-974c-055c673935ae` (Build Toolchain — wasi-sdk + wasix-libc + CMake must be working)

## Scope

### In Scope

**libcrypto (OpenSSL 3.x)** — crypto algorithms only, NOT libssl (TLS):
- Clone OpenSSL from git submodule, compile `libcrypto` only to WASIX
- CMake/Configure flags: `no-ssl`, `no-tls`, `no-engine`, `no-afalgeng`, `no-async`, target `wasm32-wasi`
- FFI bridge `binding-crypto` (~200-400 LOC). This is significantly larger than other FFI bridges because the OpenSSL EVP API uses stateful object lifecycles:
  - **Context management**: `EVP_CIPHER_CTX_new()` allocates a context pointer in WASM linear memory. The FFI bridge must track these pointers and expose them as JS objects with `.update()`, `.final()`, `.setAAD()` methods. `EVP_CIPHER_CTX_free()` must be called on GC or explicit cleanup to avoid WASM memory leaks.
  - **Cipher wrappers**: JS class wrapping `EVP_CipherInit_ex` → `EVP_CipherUpdate` → `EVP_CipherFinal_ex` lifecycle. Must handle error states (check return codes, call `ERR_get_error` on failure).
  - **Hash wrappers**: JS class wrapping `EVP_DigestInit_ex` → `EVP_DigestUpdate` → `EVP_DigestFinal_ex`. Must support `.copy()` (clone digest state).
  - **HMAC wrappers**: JS class wrapping `HMAC_Init_ex` → `HMAC_Update` → `HMAC_Final`.
  - **DH wrappers**: JS class wrapping `DH_new` → `DH_generate_parameters_ex` → `DH_generate_key` → `DH_compute_key` → `DH_free`. Must handle custom prime parameters.
  - **RSA/EC wrappers**: JS classes wrapping key generation, sign/verify lifecycles.
  - **Buffer marshaling**: All crypto operations pass byte arrays between JS and WASM linear memory. The bridge must allocate WASM memory for input, copy data in, call the C function, copy results out, and free the WASM allocation. Use a shared scratch buffer for small operations to reduce allocation overhead.
  - **Error handling**: On any EVP failure, call `ERR_get_error()` + `ERR_error_string()` to produce the exact OpenSSL-format error strings that packages parse.
- Covers: AES-GCM, AES-CBC, DES, RC4, Blowfish, ChaCha20-Poly1305, all hash algorithms, HMAC, DiffieHellman with custom primes, RSA key generation, EC key generation, PBKDF2, scrypt, HKDF
- Expected size: 2-4MB `.wasm`

**zlib** — Compression library:
- Clone zlib from git submodule, compile to WASIX
- FFI bridge `binding-zlib` (~80 LOC): `deflateInit2`, `deflate`, `deflateEnd`, `deflateParams`, `inflate`, `inflateInit2`, `inflateEnd`. Stateful but simpler than crypto — one z_stream struct per operation, no deep object hierarchies.
- Covers: all flush modes (`Z_SYNC_FLUSH`, `Z_FULL_FLUSH`, `Z_PARTIAL_FLUSH`, `Z_FINISH`), `deflateParams` mid-stream, exact `windowBits` (8-15 for deflate, +16 for gzip, -15 for raw)
- Expected size: ~100KB `.wasm`

### Out of Scope
- libssl / TLS — atua-net handles TLS via rustls
- Crypto key storage / keychain — not applicable in browser
- brotli compression — could be added later, not in initial scope

## Acceptance Criteria

1. libcrypto compiles to `wasm/libcrypto.wasm` via wasi-sdk (OpenSSL 3.x, `no-ssl` build)
2. AES-256-GCM encrypt/decrypt works via FFI bridge — full lifecycle: `EVP_CIPHER_CTX_new` → `EVP_CipherInit_ex` → `EVP_CipherUpdate` → `EVP_CipherFinal_ex` → `EVP_CIPHER_CTX_free`
3. Legacy ciphers work: DES-CBC, RC4, Blowfish (the gap WebCrypto can't fill)
4. DiffieHellman with custom primes works: `DH_new` → `DH_generate_parameters_ex` → `DH_generate_key` → `DH_compute_key` → `DH_free`
5. `ERR_error_string` returns OpenSSL-format error strings (packages check these)
6. `RAND_bytes` returns cryptographically secure random bytes
7. WASM memory management: cipher/hash contexts are properly freed — no memory leak after 1000 encrypt/decrypt cycles
8. zlib compiles to `wasm/zlib.wasm`
9. `Z_SYNC_FLUSH` and `Z_FULL_FLUSH` produce correct output (the gap `CompressionStream` can't fill)
10. `deflateParams` mid-stream level change works
11. Exact `windowBits` control works (gzip vs deflate vs raw)
