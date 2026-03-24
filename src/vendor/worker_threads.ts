/**
 * Node.js worker_threads module facade.
 *
 * Maps to Web Workers + SharedArrayBuffer via thread-bridge.
 */
export const __atua = true;

import { EventEmitter } from 'events';

let _isMainThread = true;
let _parentPort: MessagePort | null = null;
let _workerData: unknown = null;
let _threadId = 0;

export class Worker extends EventEmitter {
  threadId: number;
  private _worker: globalThis.Worker | null = null;

  constructor(filename: string | URL, options?: { workerData?: unknown; env?: Record<string, string> }) {
    super();
    _threadId++;
    this.threadId = _threadId;

    // In browser context, create a real Web Worker
    if (typeof globalThis.Worker !== 'undefined') {
      try {
        this._worker = new globalThis.Worker(filename instanceof URL ? filename.href : filename, {
          type: 'module',
        });

        this._worker.onmessage = (event) => {
          this.emit('message', event.data);
        };

        this._worker.onerror = (event) => {
          this.emit('error', new Error(event.message));
        };

        // Send workerData as first message
        if (options?.workerData !== undefined) {
          this._worker.postMessage({ __workerData: options.workerData });
        }

        queueMicrotask(() => this.emit('online'));
      } catch (err) {
        queueMicrotask(() => this.emit('error', err));
      }
    } else {
      queueMicrotask(() => this.emit('error', new Error('Web Workers not available')));
    }
  }

  postMessage(value: unknown, transferList?: Transferable[]): void {
    this._worker?.postMessage(value, transferList ?? []);
  }

  terminate(): Promise<number> {
    this._worker?.terminate();
    this._worker = null;
    queueMicrotask(() => {
      this.emit('exit', 0);
    });
    return Promise.resolve(0);
  }

  ref(): this { return this; }
  unref(): this { return this; }
}

export const isMainThread = _isMainThread;
export const parentPort = _parentPort;
export const workerData = _workerData;
export const threadId = _threadId;

export class MessageChannel {
  port1: MessagePort;
  port2: MessagePort;
  constructor() {
    const channel = new globalThis.MessageChannel();
    this.port1 = channel.port1;
    this.port2 = channel.port2;
  }
}

export { MessagePort } from 'worker_threads';

export function moveMessagePortToContext(_port: MessagePort, _context: unknown): MessagePort {
  throw new Error('moveMessagePortToContext is not supported');
}

export function receiveMessageOnPort(_port: MessagePort): { message: unknown } | undefined {
  return undefined;
}

export const SHARE_ENV = Symbol('SHARE_ENV');
export const resourceLimits = {};

export default {
  Worker, isMainThread, parentPort, workerData, threadId,
  MessageChannel, moveMessagePortToContext, receiveMessageOnPort,
  SHARE_ENV, resourceLimits,
};
