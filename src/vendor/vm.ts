/**
 * Node.js vm module facade.
 *
 * Provides vm.createContext(), vm.runInNewContext(), vm.Script
 * by delegating to QuickJS via binding-vm / quickjs.wasm.
 *
 * Since binding-vm is still being wired to quickjs.wasm,
 * this provides a working implementation using Function()
 * constructor as an interim approach that supports the core API.
 */

export interface Context {
  [key: string]: unknown;
}

export interface RunOptions {
  timeout?: number;
  displayErrors?: boolean;
  filename?: string;
}

export interface ScriptOptions {
  filename?: string;
  lineOffset?: number;
  columnOffset?: number;
}

/**
 * Create a context object suitable for use with vm.runInContext.
 * In our implementation, the sandbox IS the context.
 */
export function createContext(sandbox?: Record<string, unknown>): Context {
  const ctx: Context = sandbox ?? Object.create(null);
  Object.defineProperty(ctx, '_isContext', { value: true, enumerable: false });
  return ctx;
}

/**
 * Check if an object was created by createContext.
 */
export function isContext(obj: unknown): boolean {
  return typeof obj === 'object' && obj !== null && (obj as any)._isContext === true;
}

/**
 * Run code in a new context with the given sandbox as globals.
 */
export function runInNewContext(code: string, sandbox?: Record<string, unknown>, options?: RunOptions | string): unknown {
  const ctx = createContext(sandbox);
  return runInContext(code, ctx, options);
}

/**
 * Run code in an existing context.
 */
export function runInContext(code: string, context: Context, options?: RunOptions | string): unknown {
  const opts = typeof options === 'string' ? { filename: options } : options;

  // Build a function that has the context properties as local variables
  const keys = Object.keys(context);
  const values = keys.map(k => context[k]);

  // Use Function constructor for code evaluation with context injection
  // The keys become parameter names, the code runs in the function body
  const fn = new Function(...keys, `"use strict"; return eval(${JSON.stringify(code)})`);

  if (opts?.timeout) {
    // Timeout support: use Promise.race with a timer
    // Note: Function constructor execution is synchronous, so true timeout
    // requires QuickJS interrupt handler. For now, we execute directly.
  }

  const result = fn.apply(undefined, values);

  // Write back any modifications to the context
  // (The Function constructor doesn't give us this automatically,
  // but changes to object properties within the code ARE reflected
  // since objects are passed by reference)

  return result;
}

/**
 * Run code in the current global context.
 */
export function runInThisContext(code: string, options?: RunOptions | string): unknown {
  return (0, eval)(code);
}

/**
 * Compiled script that can be run multiple times in different contexts.
 */
export class Script {
  private _code: string;
  private _filename: string;

  constructor(code: string, options?: ScriptOptions | string) {
    this._code = code;
    this._filename = typeof options === 'string' ? options : (options?.filename ?? '<anonymous>');
  }

  runInContext(context: Context, options?: RunOptions): unknown {
    return runInContext(this._code, context, options);
  }

  runInNewContext(sandbox?: Record<string, unknown>, options?: RunOptions): unknown {
    return runInNewContext(this._code, sandbox, options);
  }

  runInThisContext(options?: RunOptions): unknown {
    return runInThisContext(this._code, options);
  }

  createCachedData(): Uint8Array {
    // QuickJS can compile to bytecode, but for now return empty
    return new Uint8Array(0);
  }
}

/**
 * Compile a function from code.
 */
export function compileFunction(
  code: string,
  params?: string[],
  options?: { filename?: string; parsingContext?: Context }
): Function {
  const paramList = params ?? [];
  return new Function(...paramList, code);
}

export default {
  createContext,
  isContext,
  runInNewContext,
  runInContext,
  runInThisContext,
  Script,
  compileFunction,
};
