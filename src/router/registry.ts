import type { FidelityClass, ModuleRegistryEntry } from '../types/index.js';
import type { ModuleRouter } from './ModuleRouter.js';

function makeEntry(
  name: string,
  fidelityClass: FidelityClass,
  provider: string
): ModuleRegistryEntry {
  return {
    name,
    fidelityClass,
    baseImpl: () => ({ notImplemented: true, moduleName: name }),
    wasixImpl: null,
    wasmArtifact: null,
    loaded: false,
    provider,
  };
}

export function populateRegistry(router: ModuleRouter): void {
  const unenvModules = ['path', 'util', 'events', 'assert', 'querystring', 'string_decoder', 'punycode'];
  const vendoredJsModules = ['stream', 'timers', 'process', 'console'];
  const wasixModules = ['crypto', 'fs', 'http', 'https', 'zlib', 'net', 'tls', 'buffer', 'os', 'dns', 'url'];
  const wasixRequiredModules = ['vm', 'child_process', 'worker_threads', 'cluster'];

  for (const name of unenvModules) {
    router.register(makeEntry(name, 'unenv', 'unenv'));
  }

  for (const name of vendoredJsModules) {
    router.register(makeEntry(name, 'vendored-js', 'atua'));
  }

  for (const name of wasixModules) {
    router.register(makeEntry(name, 'wasix', 'atua'));
  }

  for (const name of wasixRequiredModules) {
    router.register(makeEntry(name, 'wasix-required', 'atua'));
  }
}
