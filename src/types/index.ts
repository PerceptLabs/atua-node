export type FidelityClass = 'unenv' | 'vendored-js' | 'wasix' | 'wasix-required';

export type ModuleFactory = () => unknown;

export interface ModuleRegistryEntry {
  name: string;
  fidelityClass: FidelityClass;
  baseImpl: ModuleFactory;
  wasixImpl: ModuleFactory | null;
  wasmArtifact: string | null;
  loaded: boolean;
  provider: string;
}

export type RouterState = 'base' | 'initializing' | 'enhanced';

export type InitializerState = 'idle' | 'initializing' | 'ready' | 'failed';

export interface AtuaNodeOptions {
  cdnBase?: string;
  skipWasmerInit?: boolean;
}

export interface WasmerUnavailableReason {
  code: 'no-coop-coep' | 'no-shared-array-buffer' | 'init-error' | 'unsupported';
  message: string;
}
