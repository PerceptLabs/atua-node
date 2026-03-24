/**
 * Node.js async_hooks module — browser-compatible implementation.
 *
 * AsyncLocalStorage uses a real context stack for run/exit/getStore.
 * AsyncResource provides runInAsyncScope and bind.
 */
export const __atua = true;

let _asyncIdCounter = 1;
function nextAsyncId(): number { return _asyncIdCounter++; }

let _executionAsyncId = 0;
let _triggerAsyncId = 0;

export function executionAsyncId(): number {
  return _executionAsyncId;
}

export function triggerAsyncId(): number {
  return _triggerAsyncId;
}

export function executionAsyncResource(): object {
  return {};
}

export interface HookCallbacks {
  init?: (asyncId: number, type: string, triggerAsyncId: number, resource: object) => void;
  before?: (asyncId: number) => void;
  after?: (asyncId: number) => void;
  destroy?: (asyncId: number) => void;
  promiseResolve?: (asyncId: number) => void;
}

export function createHook(callbacks: HookCallbacks): { enable(): void; disable(): void } {
  let enabled = false;
  return {
    enable() { enabled = true; void callbacks; },
    disable() { enabled = false; },
  };
}

export class AsyncLocalStorage<T = any> {
  private _stack: T[] = [];
  private _enabled = true;

  disable(): void {
    this._enabled = false;
    this._stack.length = 0;
  }

  getStore(): T | undefined {
    if (!this._enabled || this._stack.length === 0) return undefined;
    return this._stack[this._stack.length - 1];
  }

  run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R {
    this._enabled = true;
    this._stack.push(store);
    try {
      return callback(...args);
    } finally {
      this._stack.pop();
    }
  }

  exit<R>(callback: (...args: any[]) => R, ...args: any[]): R {
    const saved = this._stack.slice();
    this._stack.length = 0;
    try {
      return callback(...args);
    } finally {
      this._stack.length = 0;
      this._stack.push(...saved);
    }
  }

  enterWith(store: T): void {
    this._enabled = true;
    if (this._stack.length > 0) {
      this._stack[this._stack.length - 1] = store;
    } else {
      this._stack.push(store);
    }
  }

  static bind<Func extends (...args: any[]) => any>(fn: Func): Func {
    return fn;
  }

  static snapshot(): <R>(fn: (...args: any[]) => R, ...args: any[]) => R {
    return <R>(fn: (...args: any[]) => R, ...args: any[]) => fn(...args);
  }
}

export class AsyncResource {
  readonly type: string;
  private _asyncId: number;
  private _triggerAsyncId: number;

  constructor(type: string, triggerAsyncIdOrOpts?: number | { triggerAsyncId?: number; requireManualDestroy?: boolean }) {
    this.type = type;
    this._asyncId = nextAsyncId();
    if (typeof triggerAsyncIdOrOpts === 'number') {
      this._triggerAsyncId = triggerAsyncIdOrOpts;
    } else {
      this._triggerAsyncId = triggerAsyncIdOrOpts?.triggerAsyncId ?? _executionAsyncId;
    }
  }

  runInAsyncScope<R>(fn: (...args: any[]) => R, thisArg?: any, ...args: any[]): R {
    const prevExec = _executionAsyncId;
    const prevTrigger = _triggerAsyncId;
    _executionAsyncId = this._asyncId;
    _triggerAsyncId = this._triggerAsyncId;
    try {
      return fn.apply(thisArg, args);
    } finally {
      _executionAsyncId = prevExec;
      _triggerAsyncId = prevTrigger;
    }
  }

  emitDestroy(): this {
    return this;
  }

  asyncId(): number {
    return this._asyncId;
  }

  triggerAsyncId(): number {
    return this._triggerAsyncId;
  }

  bind<Func extends (...args: any[]) => any>(fn: Func, _thisArg?: any): Func {
    const resource = this;
    const bound = function (this: any, ...args: any[]) {
      return resource.runInAsyncScope(fn, this, ...args);
    } as any;
    return bound;
  }

  static bind<Func extends (...args: any[]) => any>(fn: Func, type?: string, _thisArg?: any): Func {
    const resource = new AsyncResource(type ?? 'bound-anonymous-fn');
    return resource.bind(fn);
  }
}

const asyncHooks = {
  AsyncLocalStorage,
  AsyncResource,
  createHook,
  executionAsyncId,
  triggerAsyncId,
  executionAsyncResource,
  __atua,
};
export default asyncHooks;
