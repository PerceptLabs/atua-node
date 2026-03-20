import { init as wasmerInit } from '@wasmer/sdk';
import type { InitializerState, WasmerUnavailableReason } from '../types/index.js';

export class WasmerInitializer {
  private _state: InitializerState = 'idle';
  private _failureReason: WasmerUnavailableReason | null = null;
  private _readyCallbacks: Array<() => void> = [];
  private _failureCallbacks: Array<(reason: WasmerUnavailableReason) => void> = [];

  get isReady(): boolean {
    return this._state === 'ready';
  }

  get state(): InitializerState {
    return this._state;
  }

  get failureReason(): WasmerUnavailableReason | null {
    return this._failureReason;
  }

  async init(): Promise<void> {
    if (this._state !== 'idle') return;

    this._state = 'initializing';

    if (typeof globalThis.crossOriginIsolated !== 'undefined' && !globalThis.crossOriginIsolated) {
      this._fail({
        code: 'no-coop-coep',
        message:
          'Cross-origin isolation is not enabled. Set Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp headers.',
      });
      return;
    }

    if (typeof SharedArrayBuffer === 'undefined') {
      this._fail({
        code: 'no-shared-array-buffer',
        message: 'SharedArrayBuffer is not available. Cross-origin isolation headers may be missing.',
      });
      return;
    }

    try {
      await wasmerInit();
      this._state = 'ready';
      for (const cb of this._readyCallbacks) cb();
    } catch (err) {
      this._fail({
        code: 'init-error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async retryInit(): Promise<void> {
    this._state = 'idle';
    this._failureReason = null;
    await this.init();
  }

  onReady(cb: () => void): void {
    this._readyCallbacks.push(cb);
    if (this._state === 'ready') cb();
  }

  onFailure(cb: (reason: WasmerUnavailableReason) => void): void {
    this._failureCallbacks.push(cb);
    if (this._state === 'failed' && this._failureReason) cb(this._failureReason);
  }

  private _fail(reason: WasmerUnavailableReason): void {
    this._state = 'failed';
    this._failureReason = reason;
    for (const cb of this._failureCallbacks) cb(reason);
  }
}
