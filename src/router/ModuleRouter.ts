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
      this._hotSwapModules();
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
        // Fall back to vendor baseImpl — module loads with full API surface,
        // individual functions throw if they need WASIX (Deno pattern).
        return entry.baseImpl();
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

  /**
   * Hot-swap: atomically upgrade wasix-class modules from baseImpl to wasixImpl.
   * Per-module fallback: if a specific module fails, it stays on baseImpl.
   */
  private _hotSwapModules(): void {
    for (const [name, entry] of this._registry) {
      if (entry.fidelityClass !== 'wasix' && entry.fidelityClass !== 'wasix-required') continue;
      if (!entry.wasixImpl || !entry.loaded) continue;

      try {
        // Verify the wasixImpl is callable
        entry.wasixImpl();
        this._emit('module:upgraded', { name, provider: entry.provider });
      } catch (err) {
        // Per-module fallback: this module stays on baseImpl
        entry.loaded = false;
        entry.wasixImpl = null;
        this._emit('module:upgrade-failed', { name, error: err });
      }
    }
  }

  /** Get a registry entry (for testing/inspection) */
  getEntry(name: string): ModuleRegistryEntry | undefined {
    return this._registry.get(name);
  }

  private _emit(event: string, ...args: unknown[]): void {
    const listeners = this._eventListeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) listener(...args);
  }
}
