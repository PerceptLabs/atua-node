import type { FidelityClass, ModuleRegistryEntry } from '../types/index.js';
import type { ModuleRouter } from './ModuleRouter.js';
import { vendorModules } from './vendor-map.js';

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
    router.register(makeEntry(name, 'unenv', 'unenv', vendorModules.get(name)));
  }

  // Vendored JS modules — our TypeScript facades
  const vendoredJsModules = ['stream', 'timers', 'process', 'console'];
  for (const name of vendoredJsModules) {
    router.register(makeEntry(name, 'vendored-js', 'atua', vendorModules.get(name)));
  }

  // WASIX modules — backed by .wasm when available, fall back to vendored JS
  const wasixModules = ['crypto', 'fs', 'http', 'https', 'zlib', 'net', 'tls', 'buffer', 'os', 'dns', 'url'];
  for (const name of wasixModules) {
    router.register(makeEntry(name, 'wasix', 'atua', vendorModules.get(name)));
  }

  // WASIX-required modules — fall back to vendor baseImpl when WASIX unavailable
  const wasixRequiredModules = ['vm', 'child_process', 'worker_threads', 'cluster'];
  for (const name of wasixRequiredModules) {
    router.register(makeEntry(name, 'wasix-required', 'atua', vendorModules.get(name)));
  }
}
