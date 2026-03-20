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
  const instance = await WebAssembly.instantiate(module, wasi.getImportObject());

  // Reactor modules use _initialize() instead of _start()
  wasi.initialize(instance);

  return instance.exports;
}
