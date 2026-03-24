/**
 * Node.js diagnostics_channel module — pure JS pub/sub implementation.
 *
 * Provides Channel, TracingChannel, and channel() factory.
 */
export const __atua = true;

const _channels = new Map<string, Channel>();

export class Channel {
  readonly name: string | symbol;
  private _subscribers: Array<(message: unknown, name: string | symbol) => void> = [];

  constructor(name: string | symbol) {
    this.name = name;
  }

  get hasSubscribers(): boolean {
    return this._subscribers.length > 0;
  }

  subscribe(onMessage: (message: unknown, name: string | symbol) => void): void {
    this._subscribers.push(onMessage);
  }

  unsubscribe(onMessage: (message: unknown, name: string | symbol) => void): boolean {
    const idx = this._subscribers.indexOf(onMessage);
    if (idx === -1) return false;
    this._subscribers.splice(idx, 1);
    return true;
  }

  publish(message: unknown): void {
    for (const subscriber of this._subscribers) {
      subscriber(message, this.name);
    }
  }

  bindStore(_store: any, _transform?: (data: any) => any): void {
    // No-op: AsyncLocalStorage integration not applicable in browser
  }

  unbindStore(_store: any): void {
    // No-op
  }
}

export function channel(name: string | symbol): Channel {
  const key = typeof name === 'symbol' ? name.toString() : name;
  let ch = _channels.get(key);
  if (!ch) {
    ch = new Channel(name);
    _channels.set(key, ch);
  }
  return ch;
}

export function hasSubscribers(name: string | symbol): boolean {
  const key = typeof name === 'symbol' ? name.toString() : name;
  const ch = _channels.get(key);
  return ch ? ch.hasSubscribers : false;
}

export function subscribe(name: string | symbol, onMessage: (message: unknown, name: string | symbol) => void): void {
  channel(name).subscribe(onMessage);
}

export function unsubscribe(name: string | symbol, onMessage: (message: unknown, name: string | symbol) => void): boolean {
  return channel(name).unsubscribe(onMessage);
}

type TracingSubChannel = 'start' | 'end' | 'asyncStart' | 'asyncEnd' | 'error';

export class TracingChannel {
  readonly start: Channel;
  readonly end: Channel;
  readonly asyncStart: Channel;
  readonly asyncEnd: Channel;
  readonly error: Channel;

  constructor(nameOrChannels: string | Record<TracingSubChannel, Channel>) {
    if (typeof nameOrChannels === 'string') {
      this.start = channel(`${nameOrChannels}:start`);
      this.end = channel(`${nameOrChannels}:end`);
      this.asyncStart = channel(`${nameOrChannels}:asyncStart`);
      this.asyncEnd = channel(`${nameOrChannels}:asyncEnd`);
      this.error = channel(`${nameOrChannels}:error`);
    } else {
      this.start = nameOrChannels.start;
      this.end = nameOrChannels.end;
      this.asyncStart = nameOrChannels.asyncStart;
      this.asyncEnd = nameOrChannels.asyncEnd;
      this.error = nameOrChannels.error;
    }
  }

  subscribe(handlers: Partial<Record<TracingSubChannel, (message: unknown, name: string | symbol) => void>>): void {
    if (handlers.start) this.start.subscribe(handlers.start);
    if (handlers.end) this.end.subscribe(handlers.end);
    if (handlers.asyncStart) this.asyncStart.subscribe(handlers.asyncStart);
    if (handlers.asyncEnd) this.asyncEnd.subscribe(handlers.asyncEnd);
    if (handlers.error) this.error.subscribe(handlers.error);
  }

  unsubscribe(handlers: Partial<Record<TracingSubChannel, (message: unknown, name: string | symbol) => void>>): void {
    if (handlers.start) this.start.unsubscribe(handlers.start);
    if (handlers.end) this.end.unsubscribe(handlers.end);
    if (handlers.asyncStart) this.asyncStart.unsubscribe(handlers.asyncStart);
    if (handlers.asyncEnd) this.asyncEnd.unsubscribe(handlers.asyncEnd);
    if (handlers.error) this.error.unsubscribe(handlers.error);
  }

  traceSync<T>(fn: () => T, context?: object, _thisArg?: any): T {
    const ctx = context ?? {};
    this.start.publish(ctx);
    try {
      const result = fn();
      (ctx as any).result = result;
      this.end.publish(ctx);
      return result;
    } catch (err) {
      (ctx as any).error = err;
      this.error.publish(ctx);
      this.end.publish(ctx);
      throw err;
    }
  }

  async tracePromise<T>(fn: () => Promise<T>, context?: object, _thisArg?: any): Promise<T> {
    const ctx = context ?? {};
    this.start.publish(ctx);
    try {
      const result = await fn();
      (ctx as any).result = result;
      this.asyncEnd.publish(ctx);
      this.end.publish(ctx);
      return result;
    } catch (err) {
      (ctx as any).error = err;
      this.error.publish(ctx);
      this.end.publish(ctx);
      throw err;
    }
  }
}

export function tracingChannel(nameOrChannels: string | Record<TracingSubChannel, Channel>): TracingChannel {
  return new TracingChannel(nameOrChannels);
}

const dc = {
  Channel, TracingChannel, channel, hasSubscribers, subscribe, unsubscribe, tracingChannel, __atua,
};
export default dc;
