/**
 * Node.js perf_hooks module — browser-compatible implementation.
 *
 * Delegates to globalThis.performance and globalThis.PerformanceObserver.
 */
export const __atua = true;

export const performance: Performance = globalThis.performance;
export const PerformanceObserver: typeof globalThis.PerformanceObserver = globalThis.PerformanceObserver;
export const PerformanceEntry: any = (globalThis as any).PerformanceEntry ?? class PerformanceEntry {};

export interface Histogram {
  enable(): boolean;
  disable(): boolean;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly stddev: number;
  readonly exceeds: number;
  percentile(p: number): number;
  percentiles: Map<number, number>;
  reset(): void;
}

export function monitorEventLoopDelay(options?: { resolution?: number }): Histogram {
  void options;
  const data: number[] = [];
  let enabled = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  const resolution = options?.resolution ?? 10;

  const histogram: Histogram = {
    enable() {
      if (enabled) return false;
      enabled = true;
      interval = setInterval(() => {
        const start = performance.now();
        setTimeout(() => {
          const delay = (performance.now() - start) * 1e6; // convert to ns
          data.push(delay);
        }, 0);
      }, resolution);
      return true;
    },
    disable() {
      if (!enabled) return false;
      enabled = false;
      if (interval !== null) { clearInterval(interval); interval = null; }
      return true;
    },
    get min() { return data.length ? Math.min(...data) : 0; },
    get max() { return data.length ? Math.max(...data) : 0; },
    get mean() {
      if (!data.length) return 0;
      return data.reduce((s, v) => s + v, 0) / data.length;
    },
    get stddev() {
      if (data.length < 2) return 0;
      const m = histogram.mean;
      return Math.sqrt(data.reduce((s, v) => s + (v - m) ** 2, 0) / data.length);
    },
    get exceeds() { return 0; },
    percentile(p: number): number {
      if (!data.length) return 0;
      const sorted = [...data].sort((a, b) => a - b);
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    },
    get percentiles(): Map<number, number> {
      const m = new Map<number, number>();
      for (const p of [0, 50, 75, 90, 99, 99.9, 100]) {
        m.set(p, histogram.percentile(p));
      }
      return m;
    },
    reset() { data.length = 0; },
  };
  return histogram;
}

export function createHistogram(): Histogram {
  return monitorEventLoopDelay();
}

export class PerformanceObserverEntryList {
  private _entries: PerformanceEntry[];
  constructor(entries: PerformanceEntry[] = []) { this._entries = entries; }
  getEntries() { return this._entries.slice(); }
  getEntriesByName(name: string) { return this._entries.filter(e => e.name === name); }
  getEntriesByType(type: string) { return this._entries.filter(e => e.entryType === type); }
}

const perfHooks = {
  performance,
  PerformanceObserver,
  PerformanceEntry,
  PerformanceObserverEntryList,
  monitorEventLoopDelay,
  createHistogram,
  __atua,
};
export default perfHooks;
