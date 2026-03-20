import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInit } = vi.hoisted(() => ({ mockInit: vi.fn() }));
vi.mock('@wasmer/sdk', () => ({ init: mockInit }));

import { WasmerInitializer } from '../../src/wasmer/WasmerInitializer.js';
import { ModuleRouter } from '../../src/router/ModuleRouter.js';
import { populateRegistry } from '../../src/router/registry.js';

describe('Module Router hot-swap', () => {
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

  it('should resolve base impl before Wasmer is ready', () => {
    const result = router.resolve('path') as any;
    expect(result).toBeDefined();
  });

  it('should fire module:upgraded event on hot-swap', async () => {
    mockInit.mockResolvedValue(undefined);

    // Set up a wasixImpl for crypto
    const entry = router.getEntry('crypto');
    if (entry) {
      entry.wasixImpl = () => ({ wasix: true, moduleName: 'crypto' });
      entry.loaded = true;
    }

    const upgradedModules: string[] = [];
    router.onWasmerReady(() => {});
    (router as any)._addListener('module:upgraded', (info: any) => {
      upgradedModules.push(info.name);
    });

    await initializer.init();

    expect(upgradedModules).toContain('crypto');
  });

  it('should handle per-module fallback if wasixImpl fails', async () => {
    mockInit.mockResolvedValue(undefined);

    // Set up a failing wasixImpl
    const entry = router.getEntry('zlib');
    if (entry) {
      entry.wasixImpl = () => { throw new Error('WASM load failed'); };
      entry.loaded = true;
    }

    const failures: string[] = [];
    (router as any)._addListener('module:upgrade-failed', (info: any) => {
      failures.push(info.name);
    });

    await initializer.init();

    expect(failures).toContain('zlib');
    // zlib should fall back to baseImpl
    const zlibEntry = router.getEntry('zlib');
    expect(zlibEntry?.loaded).toBe(false);
    expect(zlibEntry?.wasixImpl).toBeNull();
  });

  it('should keep unenv modules unchanged after hot-swap', async () => {
    mockInit.mockResolvedValue(undefined);
    await initializer.init();

    // path is 'unenv' class — should always return baseImpl
    const result = router.resolve('path') as any;
    expect(result).toBeDefined();
  });
});
