# Epic Brief — @aspect/atua-node

## Summary

`@aspect/atua-node` is an optional Node.js compatibility upgrade layer for the Atua browser-native runtime. It compiles real C libraries (libuv, llhttp, ada, simdutf, libcrypto, zlib, QuickJS) to WASIX via `wasi-sdk` + `wasix-libc` and runs them in-browser through `@wasmer/sdk`. This closes Atua's Node.js compatibility gap from ~96% (existing `NodeCompatLoader` + unenv base) to ~99.5%.

The existing compat layer remains the permanent foundation. When `@wasmer/sdk` initializes successfully (requires COOP/COEP + SharedArrayBuffer), a Module Router hot-swaps specific modules to WASIX-backed implementations. If Wasmer fails to load, everything gracefully degrades to the 96% base — no breakage, no user-visible error.

Networking is handled by `atua-net`, an existing production Rust/WASM library providing HTTPS fetch, raw TCP/TLS streams, and WebSocket via Wisp relay — not through WASIX socket syscalls (which are not yet available in the browser SDK). WASIX handles compute-heavy C libraries; `atua-net` handles all network I/O.

## Context & Problem

**Who's affected:** Developers building Node.js-compatible applications inside Atua. Agent (Pi) executing npm packages that depend on Node internals. Any consumer application using Atua as its runtime.

**Where in the product:** The Node.js compatibility surface — the layer between `require('crypto')` / `require('fs')` / `require('http')` and the browser primitives that back them.

**The current pain:**

- **Crypto gap** — The existing layer bridges to WebCrypto, which lacks legacy ciphers (DES, RC4, Blowfish), DiffieHellman with custom primes, and OpenSSL-format error strings. Packages checking for these fail or take degraded paths.
- **HTTP parsing gap** — `unenv` HTTP stubs don't match Node's exact error codes, malformed-request tolerance, or header handling. Express/Fastify middleware breaks on edge cases.
- `**vm` module** — Does not exist. Packages using `vm.createContext()` / `vm.runInNewContext()` (template engines, schema validators, REPLs) cannot run.
- **Compression gap** — `CompressionStream` doesn't support all zlib flush modes (`Z_SYNC_FLUSH`, `Z_FULL_FLUSH`), `deflateParams` mid-stream, or exact `windowBits` edge cases.
- **URL parsing gap** — Browser `new URL()` produces different results from Node's for IDN, backslash normalization, and opaque paths.
- **Process fidelity** — Packages check `process.versions.node`, `process.platform`, `process.arch` at import time. Wrong values cause packages to take browser-fallback paths instead of their full Node paths.
- **Event loop fidelity** — `setTimeout`/`setImmediate`/`process.nextTick` phase ordering doesn't match libuv's precise phase sequencing. Programs depending on exact ordering break subtly.
- **Missing modules** — `child_process`, `worker_threads`, `cluster` throw instead of providing functional (even if approximate) implementations.

These gaps collectively prevent running real-world Node.js toolchains (Vite, Vitest, Express) and npm packages with native-like fidelity inside the browser.

**Why now:** The `@wasmer/sdk` ecosystem has matured (v0.10.0, filesystem/threading/subprocess support confirmed in-browser). EdgeJS just launched with MIT license validating the "compile Node's C libraries to WASIX" approach. `atua-net` already solves the browser networking problem. The architecture is ready.

## Key Decisions Made


| Decision             | Choice                                                                       | Rationale                                                                      |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Relationship to base | Progressive enhancement — never replaces existing `NodeCompatLoader` + unenv | Graceful degradation if Wasmer fails                                           |
| Build toolchain      | `wasi-sdk` + `wasix-libc` sysroot (NOT Emscripten)                           | Correct WASIX compilation target, pure `.wasm` output                          |
| Networking           | `atua-net` (existing Rust/WASM library via Wisp relay)                       | WASIX `sock_*` not available in browser SDK; atua-net already production-grade |
| COOP/COEP            | Required for WASIX layer, NOT required for base Atua                         | Core Atua stays header-free; atua-node is an optional upgrade                  |
| EdgeJS               | Monitor, don't integrate — stay per-module                                   | EdgeJS is server-side; our problem is browser-side                             |
| C library philosophy | Compile the real C library, don't translate APIs                             | Node's bindings call the same functions they always call                       |
| Implementation agent | Claude Code (AI agent)                                                       | Tickets must be self-contained with full context                               |


## Scope

**In scope:** Module Router, WASIX bridges (fs, thread, proc), client-side networking integration via `atua-net`, libuv, llhttp, ada, simdutf, libcrypto, zlib, QuickJS, vendored Node JS (including `http`, `https`, `net`, `tls`, `dns`, `os`, `stream`, `timers`, and `process` facades), internalBinding stubs, `child_process`, `worker_threads`, `cluster`, addon registry, optional host preview/server adapter integration for `listen()`-style workflows inside Atua, AtuaFS extensions, Buffer, signals, validation (Vitest, Vite, Bun bench).

**Out of scope:** WASIX socket networking (deferred until Wasmer ships it), µSockets/uWebSockets compilation, EdgeJS integration, real `fork()` with COW, real `SO_REUSEPORT`, true `dlopen`, V8 code caching, real POSIX signals.