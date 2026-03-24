import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));
vi.mock('@wasmer/sdk', () => ({
  init: mockInit,
}));

import { WasmerInitializer } from '../src/wasmer/WasmerInitializer.js';
import { ModuleRouter } from '../src/router/ModuleRouter.js';
import { populateRegistry } from '../src/router/registry.js';

describe('ModuleRouter', () => {
  let initializer: WasmerInitializer;
  let router: ModuleRouter;

  beforeEach(() => {
    mockInit.mockReset();
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {});
    initializer = new WasmerInitializer();
    router = new ModuleRouter(initializer);
    populateRegistry(router);
  });

  it('should resolve unenv modules to vendor implementation', () => {
    const result = router.resolve('path') as Record<string, unknown>;
    expect(typeof result.join).toBe('function');
    expect(typeof result.resolve).toBe('function');
    expect(typeof result.dirname).toBe('function');
  });

  it('should resolve vendored-js modules to vendor implementation', () => {
    const result = router.resolve('stream') as Record<string, unknown>;
    expect(typeof result.Readable).toBe('function');
    expect(typeof result.Writable).toBe('function');
  });

  it('should resolve wasix modules to baseImpl when wasmer is not ready', () => {
    const result = router.resolve('crypto') as Record<string, unknown>;
    expect(typeof result.createHash).toBe('function');
    expect(typeof result.randomBytes).toBe('function');
  });

  it('should resolve wasix modules to wasixImpl when wasmer is ready and loaded', async () => {
    mockInit.mockResolvedValue(undefined);
    await initializer.init();

    // Manually set the wasixImpl and loaded flag on the registry entry
    router.register({
      name: 'crypto',
      fidelityClass: 'wasix',
      baseImpl: () => ({ base: true }),
      wasixImpl: () => ({ wasix: true, moduleName: 'crypto' }),
      wasmArtifact: 'crypto.wasm',
      loaded: true,
      provider: 'atua',
    });

    const result = router.resolve('crypto') as { wasix: boolean; moduleName: string };
    expect(result.wasix).toBe(true);
    expect(result.moduleName).toBe('crypto');
  });

  it('should resolve wasix-required modules to vendor baseImpl when wasmer is not ready', () => {
    const result = router.resolve('vm') as Record<string, unknown>;
    expect(typeof result.runInNewContext).toBe('function');
    expect(typeof result.createContext).toBe('function');
  });

  it('should resolve wasix-required modules when wasmer is ready and loaded', async () => {
    mockInit.mockResolvedValue(undefined);
    await initializer.init();

    router.register({
      name: 'vm',
      fidelityClass: 'wasix-required',
      baseImpl: () => ({ base: true }),
      wasixImpl: () => ({ wasix: true, moduleName: 'vm' }),
      wasmArtifact: 'quickjs.wasm',
      loaded: true,
      provider: 'atua',
    });

    const result = router.resolve('vm') as { wasix: boolean; moduleName: string };
    expect(result.wasix).toBe(true);
    expect(result.moduleName).toBe('vm');
  });

  it('should throw for unknown modules', () => {
    expect(() => router.resolve('nonexistent')).toThrow("Unknown module: 'nonexistent'");
  });
});
