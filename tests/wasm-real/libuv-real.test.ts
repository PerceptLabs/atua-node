// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const wasmExists = hasWasm('libuv');

describe.skipIf(!wasmExists)('libuv.wasm — real WASI execution', () => {
  it('should export core libuv functions', async () => {
    const exports = await loadReactor('libuv');

    // Event loop
    expect(exports.uv_loop_init).toBeDefined();
    expect(exports.uv_run).toBeDefined();
    expect(exports.uv_loop_close).toBeDefined();

    // Timers
    expect(exports.uv_timer_init).toBeDefined();
    expect(exports.uv_timer_start).toBeDefined();
    expect(exports.uv_timer_stop).toBeDefined();

    // Time
    expect(exports.uv_hrtime).toBeDefined();

    // Filesystem
    expect(exports.uv_fs_open).toBeDefined();
    expect(exports.uv_fs_read).toBeDefined();
    expect(exports.uv_fs_write).toBeDefined();
    expect(exports.uv_fs_close).toBeDefined();

    // Networking (stubs — handled by net-bridge)
    expect(exports.uv_tcp_init).toBeDefined();
    expect(exports.uv_udp_init).toBeDefined();

    // Process (stubs — handled by proc-bridge)
    expect(exports.uv_spawn).toBeDefined();

    // OS query functions (real values)
    expect(exports.uv_exepath).toBeDefined();
    expect(exports.uv_cpu_info).toBeDefined();
    expect(exports.uv_get_free_memory).toBeDefined();
    expect(exports.uv_get_total_memory).toBeDefined();

    // Memory management
    expect(exports.malloc).toBeDefined();
    expect(exports.free).toBeDefined();
    expect(exports.memory).toBeDefined();
  });

  it('should return real values from uv_get_total_memory', async () => {
    const exports = await loadReactor('libuv');
    const uv_get_total_memory = exports.uv_get_total_memory as () => bigint;

    const totalMem = uv_get_total_memory();
    // Should return 4GB (4294967296) as configured in wasi.c
    expect(totalMem).toBe(BigInt(4) * BigInt(1024) * BigInt(1024) * BigInt(1024));
  });

  it('should return real values from uv_get_free_memory', async () => {
    const exports = await loadReactor('libuv');
    const uv_get_free_memory = exports.uv_get_free_memory as () => bigint;

    const freeMem = uv_get_free_memory();
    // Should return 2GB as configured in wasi.c
    expect(freeMem).toBe(BigInt(2) * BigInt(1024) * BigInt(1024) * BigInt(1024));
  });

  it('should have correct wasm file size (200KB-2MB)', async () => {
    const wasmBytes = await readFile(join(import.meta.dirname, '..', '..', 'wasm', 'libuv.wasm'));

    expect(wasmBytes.length).toBeGreaterThan(200_000);
    expect(wasmBytes.length).toBeLessThan(2_000_000);

    // Verify WASM magic number
    expect(wasmBytes[0]).toBe(0x00);
    expect(wasmBytes[1]).toBe(0x61);
    expect(wasmBytes[2]).toBe(0x73);
    expect(wasmBytes[3]).toBe(0x6d);
  });
});
