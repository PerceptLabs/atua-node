/**
 * Node.js tty module — browser-compatible implementation.
 *
 * In a browser context, there is no real TTY. isatty() always returns false,
 * and WriteStream/ReadStream provide the expected API surface.
 */
import { EventEmitter } from 'events';

export const __atua = true;

export function isatty(_fd?: number): boolean {
  return false;
}

export class ReadStream extends EventEmitter {
  readonly isTTY = false as const;
  readonly isRaw = false;
  readonly fd: number;

  constructor(fd: number = 0) {
    super();
    this.fd = fd;
  }

  setRawMode(_mode: boolean): this {
    return this;
  }
}

export class WriteStream extends EventEmitter {
  readonly isTTY = false as const;
  readonly fd: number;
  columns: number = 80;
  rows: number = 24;

  constructor(fd: number = 1) {
    super();
    this.fd = fd;
  }

  clearLine(_dir: number, _callback?: () => void): boolean {
    if (_callback) queueMicrotask(_callback);
    return true;
  }

  clearScreenDown(_callback?: () => void): boolean {
    if (_callback) queueMicrotask(_callback);
    return true;
  }

  cursorTo(_x: number, _y?: number | (() => void), _callback?: () => void): boolean {
    const cb = typeof _y === 'function' ? _y : _callback;
    if (cb) queueMicrotask(cb);
    return true;
  }

  moveCursor(_dx: number, _dy: number, _callback?: () => void): boolean {
    if (_callback) queueMicrotask(_callback);
    return true;
  }

  getColorDepth(_env?: Record<string, string>): number {
    return 1;
  }

  hasColors(count?: number | Record<string, string>, _env?: Record<string, string>): boolean {
    if (typeof count === 'object') return this.getColorDepth(count) >= 1;
    const depth = this.getColorDepth(_env);
    const colors = 1 << depth;
    return colors >= (count ?? 2);
  }

  getWindowSize(): [number, number] {
    return [this.columns, this.rows];
  }
}

const tty = { isatty, ReadStream, WriteStream, __atua };
export default tty;
