/**
 * Node.js trace_events module — browser-compatible implementation.
 *
 * Provides createTracing and getEnabledCategories.
 * In browser, tracing is a no-op but provides the correct API surface.
 */
export const __atua = true;

export interface Tracing {
  readonly categories: string;
  enabled: boolean;
  enable(): void;
  disable(): void;
}

export function createTracing(options: { categories: string[] }): Tracing {
  const categories = options.categories.join(',');
  const tracing: Tracing = {
    categories,
    enabled: false,
    enable() { tracing.enabled = true; },
    disable() { tracing.enabled = false; },
  };
  // Use defineProperty to make 'enabled' behave correctly with the getter pattern
  let _enabled = false;
  Object.defineProperty(tracing, 'enabled', {
    get() { return _enabled; },
    set(v: boolean) { _enabled = v; },
    enumerable: true,
    configurable: true,
  });
  return tracing;
}

export function getEnabledCategories(): string | undefined {
  return undefined;
}

const traceEvents = { createTracing, getEnabledCategories, __atua };
export default traceEvents;
