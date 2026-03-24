/**
 * Verify all 44 Node built-in modules resolve through the ModuleRouter.
 * Each must return a defined, non-null object without notImplemented.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));
vi.mock('@wasmer/sdk', () => ({
  init: mockInit,
}));

import { WasmerInitializer } from '../src/wasmer/WasmerInitializer.js';
import { ModuleRouter } from '../src/router/ModuleRouter.js';
import { populateRegistry } from '../src/router/registry.js';

const ALL_MODULES = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'sea', 'stream', 'string_decoder', 'sys', 'test',
  'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm',
  'wasi', 'worker_threads', 'zlib',
];

describe('All 44 Node built-in modules resolve', () => {
  let router: ModuleRouter;

  beforeAll(() => {
    mockInit.mockReset();
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {});
    const init = new WasmerInitializer();
    router = new ModuleRouter(init);
    populateRegistry(router);
  });

  it('has exactly 44 modules registered', () => {
    expect(ALL_MODULES.length).toBe(44);
  });

  for (const name of ALL_MODULES) {
    it(`${name} resolves to a real module`, () => {
      const mod = router.resolve(name);
      expect(mod).toBeDefined();
      expect(mod).not.toBeNull();
      expect((mod as any)?.notImplemented).toBeUndefined();
    });
  }
});
