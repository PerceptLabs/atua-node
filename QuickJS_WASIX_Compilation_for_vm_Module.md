# QuickJS WASIX Compilation for vm Module

## Overview

Compile QuickJS to WASIX to implement Node's `vm` module — `vm.createContext()`, `vm.runInNewContext()`, `vm.Script`, `vm.compileFunction()`. This is a `wasix-required` module (throws without WASIX). QuickJS provides isolated JavaScript execution contexts that the browser's V8 can't natively expose. This ticket can run **in parallel** with T3-T5 since it only depends on T2.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/e8d6adc2-f1f5-41ba-9b3b-f72a74dd337c` (Epic Brief — vm module gap), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §3.2 FFI Bridge Stubs: `binding-vm`)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/8a35ff6a-9c66-4dd2-974c-055c673935ae` (Build Toolchain)

## Scope

### In Scope
- Clone QuickJS from git submodule, compile to WASIX via wasi-sdk
- FFI bridge `binding-vm` (~50 LOC): `JS_NewRuntime`, `JS_NewContext`, `JS_Eval`, `JS_GetPropertyStr`, `JS_SetPropertyStr`, `JS_Call`, `JS_FreeValue`, `JS_FreeContext`, `JS_FreeRuntime`
- `vm.createContext(sandbox?)` → creates a new QuickJS context with optional sandbox object injected as globals
- `vm.runInNewContext(code, sandbox?, options?)` → creates context + evaluates code + returns result
- `vm.Script` class → compiles code once via `JS_Eval` with `JS_EVAL_FLAG_COMPILE_ONLY`, executes via `JS_EvalFunction`
- `vm.compileFunction(code, params, options?)` → compiles a function in QuickJS, returns callable
- Timeout support via QuickJS interrupt handler (`JS_SetInterruptHandler`) — maps to `options.timeout`
- Value marshaling: JS ↔ QuickJS for primitives (string, number, boolean, null, undefined), objects (recursive), arrays, Buffers

### Out of Scope
- `vm.Module` (ES modules in vm) — complex, defer to later
- `vm.measureMemory()` — V8-specific, not applicable
- Full Node `vm` API surface parity — focus on the commonly-used subset

## Acceptance Criteria

1. QuickJS compiles to `wasm/quickjs.wasm` via wasi-sdk
2. `vm.createContext({ x: 42 })` creates an isolated context with `x` accessible as a global
3. `vm.runInNewContext('x + 1', { x: 42 })` returns `43`
4. `vm.Script` compiles code once and can be executed multiple times in different contexts
5. Timeout works: `vm.runInNewContext('while(true){}', {}, { timeout: 100 })` throws after ~100ms
6. Context isolation: code in one context cannot access variables from another
7. Value marshaling works for primitives, objects, arrays, and Buffers
8. Memory cleanup: `vm.createContext()` contexts can be garbage collected without leaking WASM memory
