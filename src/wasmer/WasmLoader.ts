import type { AtuaNodeOptions } from '../types/index.js';

/** Default CDN base for lazy-fetch mode */
const DEFAULT_CDN_BASE = '/wasm';

export interface WasmLoadResult {
  module: WebAssembly.Module;
  source: 'bundled' | 'cdn';
}

/**
 * Dual-mode WASM artifact loader.
 *
 * - Bundled (default): loads .wasm files from the npm package's wasm/ directory
 * - CDN (opt-in): fetches .wasm files from a configurable CDN base URL
 *
 * Uses WebAssembly.compileStreaming(fetch(...)) for efficient streaming compilation.
 */
export class WasmLoader {
  private _cdnBase: string;
  private _cache = new Map<string, WebAssembly.Module>();

  constructor(options?: AtuaNodeOptions) {
    this._cdnBase = options?.cdnBase ?? DEFAULT_CDN_BASE;
  }

  /** Resolve the URL for a WASM artifact */
  resolveUrl(artifactName: string): string {
    const name = artifactName.endsWith('.wasm') ? artifactName : `${artifactName}.wasm`;
    return `${this._cdnBase}/${name}`;
  }

  /**
   * Load and compile a WASM module.
   * Returns cached module if already loaded.
   */
  async load(artifactName: string): Promise<WasmLoadResult> {
    const cached = this._cache.get(artifactName);
    if (cached) {
      return { module: cached, source: 'bundled' };
    }

    const url = this.resolveUrl(artifactName);
    const response = fetch(url);

    let module: WebAssembly.Module;
    if (typeof WebAssembly.compileStreaming === 'function') {
      module = await WebAssembly.compileStreaming(response);
    } else {
      // Fallback for environments without compileStreaming
      const resp = await response;
      const bytes = await resp.arrayBuffer();
      module = await WebAssembly.compile(bytes);
    }

    this._cache.set(artifactName, module);
    const source = this._cdnBase === DEFAULT_CDN_BASE ? 'bundled' : 'cdn';
    return { module, source };
  }

  /** Check if a module is already cached */
  isCached(artifactName: string): boolean {
    return this._cache.has(artifactName);
  }

  /** Clear the module cache */
  clearCache(): void {
    this._cache.clear();
  }
}
