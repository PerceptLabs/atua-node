import type { ModuleRegistryEntry, RouterState, WasmerUnavailableReason } from '../types/index.js';
import type { WasmerInitializer } from '../wasmer/WasmerInitializer.js';

type EventListener = (...args: unknown[]) => void;

export class ModuleRouter {
  private _registry = new Map<string, ModuleRegistryEntry>();
  private _state: RouterState = 'base';
  private _initializer: WasmerInitializer;
  private _eventListeners = new Map<string, EventListener[]>();

  constructor(initializer: WasmerInitializer) {
    this._initializer = initializer;

    initializer.onReady(() => {
      this._state = 'enhanced';
      this._emit('wasmer:ready');
    });

    initializer.onFailure((reason) => {
      this._state = 'base';
      this._emit('wasmer:unavailable', reason);
    });
  }

  /** Called by AtuaNode.create() to mark the router as initializing */
  _markInitializing(): void {
    this._state = 'initializing';
  }

  register(entry: ModuleRegistryEntry): void {
    this._registry.set(entry.name, entry);
  }

  resolve(moduleName: string): unknown {
    const entry = this._registry.get(moduleName);
    if (!entry) {
      throw new Error(`Unknown module: '${moduleName}'`);
    }

    switch (entry.fidelityClass) {
      case 'unenv':
      case 'vendored-js':
        return entry.baseImpl();

      case 'wasix':
        if (this._initializer.isReady && entry.loaded && entry.wasixImpl) {
          return entry.wasixImpl();
        }
        return entry.baseImpl();

      case 'wasix-required':
        if (this._initializer.isReady && entry.loaded && entry.wasixImpl) {
          return entry.wasixImpl();
        }
        throw new Error(
          `Module '${moduleName}' requires WASIX. Ensure COOP/COEP headers (Cross-Origin-Opener-Policy: same-origin, Cross-Origin-Embedder-Policy: require-corp) are set on your server.`
        );
    }
  }

  get state(): RouterState {
    return this._state;
  }

  onWasmerReady(listener: () => void): void {
    this._addListener('wasmer:ready', listener);
  }

  onWasmerUnavailable(listener: (reason: WasmerUnavailableReason) => void): void {
    this._addListener('wasmer:unavailable', listener as EventListener);
  }

  off(event: string, listener: Function): void {
    const listeners = this._eventListeners.get(event);
    if (!listeners) return;
    const idx = listeners.indexOf(listener as EventListener);
    if (idx !== -1) listeners.splice(idx, 1);
  }

  private _addListener(event: string, listener: EventListener): void {
    const existing = this._eventListeners.get(event);
    if (existing) {
      existing.push(listener);
    } else {
      this._eventListeners.set(event, [listener]);
    }
  }

  private _emit(event: string, ...args: unknown[]): void {
    const listeners = this._eventListeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) listener(...args);
  }
}
