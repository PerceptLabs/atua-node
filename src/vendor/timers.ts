/**
 * Node.js timers module facade.
 *
 * Wires to the EventLoop phase shim for correct phase ordering.
 */
export const __atua = true;

import { process } from './process.js';

const _loop = process._eventLoop;

export function setTimeout(callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]): ReturnType<typeof globalThis.setTimeout> {
  if (args.length > 0) {
    return globalThis.setTimeout(() => callback(...args), delay ?? 0);
  }
  return globalThis.setTimeout(callback, delay ?? 0);
}

export function clearTimeout(id: ReturnType<typeof globalThis.setTimeout>): void {
  globalThis.clearTimeout(id);
}

export function setInterval(callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]): ReturnType<typeof globalThis.setInterval> {
  if (args.length > 0) {
    return globalThis.setInterval(() => callback(...args), delay ?? 0);
  }
  return globalThis.setInterval(callback, delay ?? 0);
}

export function clearInterval(id: ReturnType<typeof globalThis.setInterval>): void {
  globalThis.clearInterval(id);
}

export function setImmediate(callback: (...args: unknown[]) => void, ...args: unknown[]): { ref(): void; unref(): void; hasRef(): boolean } {
  const handle = {
    _id: globalThis.setTimeout(() => {
      if (args.length > 0) callback(...args);
      else callback();
    }, 0),
    ref() {},
    unref() {},
    hasRef() { return true; },
  };
  return handle;
}

export function clearImmediate(handle: { _id?: ReturnType<typeof globalThis.setTimeout> }): void {
  if (handle && handle._id !== undefined) {
    globalThis.clearTimeout(handle._id);
  }
}

// Promisified timers (Node 24 API with AbortSignal support)
export const promises = {
  setTimeout: (delay?: number, value?: unknown, options?: { signal?: AbortSignal }) => {
    return new Promise<unknown>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('The operation was aborted', 'AbortError'));
        return;
      }
      const id = globalThis.setTimeout(() => {
        if (options?.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
        resolve(value);
      }, delay ?? 0);
      function onAbort() {
        globalThis.clearTimeout(id);
        reject(new DOMException('The operation was aborted', 'AbortError'));
      }
      if (options?.signal) {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  },

  setImmediate: (value?: unknown, options?: { signal?: AbortSignal }) => {
    return new Promise<unknown>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('The operation was aborted', 'AbortError'));
        return;
      }
      const id = globalThis.setTimeout(() => {
        if (options?.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
        resolve(value);
      }, 0);
      function onAbort() {
        globalThis.clearTimeout(id);
        reject(new DOMException('The operation was aborted', 'AbortError'));
      }
      if (options?.signal) {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  },

  setInterval: (delay?: number, value?: unknown, options?: { signal?: AbortSignal }) => {
    const interval = delay ?? 0;
    const signal = options?.signal;

    return {
      [Symbol.asyncIterator]() {
        let resolvePending: ((val: IteratorResult<unknown>) => void) | null = null;
        let done = false;
        let timerId: ReturnType<typeof globalThis.setInterval> | null = null;

        if (signal?.aborted) {
          done = true;
        }

        function onAbort() {
          done = true;
          if (timerId !== null) {
            globalThis.clearInterval(timerId);
            timerId = null;
          }
          if (resolvePending) {
            resolvePending({ value: undefined, done: true });
            resolvePending = null;
          }
        }

        if (signal && !done) {
          signal.addEventListener('abort', onAbort, { once: true });
        }

        if (!done) {
          timerId = globalThis.setInterval(() => {
            if (resolvePending) {
              resolvePending({ value, done: false });
              resolvePending = null;
            }
          }, interval);
        }

        return {
          next(): Promise<IteratorResult<unknown>> {
            if (done) {
              return Promise.resolve({ value: undefined, done: true });
            }
            return new Promise<IteratorResult<unknown>>(resolve => {
              resolvePending = resolve;
            });
          },
          return(): Promise<IteratorResult<unknown>> {
            done = true;
            if (timerId !== null) {
              globalThis.clearInterval(timerId);
              timerId = null;
            }
            if (signal) {
              signal.removeEventListener('abort', onAbort);
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
  },

  scheduler: {
    wait(delay: number, options?: { signal?: AbortSignal }): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (options?.signal?.aborted) {
          reject(new DOMException('The operation was aborted', 'AbortError'));
          return;
        }
        const id = globalThis.setTimeout(() => {
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          resolve();
        }, delay);
        function onAbort() {
          globalThis.clearTimeout(id);
          reject(new DOMException('The operation was aborted', 'AbortError'));
        }
        if (options?.signal) {
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
      });
    },
    yield(): Promise<void> {
      return new Promise<void>(resolve => globalThis.setTimeout(resolve, 0));
    },
  },
};

export default {
  setTimeout, clearTimeout,
  setInterval, clearInterval,
  setImmediate, clearImmediate,
  promises,
};
