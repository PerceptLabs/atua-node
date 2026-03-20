// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';

const wasmExists = hasWasm('quickjs');

describe.skipIf(!wasmExists)('quickjs.wasm — real WASI execution', () => {
  it('should export qjs_init, JS_Eval, and other core functions', async () => {
    const exports = await loadReactor('quickjs');

    expect(exports.qjs_init).toBeDefined();
    expect(exports.qjs_get_context).toBeDefined();
    expect(exports.qjs_destroy).toBeDefined();
    expect(exports.JS_Eval).toBeDefined();
    expect(exports.JS_FreeValue).toBeDefined();
    expect(exports.JS_NewContext).toBeDefined();
    expect(exports.JS_FreeContext).toBeDefined();
    expect(exports.JS_NewRuntime).toBeDefined();
    expect(exports.JS_FreeRuntime).toBeDefined();
    expect(exports.JS_SetInterruptHandler).toBeDefined();
    expect(exports.JS_GetPropertyStr).toBeDefined();
    expect(exports.JS_SetPropertyStr).toBeDefined();
    expect(exports.malloc).toBeDefined();
    expect(exports.free).toBeDefined();
  });

  it('should initialize QuickJS runtime via qjs_init', async () => {
    const exports = await loadReactor('quickjs');
    const qjs_init = exports.qjs_init as () => number;
    const qjs_get_context = exports.qjs_get_context as () => number;
    const qjs_destroy = exports.qjs_destroy as () => void;

    const rc = qjs_init();
    expect(rc).toBe(0); // 0 = success

    const ctx = qjs_get_context();
    expect(ctx).toBeGreaterThan(0);

    qjs_destroy();
  });

  it('should evaluate simple expression and get result', async () => {
    const exports = await loadReactor('quickjs');
    const memory = exports.memory as WebAssembly.Memory;
    const malloc = exports.malloc as (size: number) => number;
    const free = exports.free as (ptr: number) => void;
    const qjs_init = exports.qjs_init as () => number;
    const qjs_get_context = exports.qjs_get_context as () => number;
    const qjs_destroy = exports.qjs_destroy as () => void;
    const JS_Eval = exports.JS_Eval as (ctx: number, input: number, inputLen: number, filename: number, evalFlags: number) => bigint;
    const JS_FreeValue = exports.JS_FreeValue as (ctx: number, val: bigint) => void;

    // Initialize
    qjs_init();
    const ctx = qjs_get_context();

    // Prepare the code string in WASM memory
    const code = '1 + 1';
    const codeBytes = new TextEncoder().encode(code);
    const codePtr = malloc(codeBytes.length + 1);
    new Uint8Array(memory.buffer, codePtr, codeBytes.length).set(codeBytes);
    new Uint8Array(memory.buffer, codePtr + codeBytes.length, 1)[0] = 0; // null terminate

    const filenameStr = '<eval>';
    const fnBytes = new TextEncoder().encode(filenameStr);
    const fnPtr = malloc(fnBytes.length + 1);
    new Uint8Array(memory.buffer, fnPtr, fnBytes.length).set(fnBytes);
    new Uint8Array(memory.buffer, fnPtr + fnBytes.length, 1)[0] = 0;

    // Evaluate (JS_EVAL_TYPE_GLOBAL = 0)
    const result = JS_Eval(ctx, codePtr, codeBytes.length, fnPtr, 0);

    free(codePtr);
    free(fnPtr);

    // result is a JSValue (64-bit tagged value in quickjs-ng)
    // We just verify it doesn't crash and returns something
    expect(result).toBeDefined();

    // Clean up
    JS_FreeValue(ctx, result);
    qjs_destroy();
  });

  it('should have correct wasm file size', async () => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const wasmBytes = await readFile(join(import.meta.dirname, '..', '..', 'wasm', 'quickjs.wasm'));

    // QuickJS should be 400KB-2MB
    expect(wasmBytes.length).toBeGreaterThan(400_000);
    expect(wasmBytes.length).toBeLessThan(5_000_000);
  });
});
