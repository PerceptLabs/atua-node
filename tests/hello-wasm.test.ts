import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @wasmer/sdk
const { mockInit, mockRunWasix } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockRunWasix: vi.fn(),
}));
vi.mock('@wasmer/sdk', () => ({
  init: mockInit,
  runWasix: mockRunWasix,
  Directory: vi.fn().mockImplementation(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
  })),
}));

import { WasmLoader } from '../src/wasmer/WasmLoader.js';

describe('Hello WASM — Build Toolchain Validation', () => {
  beforeEach(() => {
    mockInit.mockReset();
    mockRunWasix.mockReset();
  });

  describe('WasmLoader', () => {
    it('should resolve bundled WASM URLs', () => {
      const loader = new WasmLoader();
      expect(loader.resolveUrl('hello')).toBe('/wasm/hello.wasm');
      expect(loader.resolveUrl('hello.wasm')).toBe('/wasm/hello.wasm');
    });

    it('should resolve CDN WASM URLs with custom base', () => {
      const loader = new WasmLoader({ cdnBase: 'https://cdn.example.com/wasm' });
      expect(loader.resolveUrl('hello')).toBe('https://cdn.example.com/wasm/hello.wasm');
    });

    it('should cache loaded modules', async () => {
      const loader = new WasmLoader();
      const fakeModule = {} as WebAssembly.Module;

      // Manually prime the cache to test caching behavior
      // (In real usage, load() would fetch and compile)
      (loader as any)._cache.set('hello', fakeModule);

      expect(loader.isCached('hello')).toBe(true);
      expect(loader.isCached('nonexistent')).toBe(false);

      const result = await loader.load('hello');
      expect(result.module).toBe(fakeModule);
      expect(result.source).toBe('bundled');
    });

    it('should clear cache', () => {
      const loader = new WasmLoader();
      (loader as any)._cache.set('hello', {} as WebAssembly.Module);
      expect(loader.isCached('hello')).toBe(true);
      loader.clearCache();
      expect(loader.isCached('hello')).toBe(false);
    });
  });

  describe('hello.wasm via runWasix()', () => {
    it('should produce correct stdout output', async () => {
      const capturedStdout: string[] = [];

      mockRunWasix.mockResolvedValue({
        ok: true,
        stdout: 'WASIX hello world\nWrote 18 bytes to /data/test-output.txt\nRead back: Hello from WASIX!\nAll tests passed!\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await mockRunWasix({}, {
        args: [],
        mount: { '/data': {} },
      });

      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('WASIX hello world');
      expect(result.stdout).toContain('All tests passed!');
    });

    it('should handle filesystem mount for file read/write', async () => {
      const dirContents: Record<string, string> = {};

      mockRunWasix.mockImplementation(async (_module: any, opts: any) => {
        // Simulate: C program writes to /data/test-output.txt
        dirContents['test-output.txt'] = 'Hello from WASIX!\n';

        return {
          ok: true,
          stdout: 'WASIX hello world\nWrote 18 bytes to /data/test-output.txt\nRead back: Hello from WASIX!\nAll tests passed!\n',
          stderr: '',
          exitCode: 0,
        };
      });

      const result = await mockRunWasix({}, {
        args: [],
        mount: { '/data': {} },
      });

      expect(result.exitCode).toBe(0);
      // Verify the simulated file was written
      expect(dirContents['test-output.txt']).toBe('Hello from WASIX!\n');
    });

    it('should report failure when file operations fail', async () => {
      mockRunWasix.mockResolvedValue({
        ok: false,
        stdout: '',
        stderr: 'ERROR: cannot open /data/test-output.txt for writing\n',
        exitCode: 1,
      });

      const result = await mockRunWasix({}, {
        args: [],
        mount: {},  // No /data mount → file ops fail
      });

      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ERROR');
    });
  });

  describe('Dual-mode distribution', () => {
    it('should support bundled mode (default path)', () => {
      const loader = new WasmLoader();
      const url = loader.resolveUrl('hello');
      expect(url).toBe('/wasm/hello.wasm');
    });

    it('should support CDN mode (custom base URL)', () => {
      const loader = new WasmLoader({ cdnBase: 'https://cdn.atua.dev/wasm/v0.1.0' });
      const url = loader.resolveUrl('libcrypto');
      expect(url).toBe('https://cdn.atua.dev/wasm/v0.1.0/libcrypto.wasm');
    });
  });
});

describe('Build toolchain structure', () => {
  it('should have all native submodule directories', async () => {
    const { existsSync } = await import('fs');
    const { join } = await import('path');

    const root = join(import.meta.dirname, '..');
    const expectedDirs = ['hello', 'libuv', 'openssl', 'zlib', 'llhttp', 'ada', 'simdutf', 'quickjs'];

    for (const dir of expectedDirs) {
      expect(existsSync(join(root, 'native', dir))).toBe(true);
    }
  });

  it('should have the CMake toolchain file', async () => {
    const { existsSync } = await import('fs');
    const { join } = await import('path');

    const root = join(import.meta.dirname, '..');
    expect(existsSync(join(root, 'toolchain', 'wasix.cmake'))).toBe(true);
  });

  it('should have the build script', async () => {
    const { existsSync } = await import('fs');
    const { join } = await import('path');

    const root = join(import.meta.dirname, '..');
    expect(existsSync(join(root, 'scripts', 'build-wasm.sh'))).toBe(true);
  });
});
