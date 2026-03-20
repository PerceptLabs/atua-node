/**
 * Node.js timers module facade.
 *
 * Wires to the EventLoop phase shim for correct phase ordering.
 */

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

// Promisified timers
export const promises = {
  setTimeout: (delay?: number, value?: unknown) =>
    new Promise<unknown>(resolve => globalThis.setTimeout(() => resolve(value), delay ?? 0)),
  setImmediate: (value?: unknown) =>
    new Promise<unknown>(resolve => globalThis.setTimeout(() => resolve(value), 0)),
  setInterval: async function* (delay?: number, value?: unknown) {
    while (true) {
      await new Promise<void>(resolve => globalThis.setTimeout(resolve, delay ?? 0));
      yield value;
    }
  },
};

export default {
  setTimeout, clearTimeout,
  setInterval, clearInterval,
  setImmediate, clearImmediate,
  promises,
};
