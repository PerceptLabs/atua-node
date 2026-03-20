/**
 * Addon Registry.
 *
 * Maps native addon names to WASIX module packages.
 * Supports consumer registration and lazy WASM loading.
 */

export interface AddonEntry {
  name: string;
  package?: string;
  wasmPath?: string;
  loaded: boolean;
  exports: unknown;
}

export class AddonRegistry {
  private _addons = new Map<string, AddonEntry>();

  register(name: string, config: { package?: string; wasmPath?: string }): void {
    this._addons.set(name, {
      name,
      package: config.package,
      wasmPath: config.wasmPath,
      loaded: false,
      exports: null,
    });
  }

  has(name: string): boolean {
    return this._addons.has(name);
  }

  async load(name: string): Promise<unknown> {
    const entry = this._addons.get(name);
    if (!entry) {
      throw new Error(`Addon '${name}' is not registered. Call addonRegistry.register() first.`);
    }

    if (entry.loaded) {
      return entry.exports;
    }

    if (!entry.wasmPath) {
      throw new Error(`Addon '${name}' has no wasmPath configured.`);
    }

    // Load WASM module
    const response = await fetch(entry.wasmPath);
    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, {});

    entry.exports = instance.exports;
    entry.loaded = true;
    return entry.exports;
  }

  get(name: string): AddonEntry | undefined {
    return this._addons.get(name);
  }

  list(): string[] {
    return Array.from(this._addons.keys());
  }
}

export const addonRegistry = new AddonRegistry();
