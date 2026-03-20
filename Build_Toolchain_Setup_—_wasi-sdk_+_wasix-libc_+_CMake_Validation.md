# Build Toolchain Setup — wasi-sdk + wasix-libc + CMake Validation

## Overview

Set up the WASIX C compilation toolchain and validate it end-to-end: install `wasi-sdk` + `wasix-libc`, configure CMake cross-compilation, compile a "hello world" C program to WASIX, load it in the browser via `@wasmer/sdk` `runWasix()`, and confirm execution. This validates the core assumption that the entire project rests on.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §1.3 Build Toolchain, §3.4 WASM Artifact Loading Strategy)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/3eaf28a2-c006-4662-a089-d8c2caf0553f` (Package Scaffold — need the package structure and Wasmer init to test loading)

## Scope

### In Scope
- **wasi-sdk installation**: Download and configure `wasi-sdk` (clang targeting `wasm32-wasi`)
- **wasix-libc sysroot**: Clone/configure `wasix-libc` as the sysroot for POSIX-compatible C compilation
- **CMake toolchain file**: Create/configure `clang-wasm.cmake_toolchain` for cross-compiling C projects to WASIX
- **Build scripts**: `scripts/build-wasm.sh` (or equivalent) that compiles a C source to `.wasm` using the toolchain
- **Validation program**: A minimal C program that exercises key WASIX features needed for the build proof: `printf` (stdout) and file read/write (`fd_read` / `fd_write`). Compile to `hello.wasm`
- **Browser loading test**: Load `hello.wasm` via `WebAssembly.compileStreaming(fetch(...))` + `runWasix(module, { mount: { "/data": dir } })`. Verify stdout output and filesystem operations work
- **Dual-mode distribution wiring**: Configure the `wasm/` directory for bundled distribution. Add CDN base URL config option for lazy-fetch mode. Both paths should load `.wasm` files correctly
- **Git submodule structure**: Set up `native/` directory with git submodule placeholders for C library sources (libuv, openssl, zlib, llhttp, ada, simdutf, quickjs)
- **CI-ready build**: Build script should be reproducible (pinned wasi-sdk version, pinned wasix-libc commit)

### Out of Scope
- Compiling actual C libraries (libuv, libcrypto, llhttp, QuickJS, etc.) — handled by the downstream bridge and library tickets after this toolchain milestone
- Complex WASIX features (networking) — not available

## Acceptance Criteria

1. `wasi-sdk` and `wasix-libc` are installed and the CMake toolchain file works
2. `scripts/build-wasm.sh hello` compiles `native/hello/hello.c` → `wasm/hello.wasm`
3. `hello.wasm` loads in browser via `@wasmer/sdk` `runWasix()` and produces correct stdout output
4. Filesystem mount works: C program writes a file → readable from JS `Directory` object
5. Both bundled (local file) and CDN (fetch from URL) loading paths work
6. `native/` directory has git submodule entries for all 7 C libraries (libuv, openssl, zlib, llhttp, ada, simdutf, quickjs)
7. Build is reproducible: pinned versions, documented prerequisites
8. Threading, process, and higher-level bridge validation are explicitly deferred to `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/b6ce84ad-f2be-4b2d-a10a-12a971bef635` so this ticket remains a pure toolchain milestone
