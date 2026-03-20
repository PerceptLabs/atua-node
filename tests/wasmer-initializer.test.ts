import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));
vi.mock('@wasmer/sdk', () => ({
  init: mockInit,
}));

import { WasmerInitializer } from '../src/wasmer/WasmerInitializer.js';

describe('WasmerInitializer', () => {
  beforeEach(() => {
    mockInit.mockReset();
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {});
  });

  it('should reach ready state on successful init', async () => {
    mockInit.mockResolvedValue(undefined);
    const init = new WasmerInitializer();

    const readyCb = vi.fn();
    init.onReady(readyCb);

    await init.init();

    expect(init.state).toBe('ready');
    expect(init.isReady).toBe(true);
    expect(init.failureReason).toBeNull();
    expect(readyCb).toHaveBeenCalledOnce();
  });

  it('should fail when crossOriginIsolated is false', async () => {
    vi.stubGlobal('crossOriginIsolated', false);
    const init = new WasmerInitializer();

    const failCb = vi.fn();
    init.onFailure(failCb);

    await init.init();

    expect(init.state).toBe('failed');
    expect(init.failureReason?.code).toBe('no-coop-coep');
    expect(failCb).toHaveBeenCalledOnce();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('should fail when SharedArrayBuffer is unavailable', async () => {
    // @ts-expect-error - deliberately removing SAB for test
    delete globalThis.SharedArrayBuffer;
    const init = new WasmerInitializer();

    const failCb = vi.fn();
    init.onFailure(failCb);

    await init.init();

    expect(init.state).toBe('failed');
    expect(init.failureReason?.code).toBe('no-shared-array-buffer');
    expect(failCb).toHaveBeenCalledOnce();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('should fail when @wasmer/sdk init() throws', async () => {
    mockInit.mockRejectedValue(new Error('WASM load failed'));
    const init = new WasmerInitializer();

    const failCb = vi.fn();
    init.onFailure(failCb);

    await init.init();

    expect(init.state).toBe('failed');
    expect(init.failureReason?.code).toBe('init-error');
    expect(init.failureReason?.message).toBe('WASM load failed');
    expect(failCb).toHaveBeenCalledOnce();
  });

  it('should recover via retryInit after failure', async () => {
    mockInit.mockRejectedValueOnce(new Error('first fail'));
    const init = new WasmerInitializer();

    await init.init();
    expect(init.state).toBe('failed');

    mockInit.mockResolvedValueOnce(undefined);
    await init.retryInit();
    expect(init.state).toBe('ready');
    expect(init.isReady).toBe(true);
  });

  it('should guard against double init', async () => {
    mockInit.mockResolvedValue(undefined);
    const init = new WasmerInitializer();

    // Fire two inits concurrently
    const p1 = init.init();
    const p2 = init.init();

    await Promise.all([p1, p2]);

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(init.state).toBe('ready');
  });

  it('should call onReady immediately if already ready', async () => {
    mockInit.mockResolvedValue(undefined);
    const init = new WasmerInitializer();
    await init.init();

    const lateCb = vi.fn();
    init.onReady(lateCb);

    expect(lateCb).toHaveBeenCalledOnce();
  });

  it('should call onFailure immediately if already failed', async () => {
    vi.stubGlobal('crossOriginIsolated', false);
    const init = new WasmerInitializer();
    await init.init();

    const lateCb = vi.fn();
    init.onFailure(lateCb);

    expect(lateCb).toHaveBeenCalledOnce();
    expect(lateCb).toHaveBeenCalledWith(init.failureReason);
  });
});
