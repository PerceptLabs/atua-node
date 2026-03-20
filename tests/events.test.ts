import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));
vi.mock('@wasmer/sdk', () => ({
  init: mockInit,
}));

import { WasmerInitializer } from '../src/wasmer/WasmerInitializer.js';
import { ModuleRouter } from '../src/router/ModuleRouter.js';
import { AtuaNode } from '../src/index.js';

describe('Events', () => {
  beforeEach(() => {
    mockInit.mockReset();
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {});
  });

  it('should fire wasmer:unavailable when init fails', async () => {
    vi.stubGlobal('crossOriginIsolated', false);

    const initializer = new WasmerInitializer();
    const router = new ModuleRouter(initializer);

    const listener = vi.fn();
    router.onWasmerUnavailable(listener);

    await initializer.init();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'no-coop-coep' })
    );
  });

  it('should remove listener via off()', async () => {
    vi.stubGlobal('crossOriginIsolated', false);

    const initializer = new WasmerInitializer();
    const router = new ModuleRouter(initializer);

    const listener = vi.fn();
    router.onWasmerUnavailable(listener);
    router.off('wasmer:unavailable', listener);

    await initializer.init();

    expect(listener).not.toHaveBeenCalled();
  });

  it('should transition to initializing state on AtuaNode.create()', () => {
    mockInit.mockReturnValue(new Promise(() => {})); // never resolves
    const router = AtuaNode.create();

    expect(router.state).toBe('initializing');
  });

  it('should return to base state on failure', async () => {
    vi.stubGlobal('crossOriginIsolated', false);

    const initializer = new WasmerInitializer();
    const router = new ModuleRouter(initializer);
    router._markInitializing();

    expect(router.state).toBe('initializing');

    await initializer.init();

    expect(router.state).toBe('base');
  });

  it('should fire wasmer:ready on successful init', async () => {
    mockInit.mockResolvedValue(undefined);

    const initializer = new WasmerInitializer();
    const router = new ModuleRouter(initializer);

    const listener = vi.fn();
    router.onWasmerReady(listener);

    await initializer.init();

    expect(listener).toHaveBeenCalledOnce();
    expect(router.state).toBe('enhanced');
  });
});
