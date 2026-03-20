/**
 * Node.js console module facade.
 *
 * Wraps browser console with Node.js Console class API.
 */

export class Console {
  private _stdout: { write: (data: string) => void };
  private _stderr: { write: (data: string) => void };
  private _timers = new Map<string, number>();
  private _counts = new Map<string, number>();

  constructor(stdout?: any, stderr?: any) {
    this._stdout = stdout ?? { write: (d: string) => globalThis.console.log(d) };
    this._stderr = stderr ?? { write: (d: string) => globalThis.console.error(d) };
  }

  log(...args: unknown[]): void {
    globalThis.console.log(...args);
  }

  info(...args: unknown[]): void {
    globalThis.console.info(...args);
  }

  warn(...args: unknown[]): void {
    globalThis.console.warn(...args);
  }

  error(...args: unknown[]): void {
    globalThis.console.error(...args);
  }

  debug(...args: unknown[]): void {
    globalThis.console.debug(...args);
  }

  trace(...args: unknown[]): void {
    globalThis.console.trace(...args);
  }

  dir(obj: unknown, options?: { showHidden?: boolean; depth?: number; colors?: boolean }): void {
    globalThis.console.dir(obj, options);
  }

  dirxml(...args: unknown[]): void {
    globalThis.console.dirxml(...args);
  }

  table(data: unknown, columns?: string[]): void {
    globalThis.console.table(data, columns);
  }

  assert(value: unknown, ...args: unknown[]): void {
    globalThis.console.assert(value, ...args);
  }

  count(label?: string): void {
    const key = label ?? 'default';
    const count = (this._counts.get(key) ?? 0) + 1;
    this._counts.set(key, count);
    this.log(`${key}: ${count}`);
  }

  countReset(label?: string): void {
    this._counts.set(label ?? 'default', 0);
  }

  group(...args: unknown[]): void {
    globalThis.console.group(...args);
  }

  groupCollapsed(...args: unknown[]): void {
    globalThis.console.groupCollapsed(...args);
  }

  groupEnd(): void {
    globalThis.console.groupEnd();
  }

  time(label?: string): void {
    this._timers.set(label ?? 'default', performance.now());
  }

  timeEnd(label?: string): void {
    const key = label ?? 'default';
    const start = this._timers.get(key);
    if (start !== undefined) {
      this.log(`${key}: ${(performance.now() - start).toFixed(3)}ms`);
      this._timers.delete(key);
    }
  }

  timeLog(label?: string, ...args: unknown[]): void {
    const key = label ?? 'default';
    const start = this._timers.get(key);
    if (start !== undefined) {
      this.log(`${key}: ${(performance.now() - start).toFixed(3)}ms`, ...args);
    }
  }

  clear(): void {
    globalThis.console.clear();
  }
}

export default new Console();
