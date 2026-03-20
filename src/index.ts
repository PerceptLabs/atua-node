import { WasmerInitializer } from './wasmer/WasmerInitializer.js';
import { ModuleRouter } from './router/ModuleRouter.js';
import { populateRegistry } from './router/registry.js';
import type { AtuaNodeOptions } from './types/index.js';

export class AtuaNode {
  static create(options?: AtuaNodeOptions): ModuleRouter {
    const initializer = new WasmerInitializer();
    const router = new ModuleRouter(initializer);
    populateRegistry(router);

    if (!options?.skipWasmerInit) {
      router._markInitializing();
      initializer.init();
    }

    return router;
  }
}

export { WasmerInitializer } from './wasmer/WasmerInitializer.js';
export { ModuleRouter } from './router/ModuleRouter.js';
export { populateRegistry } from './router/registry.js';
export type {
  FidelityClass,
  ModuleFactory,
  ModuleRegistryEntry,
  RouterState,
  InitializerState,
  AtuaNodeOptions,
  WasmerUnavailableReason,
} from './types/index.js';
