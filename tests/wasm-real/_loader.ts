/**
 * Shared WASM loading utility for real integration tests.
 *
 * Provides helpers to load .wasm files via Node.js's built-in WASI module.
 * - loadCommand(): for WASM modules with main() / _start() (e.g., hello.wasm)
 * - loadReactor(): for WASM library modules without main() (e.g., zlib.wasm)
 */
import { WASI } from 'node:wasi';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const WASM_DIR = join(import.meta.dirname, '..', '..', 'wasm');

/** Check if a .wasm file exists */
export function hasWasm(name: string): boolean {
  const filename = name.endsWith('.wasm') ? name : `${name}.wasm`;
  return existsSync(join(WASM_DIR, filename));
}

/** Get absolute path to a .wasm file */
export function wasmPath(name: string): string {
  const filename = name.endsWith('.wasm') ? name : `${name}.wasm`;
  return join(WASM_DIR, filename);
}

/**
 * Load a WASI command module (has _start / main()).
 * Runs the program and returns stdout/stderr.
 */
export async function loadCommand(
  name: string,
  options?: { args?: string[]; env?: Record<string, string>; preopens?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; instance: WebAssembly.Instance }> {
  const wasi = new WASI({
    version: 'preview1',
    args: options?.args ?? [],
    env: options?.env ?? {},
    preopens: options?.preopens ?? {},
    stdout: 1 as any,
    stderr: 2 as any,
  });

  const wasmBytes = await readFile(wasmPath(name));
  const module = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(module, wasi.getImportObject());

  wasi.start(instance);

  return { stdout: '', stderr: '', instance };
}

/**
 * Load a WASI reactor module (no _start, exports functions).
 * Initializes the module and returns the exports.
 */
export async function loadReactor(
  name: string,
  options?: { env?: Record<string, string>; preopens?: Record<string, string> }
): Promise<WebAssembly.Exports> {
  const wasi = new WASI({
    version: 'preview1',
    args: [],
    env: options?.env ?? {},
    preopens: options?.preopens ?? {},
  });

  const wasmBytes = await readFile(wasmPath(name));
  const module = await WebAssembly.compile(wasmBytes);

  // Build import object from WASI + any extra modules the WASM needs
  const imports = WebAssembly.Module.imports(module);
  const importObject: Record<string, Record<string, unknown>> = wasi.getImportObject() as any;

  // Provide env.memory (shared memory for pthread-enabled modules like libuv)
  const needsEnvMemory = imports.some(
    (i) => i.module === 'env' && i.name === 'memory' && i.kind === 'memory'
  );
  if (needsEnvMemory) {
    // Match the module's declared maximum memory (check imports for the declared max)
    const memImport = imports.find(i => i.module === 'env' && i.name === 'memory');
    const memory = new WebAssembly.Memory({ initial: 3, maximum: 3, shared: true });
    importObject.env = { ...importObject.env, memory };
  }

  // Provide stubs for any non-WASI import modules (wasix_32v1, wasi, etc.)
  // These are called by wasix-libc internals for threading/sockets/etc.
  // We provide no-op stubs since Node.js WASI only supports wasi_snapshot_preview1.
  const noop = () => 0;
  for (const imp of imports) {
    if (imp.module === 'wasi_snapshot_preview1') continue; // handled by node:wasi
    if (imp.module === 'env') continue; // handled above
    if (!importObject[imp.module]) {
      importObject[imp.module] = {};
    }
    if (imp.kind === 'function' && !(imp.name in (importObject[imp.module] as any))) {
      (importObject[imp.module] as any)[imp.name] = noop;
    }
  }

  const instance = await WebAssembly.instantiate(module, importObject);

  // Reactor modules use _initialize() instead of _start()
  wasi.initialize(instance);

  return instance.exports;
}
