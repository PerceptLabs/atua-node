import type { FidelityClass, ModuleRegistryEntry } from '../types/index.js';
import type { ModuleRouter } from './ModuleRouter.js';

// Module cache for vendored implementations (lazy-loaded via dynamic import)
const _moduleCache = new Map<string, unknown>();

async function loadVendoredModule(name: string): Promise<unknown> {
  if (_moduleCache.has(name)) return _moduleCache.get(name)!;
  const mod = await import(`../vendor/${name}.js`);
  _moduleCache.set(name, mod.default ?? mod);
  return _moduleCache.get(name)!;
}

function makeEntry(
  name: string,
  fidelityClass: FidelityClass,
  provider: string,
  baseImpl?: () => unknown
): ModuleRegistryEntry {
  return {
    name,
    fidelityClass,
    baseImpl: baseImpl ?? (() => ({ notImplemented: true, moduleName: name })),
    wasixImpl: null,
    wasmArtifact: null,
    loaded: false,
    provider,
  };
}

export function populateRegistry(router: ModuleRouter): void {
  // Unenv modules — pure JS polyfills, always available
  const unenvModules = ['path', 'util', 'events', 'assert', 'querystring', 'string_decoder', 'punycode'];
  for (const name of unenvModules) {
    router.register(makeEntry(name, 'unenv', 'unenv'));
  }

  // Vendored JS modules — our TypeScript facades
  const vendoredJsModules = ['stream', 'timers', 'process', 'console'];
  for (const name of vendoredJsModules) {
    router.register(makeEntry(name, 'vendored-js', 'atua'));
  }

  // WASIX modules — backed by .wasm when available, fall back to vendored JS
  const wasixModules = ['crypto', 'fs', 'http', 'https', 'zlib', 'net', 'tls', 'buffer', 'os', 'dns', 'url'];
  for (const name of wasixModules) {
    router.register(makeEntry(name, 'wasix', 'atua'));
  }

  // WASIX-required modules — throw if WASIX not available
  const wasixRequiredModules = ['vm', 'child_process', 'worker_threads', 'cluster'];
  for (const name of wasixRequiredModules) {
    router.register(makeEntry(name, 'wasix-required', 'atua'));
  }
}
