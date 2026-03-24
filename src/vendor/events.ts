/**
 * Node.js events module — browser-compatible via events npm package.
 */
export const __atua = true;

import { EventEmitter } from 'events';

export { EventEmitter };

/** once() — resolves on first event, rejects on 'error' */
export function once(emitter: any, name: string, options?: { signal?: AbortSignal }): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) { reject(new Error('AbortError')); return; }

    const onEvent = (...args: any[]) => { emitter.removeListener('error', onError); cleanup(); resolve(args); };
    const onError = (err: any) => { emitter.removeListener(name, onEvent); cleanup(); reject(err); };
    const onAbort = () => { emitter.removeListener(name, onEvent); emitter.removeListener('error', onError); reject(new Error('AbortError')); };

    function cleanup() { signal?.removeEventListener('abort', onAbort); }

    emitter.once(name, onEvent);
    if (name !== 'error') emitter.once('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** on() — async iterable from event emitter */
export function on(emitter: any, event: string): AsyncIterable<any[]> {
  const queue: any[][] = [];
  let resolve: ((value: IteratorResult<any[]>) => void) | null = null;
  let done = false;

  emitter.on(event, (...args: any[]) => {
    if (resolve) { const r = resolve; resolve = null; r({ value: args, done: false }); }
    else queue.push(args);
  });

  return {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<any[]>> {
          if (queue.length > 0) return Promise.resolve({ value: queue.shift()!, done: false });
          if (done) return Promise.resolve({ value: undefined as any, done: true });
          return new Promise(r => { resolve = r; });
        },
        return(): Promise<IteratorResult<any[]>> {
          done = true;
          return Promise.resolve({ value: undefined as any, done: true });
        },
      };
    },
  };
}

/** getEventListeners — get copy of listeners for event */
export function getEventListeners(emitter: any, name: string): Function[] {
  return emitter.listeners?.(name) ?? [];
}

/** setMaxListeners — set max across emitters */
export function setMaxListeners(n: number, ...emitters: any[]): void {
  for (const e of emitters) e.setMaxListeners?.(n);
}

/** listenerCount — get count for an event */
export function listenerCount(emitter: any, name: string): number {
  return emitter.listenerCount?.(name) ?? 0;
}

/** Node 24: addAbortListener */
export function addAbortListener(signal: AbortSignal, listener: () => void): { [Symbol.dispose](): void } {
  signal.addEventListener('abort', listener, { once: true });
  return { [Symbol.dispose]() { signal.removeEventListener('abort', listener); } };
}

/** Node 24: getMaxListeners */
export function getMaxListeners(emitter: any): number {
  return emitter.getMaxListeners?.() ?? EventEmitter.defaultMaxListeners;
}

export default EventEmitter;
