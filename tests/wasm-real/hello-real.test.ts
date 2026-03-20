// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { WASI } from 'node:wasi';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasWasm, wasmPath } from './_loader.js';

const wasmExists = hasWasm('hello');

describe.skipIf(!wasmExists)('hello.wasm — real WASI execution', () => {
  const tmpDir = join(import.meta.dirname, '..', '..', 'tmp-test-hello');

  it('should run hello.wasm and exit successfully', async () => {
    // Create temp directory for file I/O
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    try {
      const wasi = new WASI({
        version: 'preview1',
        args: ['hello'],
        env: {},
        preopens: { '/data': tmpDir },
      });

      const wasmBytes = await readFile(wasmPath('hello'));
      const module = await WebAssembly.compile(wasmBytes);
      const instance = await WebAssembly.instantiate(module, wasi.getImportObject());

      // Run the program — if it doesn't throw, _start() completed with exit code 0
      wasi.start(instance);
    } finally {
      // Cleanup
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    }
  });

  it('should write and read a file via WASI filesystem', async () => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    try {
      const wasi = new WASI({
        version: 'preview1',
        args: ['hello'],
        env: {},
        preopens: { '/data': tmpDir },
      });

      const wasmBytes = await readFile(wasmPath('hello'));
      const module = await WebAssembly.compile(wasmBytes);
      const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
      wasi.start(instance);

      // Verify the C program wrote a file
      const outputFile = join(tmpDir, 'test-output.txt');
      expect(existsSync(outputFile)).toBe(true);

      const content = readFileSync(outputFile, 'utf-8');
      expect(content).toBe('Hello from WASIX!\n');
    } finally {
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    }
  });

  it('should have correct wasm file size', async () => {
    const wasmBytes = await readFile(wasmPath('hello'));
    // hello.wasm should be a reasonable size (not empty, not huge)
    expect(wasmBytes.length).toBeGreaterThan(1000);
    expect(wasmBytes.length).toBeLessThan(1_000_000); // < 1MB

    // Verify WASM magic number
    expect(wasmBytes[0]).toBe(0x00); // \0
    expect(wasmBytes[1]).toBe(0x61); // a
    expect(wasmBytes[2]).toBe(0x73); // s
    expect(wasmBytes[3]).toBe(0x6d); // m
  });
});
