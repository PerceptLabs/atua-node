/**
 * Node.js inspector module — browser-compatible implementation.
 *
 * Browser ceiling: no V8 inspector protocol available in browser.
 * Session provides the expected API surface but post() returns errors.
 */
import { EventEmitter } from 'events';

export const __atua = true;

export class Session extends EventEmitter {
  private _connected = false;

  connect(): void {
    this._connected = true;
  }

  connectToMainThread(): void {
    this._connected = true;
  }

  disconnect(): void {
    this._connected = false;
    this.emit('disconnect');
  }

  post(method: string, params?: any, callback?: (err: Error | null, result?: any) => void): void {
    const cb = typeof params === 'function' ? params : callback;
    const err = Object.assign(
      new Error(`Inspector.Session.post('${method}') is not supported in browser. The V8 inspector protocol is unavailable.`),
      { code: 'ERR_INSPECTOR_NOT_AVAILABLE' }
    );
    if (cb) {
      queueMicrotask(() => cb(err));
    }
  }
}

export function open(_port?: number, _host?: string, _wait?: boolean): void {
  // No-op — no inspector available in browser
}

export function close(): void {
  // No-op
}

export function url(): string | undefined {
  return undefined;
}

export function waitForDebugger(): void {
  // No-op — no debugger to wait for in browser
}

export const console: Console = globalThis.console;

const inspector = {
  Session, open, close, url, waitForDebugger, console, __atua,
};
export default inspector;
