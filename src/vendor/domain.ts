/**
 * Node.js domain module — browser-compatible implementation.
 *
 * Deprecated in Node.js but still used by some packages.
 * Provides Domain class with run, add, remove, bind, intercept.
 */
import { EventEmitter } from 'events';

export const __atua = true;

export let active: Domain | null = null;
const _stack: Domain[] = [];

export class Domain extends EventEmitter {
  members: any[] = [];
  private _disposed = false;

  run<T>(fn: (...args: any[]) => T, ...args: any[]): T {
    if (this._disposed) throw new Error('Domain has been disposed');
    this.enter();
    try {
      const result = fn(...args);
      return result;
    } catch (err) {
      this.emit('error', err);
      throw err;
    } finally {
      this.exit();
    }
  }

  add(emitter: EventEmitter): void {
    if (this.members.indexOf(emitter) !== -1) return;
    this.members.push(emitter);
    (emitter as any).domain = this;
  }

  remove(emitter: EventEmitter): void {
    const idx = this.members.indexOf(emitter);
    if (idx !== -1) {
      this.members.splice(idx, 1);
      (emitter as any).domain = null;
    }
  }

  bind<F extends (...args: any[]) => any>(fn: F): F {
    const domain = this;
    const bound = function (this: any, ...args: any[]) {
      domain.enter();
      try {
        return fn.apply(this, args);
      } catch (err) {
        domain.emit('error', err);
        throw err;
      } finally {
        domain.exit();
      }
    } as unknown as F;
    (bound as any).domain = domain;
    return bound;
  }

  intercept<F extends (...args: any[]) => any>(fn: F): F {
    const domain = this;
    const intercepted = function (this: any, err: any, ...args: any[]) {
      if (err) {
        domain.emit('error', err);
        return;
      }
      domain.enter();
      try {
        return fn.apply(this, args);
      } catch (e) {
        domain.emit('error', e);
        throw e;
      } finally {
        domain.exit();
      }
    } as unknown as F;
    (intercepted as any).domain = domain;
    return intercepted;
  }

  enter(): void {
    if (this._disposed) return;
    _stack.push(this);
    active = this;
  }

  exit(): void {
    const idx = _stack.lastIndexOf(this);
    if (idx !== -1) {
      _stack.splice(idx);
    }
    active = _stack.length > 0 ? _stack[_stack.length - 1] : null;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.removeAllListeners();
    for (const member of this.members) {
      if (typeof member.dispose === 'function') {
        member.dispose();
      }
    }
    this.members.length = 0;
    this.exit();
    this.emit('dispose');
  }
}

export function create(): Domain {
  return new Domain();
}

const domain = { Domain, create, active, __atua };
export default domain;
