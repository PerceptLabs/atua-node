# Package Scaffold + @wasmer/sdk Init + Module Router Skeleton

## Overview

Set up the standalone `@aspect/atua-node` package from scratch and implement the two foundational components: the Wasmer Initializer (background `@wasmer/sdk` bootstrap with COOP/COEP detection) and the Module Router skeleton (wraps `NativeModuleLoader`, dispatches by fidelity class, emits lifecycle events).

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/e8d6adc2-f1f5-41ba-9b3b-f72a74dd337c` (Epic Brief — architecture, progressive enhancement), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/9d8e95a2-8fa6-4df2-95e6-2f7c23480ac5` (Core Flows — Flow 1: Runtime Init, Flow 2: Module Resolution, Flow 3: Graceful Degradation), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §1.2 Key Decisions, §2.1 Module Registry, §3.2 Module Router + Wasmer Initializer)

**Dependencies:** None — this is the first ticket.

## Scope

### In Scope
- **Package structure**: standalone TypeScript package with `tsconfig.json`, `package.json` (`@aspect/atua-node`), build config (tsup/esbuild). Directory layout: `src/router/`, `src/wasmer/`, `src/bridges/` (stubs), `src/bindings/` (stubs), `src/vendor/` (empty), `wasm/` (empty, for future `.wasm` files)
- **Wasmer Initializer**: `WasmerInitializer` class that checks for COOP/COEP headers and `SharedArrayBuffer` availability, calls `@wasmer/sdk` `init()` in background, reports success/failure, supports `retryWasmerInit()` for re-initialization
- **Module Router skeleton**: `ModuleRouter` class with the module registry data structure (name, fidelityClass, baseImpl, wasixImpl, wasmArtifact, loaded, provider). Wraps `NativeModuleLoader` — intercepts `require()`, dispatches by fidelity class per Flow 2 logic. Maintains internal Wasmer availability state and emits `wasmer:unavailable`; the final public `wasmer:ready` event is emitted later when actual WASIX modules are loaded and hot-swapped
- **Module registry population**: Populate the registry with all Node built-in modules classified into fidelity classes (`unenv`, `vendored-js`, `wasix`, `wasix-required`) per the Tech Plan. Base implementations point to existing unenv stubs. WASIX implementations are null (filled in by later tickets)
- **State machine**: Router tracks lifecycle state (`Base` → `Initializing` → `Enhanced` or back to `Base`) per Core Flows state machine
- **Entry point**: `AtuaNode.create(options)` that wires up Wasmer init + Module Router, returns a ready runtime at 96% base

### Out of Scope
- Actual WASIX module loading (no `.wasm` files yet)
- Build toolchain (wasi-sdk, C compilation) — covered by `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/8a35ff6a-9c66-4dd2-974c-055c673935ae`
- Bridge implementations — covered by `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/b6ce84ad-f2be-4b2d-a10a-12a971bef635`
- Hot-swap logic (atomic module upgrade) — covered by `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/6db5018d-0eef-4444-b097-ecbff9612404`

## Acceptance Criteria

1. `npm init` / package scaffolded with TypeScript, builds cleanly
2. `@wasmer/sdk` is a dependency, `init()` is called in background on `AtuaNode.create()`
3. COOP/COEP detection works: the success path is observable and leaves the initializer ready for later module loading; if headers are missing → `wasmer:unavailable` fires with a reason string
4. Module Router intercepts `require('crypto')` (and all Node builtins) and returns the correct base implementation based on fidelity class
5. `wasix-required` modules (`vm`, `child_process`, `worker_threads`, `cluster`) throw descriptive error when Wasmer is not ready
6. `retryWasmerInit()` re-attempts initialization and correctly updates internal readiness state or failure reason without requiring a page reload
7. All tests pass — unit tests for Router dispatch, Wasmer init success/failure paths, event emission
