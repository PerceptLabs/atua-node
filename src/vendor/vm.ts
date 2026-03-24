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
export const __atua = true;

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
  options?: { filename?: string; lineOffset?: number; columnOffset?: number; parsingContext?: Context }
): Function {
  const paramList = params ?? [];
  return new Function(...paramList, code);
}

/**
 * Abstract base class for ES modules (Node 24 API).
 */
export abstract class Module {
  status: string = 'unlinked';
  identifier: string;
  namespace: any = null;
  error: any = undefined;

  constructor(identifier?: string) {
    this.identifier = identifier ?? '';
  }
}

/**
 * SourceTextModule — requires V8 module API which is not available in browser.
 */
export class SourceTextModule extends Module {
  private _source: string;

  constructor(source: string, options?: { identifier?: string; context?: Context }) {
    super(options?.identifier ?? 'SourceTextModule');
    this._source = source;
  }

  async link(_linker: (specifier: string, referencingModule: Module) => Promise<Module> | Module): Promise<void> {
    throw new Error('ERR_NOT_SUPPORTED: SourceTextModule requires V8 module API — use runInNewContext for script execution');
  }

  async evaluate(): Promise<{ result: any }> {
    throw new Error('ERR_NOT_SUPPORTED: SourceTextModule requires V8 module API — use runInNewContext for script execution');
  }
}

/**
 * SyntheticModule — requires V8 module API which is not available in browser.
 */
export class SyntheticModule extends Module {
  private _exportNames: string[];
  private _evaluateCallback: (this: SyntheticModule) => void;

  constructor(
    exportNames: string[],
    evaluateCallback: (this: SyntheticModule) => void,
    options?: { identifier?: string; context?: Context }
  ) {
    super(options?.identifier ?? 'SyntheticModule');
    this._exportNames = exportNames;
    this._evaluateCallback = evaluateCallback;
  }

  async link(_linker: (specifier: string, referencingModule: Module) => Promise<Module> | Module): Promise<void> {
    throw new Error('ERR_NOT_SUPPORTED: SyntheticModule requires V8 module API — use runInNewContext for script execution');
  }

  async evaluate(): Promise<{ result: any }> {
    throw new Error('ERR_NOT_SUPPORTED: SyntheticModule requires V8 module API — use runInNewContext for script execution');
  }
}

/**
 * Measure memory usage (Node 24 API).
 */
export function measureMemory(_options?: { mode?: string; execution?: string }): Promise<{ total: { jsMemoryEstimate: number; jsMemoryRange: [number, number] } }> {
  const perf = typeof performance !== 'undefined' ? (performance as any) : undefined;
  if (perf && perf.memory) {
    const estimate = perf.memory.usedJSHeapSize ?? 0;
    const limit = perf.memory.jsHeapSizeLimit ?? 0;
    return Promise.resolve({
      total: {
        jsMemoryEstimate: estimate,
        jsMemoryRange: [estimate, limit] as [number, number],
      },
    });
  }
  return Promise.resolve({
    total: {
      jsMemoryEstimate: 0,
      jsMemoryRange: [0, 0] as [number, number],
    },
  });
}

export default {
  createContext,
  isContext,
  runInNewContext,
  runInContext,
  runInThisContext,
  Script,
  compileFunction,
  Module,
  SourceTextModule,
  SyntheticModule,
  measureMemory,
};
