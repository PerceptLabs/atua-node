# Module Router Full + Cluster + Addon Registry

## Overview

Complete the Module Router with atomic hot-swap capability (the instant transition from unenv to WASIX-backed modules when Wasmer is ready), implement the `cluster` module using Web Workers, and build the native addon registry for loading pre-compiled WASIX addons.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/9d8e95a2-8fa6-4df2-95e6-2f7c23480ac5` (Core Flows — Flow 2: Module Resolution, Flow 6: Native Addon Loading), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §2.3 Addon Registry, §3.2 Module Router + Addon Registry)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/738d0adb-3a78-4f3e-a259-61a197791f85` (Vendored Node JS — all module implementations must exist before the Router can swap them)

## Scope

### In Scope

**Module Router — atomic hot-swap:**
- When Wasmer transitions to ready, atomically upgrade all `wasix` class modules from unenv to WASIX-backed implementations
- Hot-swap must be safe for code that already holds references to the old module — existing `require()` results continue to work, new `require()` calls get the upgraded version
- PROVIDER_REGISTRY extended with WASIX provider attributions (e.g., `{ method: 'createCipheriv', provider: 'wasix-libcrypto' }`)
- Per-module fallback: if a specific `.wasm` fails to load, that module stays at unenv while others upgrade

**child_process module:**
- `child_process.fork(modulePath)` → spawn a new Worker, load the module in a fresh WASIX instance, communicate via MessageChannel (maps to Node's IPC)
- `child_process.exec(command)` → limited shell emulation (run through Atua's shell if available)
- `child_process.spawn(command, args)` → Worker-based process with stdin/stdout/stderr streams

**worker_threads module:**
- `new Worker(filename)` → Web Worker with WASIX instance, SharedArrayBuffer for data sharing
- `parentPort` / `workerData` / `MessagePort` — standard Node worker_threads API
- `worker.postMessage()` / `worker.on('message')` — MessageChannel communication

**cluster module:**
- `cluster.fork()` → spawn Worker with the same script
- `cluster.isMaster` / `cluster.isWorker` — role detection
- Round-robin distribution via MessageChannel (not real `SO_REUSEPORT`)
- `cluster.on('exit')` / `cluster.on('online')` lifecycle events

**Preview/server host adapter:**
- Optional host-supplied adapter that maps `http.createServer()`, `server.listen()`, HMR / SSE, and similar preview-facing flows onto the existing Atua preview infrastructure
- In standalone / no-host environments, listen-style APIs stay unavailable and throw descriptive errors instead of pretending to bind a real socket
- Keeps Vite-style dev-server workflows aligned with the rest of the runtime without requiring WASIX sockets

**Addon Registry:**
- `AddonRegistry` class with built-in mappings for common addons
- `addonRegistry.register(name, { package, wasmPath })` — consumer registration
- `process.dlopen()` interception → check addon registry → lazy load WASIX module from Wasmer registry or bundled `.wasm`
- Extensible: consumers can register custom WASIX-compiled addons

### Out of Scope
- Real `fork()` with copy-on-write — Workers share nothing by default
- Real `SO_REUSEPORT` — cluster uses round-robin messaging
- Pre-compiled addon packages (just the loading infrastructure)

## Acceptance Criteria

1. Module Router hot-swap: after Wasmer init, `require('crypto')` returns the WASIX-backed implementation while `require('path')` still returns unenv
2. Per-module fallback: if `libcrypto.wasm` fails but `zlib.wasm` succeeds, crypto stays at unenv while zlib upgrades
3. `child_process.fork(script)` spawns a Worker that runs the script and communicates via IPC-like MessageChannel
4. `worker_threads.Worker(file)` creates a Web Worker with `parentPort` / `workerData` working
5. `cluster.fork()` spawns Workers, `cluster.isMaster` / `cluster.isWorker` return correct values
6. When a host preview/server adapter is present, `http.createServer().listen()` maps onto that host infrastructure; without it, the API fails with a descriptive unsupported error
7. `addonRegistry.register('better-sqlite3', { wasmPath: '...' })` registers an addon
8. `require('better-sqlite3')` → `process.dlopen()` → addon registry → loads WASIX module → returns working exports
9. PROVIDER_REGISTRY shows WASIX attributions after hot-swap
