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
  // Unenv modules — standalone browser-compatible implementations
  const unenvModules = ['path', 'util', 'events', 'assert', 'querystring', 'string_decoder', 'punycode', 'sys'];
  for (const name of unenvModules) {
    router.register(makeEntry(name, 'unenv', 'unenv', vendorModules.get(name)));
  }

  // Vendored JS modules — our TypeScript facades
  const vendoredJsModules = [
    'stream', 'timers', 'process', 'console',
    // New modules
    'tty', 'readline', 'module', 'async_hooks', 'perf_hooks',
    'diagnostics_channel', 'constants', 'domain', 'v8',
    'inspector', 'trace_events', 'repl', 'test', 'sea',
  ];
  for (const name of vendoredJsModules) {
    router.register(makeEntry(name, 'vendored-js', 'atua', vendorModules.get(name)));
  }

  // WASIX modules — backed by .wasm when available, fall back to vendored JS
  const wasixModules = ['crypto', 'fs', 'http', 'https', 'zlib', 'net', 'tls', 'buffer', 'os', 'dns', 'url', 'wasi'];
  for (const name of wasixModules) {
    router.register(makeEntry(name, 'wasix', 'atua', vendorModules.get(name)));
  }

  // WASIX-required modules — fall back to vendor baseImpl when WASIX unavailable
  const wasixRequiredModules = ['vm', 'child_process', 'worker_threads', 'cluster', 'http2', 'dgram'];
  for (const name of wasixRequiredModules) {
    router.register(makeEntry(name, 'wasix-required', 'atua', vendorModules.get(name)));
  }
}
