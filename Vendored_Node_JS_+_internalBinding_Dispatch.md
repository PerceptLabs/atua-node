# Vendored Node JS + internalBinding Dispatch

## Overview

Vendor Node.js's JavaScript internals (MIT-licensed `lib/internal/` code) and wire them to the compiled C libraries via `internalBinding()` dispatch. This is the glue layer that makes the C libraries behave like real Node modules — vendored JS calls `internalBinding('crypto')` which routes to the FFI bridge for libcrypto, and so on.

**This is the most complex integration ticket.** The vendored Node JS files cannot be copied verbatim — they require adaptation. And the `internalBinding()` stubs are not simple function-forwarding — they must return objects that mirror Node's C++ class instances with WASM pointer lifecycle management.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §3.2 Vendored Node JS, Component Responsibilities)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/ce6388e3-9f25-4391-ad4a-84bd3c2b8a42` (libuv — event loop for timers/scheduling), `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/d6c89884-26d2-430e-856b-7967ead3fc67` (llhttp/ada/simdutf — parsers), `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/706e4588-27a2-4df1-98b2-9baac582f66c` (libcrypto/zlib — crypto and compression), `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/3b62ecc1-0bcc-43f5-bb82-729eeecaea89` (QuickJS — vm)

## Scope

### In Scope

**Vendored Node.js JavaScript adaptation** (from Node.js `lib/` and `lib/internal/`, MIT licensed):

Node's internal JS files cannot be copied as-is. They require a transformation step to run in the browser. The adaptations are:

1. **Primordials polyfill.** Node's internal code uses a `primordials` object — frozen copies of built-in prototypes (`primordials.ArrayPrototypeSlice`, `primordials.ObjectDefineProperty`, `primordials.StringPrototypeStartsWith`, etc.) to protect against user code monkey-patching globals. Create a `src/vendor/primordials.js` that provides this object by capturing the built-in methods at module load time. This is ~100-150 LOC — enumerate the primordials Node actually uses in the vendored files, not the full set.

2. **Internal module path rewriting.** Node's internal files use `require('internal/streams/readable')`, `require('internal/errors')`, etc. These must be rewritten to point to the vendored file locations: `require('internal/streams/readable')` → `require('./streams/readable')` or equivalent.

3. **V8 syntax stripping.** Some Node internals use `%BuiltinName%` V8 intrinsic syntax (e.g., `%ArrayBufferDetach%`). These are rare in the files we vendor but must be replaced with standard JS equivalents where they occur. Audit the vendored files and replace any `%Foo%` calls.

4. **`internalBinding()` injection.** Replace Node's built-in `internalBinding` mechanism with our dispatch function. This is the wiring layer — described in detail below.

**Vendored files:**
- `streams/*.js` — Readable, Writable, Duplex, Transform, pipeline, backpressure, pipe, destroy propagation
- `timers.js` — setTimeout/setInterval/setImmediate scheduled into libuv loop phases
- `process/*.js` — nextTick queue, exit handling, hrtime, env, versions, platform, arch
- `errors.js` — Node error code system (ERR_INVALID_ARG_TYPE, ERR_MISSING_ARGS, etc.)
- `console.js` — Node-specific console formatting (Console class, table, assert, dir)
- `crypto/*.js` — Node's crypto module JS layer that calls `internalBinding('crypto')`
- `zlib.js` — Node's zlib module JS layer that calls `internalBinding('zlib')`
- `http.js` / `https.js` / `http2.js` — Node's HTTP module JS; client transport rides `atua-net`, while parser-sensitive HTTP/1.x behavior calls `internalBinding('http_parser')`
- `net.js` / `tls.js` — client-side socket facades over `atua-net` stream handles
- `dns.js` / `os.js` — facades over browser / host resolution and runtime metadata
- `url.js` — Node's URL module JS that calls `internalBinding('url')`
- `vm.js` — Node's vm module JS that calls `internalBinding('vm')`

**internalBinding() dispatch system:**

`internalBinding(name)` does NOT return a bag of functions. It returns **objects that mirror Node's C++ class instances**. The vendored Node JS calls patterns like `new internalBinding('crypto').Hash(algorithm)` and expects an object with `.update()`, `.digest()`, `.copy()` methods that manage an internal C pointer.

Each binding module must:
- Return constructor functions / classes that match Node's internal C++ class shapes
- Manage WASM pointer lifecycles — allocate on construction, free on GC or explicit close
- Handle error states — check C function return codes, call `ERR_get_error()` on failure
- Marshal buffers between JS and WASM linear memory

Registrations:
- `'crypto'` → `binding-crypto` — returns `Hash`, `Hmac`, `CipherBase`, `DiffieHellman`, `ECDH`, `Sign`, `Verify`, `PBKDF2Job`, `ScryptJob`, `RandomBytesJob` constructors. Each wraps a WASM pointer with prototype methods. ~200-400 LOC (see libcrypto ticket for detail).
- `'zlib'` → `binding-zlib` — returns `Zlib` constructor wrapping z_stream pointer. ~80 LOC.
- `'http_parser'` → `binding-http-parser` — returns `HTTPParser` constructor wrapping llhttp instance. ~80 LOC.
- `'url'` → `binding-url` — returns ada parse/get functions. ~50 LOC.
- `'uv'` → `binding-uv` — returns timer/loop scheduling functions. ~50 LOC.
- `'vm'` → `binding-vm` — returns QuickJS context wrappers. ~100 LOC.
- `'encoding'` → `binding-encoding` — returns simdutf transcoding functions. ~50 LOC.
- `'tcp_wrap'` → `binding-tcp-wrap` — returns `TCP` constructor wrapping atua-net stream handles (NOT WASIX sockets). ~100 LOC.
- `'tls_wrap'` → `binding-tls-wrap` — returns `TLSWrap` constructor over atua-net TLS streams. ~100 LOC.
- `'stream_wrap'` → `binding-stream-wrap` — performance passthrough, correctness lives in vendored JS. ~20 LOC.

**process object enrichment:**
- `process.versions.node` → target Node version string (e.g., `'22.0.0'`)
- `process.platform` → `'linux'` (not `'browser'` — packages branch on this and `'linux'` gives them the best code paths)
- `process.arch` → `'x64'` (NOT `'wasm32'` — packages branch on arch and `'wasm32'` causes unexpected fallback paths. `'x64'` matches what Node programs expect and gives them their normal code paths.)
- `process.hrtime` / `process.hrtime.bigint` → high-resolution timer
- `process.env` → environment variables from config

**atua-net integration for networking facades:**

The vendored `net.js`, `tls.js`, `http.js`, `https.js` files internally manage sockets via libuv TCP handle abstractions. The `binding-tcp-wrap` and `binding-tls-wrap` stubs must present atua-net streams as objects that look enough like libuv TCP handles that Node's HTTP internals don't break. Key interface points:
- `TCP` handle must support `.readStart()`, `.readStop()`, `.writeBuffer()`, `.close()`, `.shutdown()`
- These map to atua-net's `atua_stream_send()`, `atua_stream_recv()`, `atua_stream_close()`
- Connection state tracking (`connecting`, `connected`, `closing`, `closed`) must match libuv handle lifecycle

### Out of Scope
- `child_process` module wiring — covered by `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/6db5018d-0eef-4444-b097-ecbff9612404`
- `worker_threads` module wiring — covered by `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/6db5018d-0eef-4444-b097-ecbff9612404`
- Real socket listening via WASIX `sock_*` or µSockets — deferred; client-side `net` / `tls` / `dns` facades are in scope here, while listen-style server mapping is handled by `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/6db5018d-0eef-4444-b097-ecbff9612404`

## Acceptance Criteria

1. **Vendored JS adaptation**: Primordials polyfill exists and vendored files load without `primordials is not defined` errors
2. **Vendored JS adaptation**: Internal module paths rewritten — `require('internal/streams/readable')` resolves to vendored file
3. **Vendored JS adaptation**: No `%BuiltinName%` V8 syntax remains in vendored files
4. `internalBinding('crypto')` returns an object with constructor functions (`Hash`, `CipherBase`, `DiffieHellman`, etc.) that manage WASM pointer lifecycles
5. `require('crypto').createCipheriv('aes-256-gcm', key, iv)` works end-to-end: vendored JS → internalBinding → FFI bridge → libcrypto.wasm
6. `require('crypto').createDiffieHellman(prime)` works (the gap that caused this whole project)
7. `require('zlib').createGzip({ flush: zlib.Z_SYNC_FLUSH })` works with all flush modes
8. `require('net').connect(port, host)` returns a client socket backed by `atua-net` — the `TCP` handle wrapper maps atua-net stream operations to libuv handle interface
9. `require('tls').connect(opts)` establishes a TLS client socket backed by `atua-net` / rustls
10. `require('dns').lookup(host)` returns results in the expected Node API shape using browser or host resolution
11. `require('http').request(url)` uses `atua-net` for transport and llhttp wherever parser fidelity is required
12. `require('url').parse(str)` matches Node's behavior for IDN, backslash, opaque paths
13. `require('vm').runInNewContext(code, sandbox)` works via QuickJS
14. `process.versions.node` returns a valid Node version string
15. `process.platform === 'linux'` and `process.arch === 'x64'`
16. `process.nextTick(fn)` runs in correct phase order relative to `setImmediate` / `setTimeout`
17. Node's stream classes (Readable, Writable, Transform, pipeline) work with backpressure
