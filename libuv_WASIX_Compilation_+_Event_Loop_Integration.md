# libuv WASIX Compilation + Event Loop Integration

## Overview

Compile libuv to WASIX and integrate it as the event loop backend for `@aspect/atua-node`. This is the **highest-risk ticket** — it requires a custom WASIX platform backend (~500-800 LOC C) and browser event loop integration. The approach is incremental: ship a TypeScript phase-ordering shim first (immediate value, low risk), then replace it with the full libuv WASIX compilation (high fidelity).

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §1.4 Phase 2, libuv approach: "Full libuv compiled to WASIX, with TS phase-ordering shim as initial implementation")

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/b6ce84ad-f2be-4b2d-a10a-12a971bef635` (WASIX Bridges — libuv needs fs-bridge for file operations, net-bridge for socket operations, thread-bridge for thread pool)

## Scope

### In Scope

**Phase A: TypeScript Phase-Ordering Shim** (ships first)
- Implement libuv's event loop phase ordering in TypeScript (~300 LOC):
  - Timers phase → `setTimeout` callbacks in min-heap order
  - Pending callbacks → deferred I/O callbacks
  - Idle/prepare → internal hooks
  - Poll → I/O completion (browser microtask drain)
  - Check → `setImmediate` callbacks
  - Close → `socket.on('close')` etc.
- Wire `process.nextTick()` → microtask queue (runs between every phase)
- Wire `setImmediate()` → check phase (after poll, before close)
- Integrate with browser's event loop via `MessageChannel` for phase stepping

**Phase B: Full libuv WASIX Compilation** (replaces shim)
- Compile libuv from git submodule using wasi-sdk + wasix-libc + CMake toolchain
- Write WASIX platform backend (`src/unix/wasix.c` or equivalent):
  - Timer backend → WASIX `poll_oneoff` with timeout
  - FS backend → WASIX `fd_read`/`fd_write`/`path_open` (routed through fs-bridge → AtuaFS)
  - Socket backend → net-bridge adapter (NOT WASIX `sock_*`)
  - Thread pool → WASIX `thread_spawn` (routed through thread-bridge → Web Workers)
  - Event loop → `uv_run()` called periodically from browser via `requestAnimationFrame` / `MessageChannel`
- FFI bridge: `binding-uv` (~50 LOC) — marshals JS calls to libuv C functions
- Browser integration: `uv_run(UV_RUN_NOWAIT)` called from the browser's event loop, yielding control back to the browser between iterations

### Out of Scope
- Socket listening (`uv_tcp_bind` + `uv_listen`) — deferred with µSockets
- DNS resolution via libuv (use browser `fetch` for DNS) — stub to browser resolution
- Signal handling via libuv — deferred to T10

## Acceptance Criteria

1. **Phase A (shim)**: `process.nextTick(fn)` runs before `setImmediate(fn)` runs before `setTimeout(fn, 0)` — matching libuv phase ordering
2. **Phase A (shim)**: Multiple `nextTick` callbacks exhaust before any I/O callback runs
3. **Phase B (libuv)**: libuv compiles to WASIX without errors using wasi-sdk + wasix-libc
4. **Phase B (libuv)**: `libuv.wasm` loads in browser via `runWasix()` 
5. **Phase B (libuv)**: Timer operations work: `uv_timer_init` + `uv_timer_start` fires callback at correct time
6. **Phase B (libuv)**: FS operations work through libuv: `uv_fs_open` + `uv_fs_read` reads from AtuaFS
7. **Phase B (libuv)**: Thread pool works: `uv_queue_work` dispatches to worker thread and calls completion callback
8. Phase shim is swappable — when libuv.wasm loads, the shim's scheduling is replaced by libuv's loop
