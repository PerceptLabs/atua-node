/**
 * Node.js readline module — browser-compatible implementation.
 *
 * Provides Interface class with question/prompt/close and async iteration.
 */
import { EventEmitter } from 'events';

export const __atua = true;

export class Interface extends EventEmitter {
  terminal: boolean;
  line: string = '';
  cursor: number = 0;
  private _prompt: string = '> ';
  private _closed: boolean = false;
  private _input: any;
  private _output: any;

  constructor(inputOrOptions?: any, output?: any, _completer?: any, _terminal?: boolean) {
    super();
    if (inputOrOptions && typeof inputOrOptions === 'object' && !inputOrOptions.readable) {
      this._input = inputOrOptions.input || null;
      this._output = inputOrOptions.output || null;
      this.terminal = inputOrOptions.terminal ?? false;
      if (inputOrOptions.prompt !== undefined) this._prompt = inputOrOptions.prompt;
    } else {
      this._input = inputOrOptions || null;
      this._output = output || null;
      this.terminal = _terminal ?? false;
    }
  }

  setPrompt(prompt: string): void {
    this._prompt = prompt;
  }

  getPrompt(): string {
    return this._prompt;
  }

  prompt(preserveCursor?: boolean): void {
    if (this._closed) return;
    if (this._output && this._output.write) {
      this._output.write(this._prompt);
    }
    if (!preserveCursor) this.cursor = this._prompt.length;
  }

  question(query: string, optionsOrCallback?: any, callback?: (answer: string) => void): void {
    const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
    if (this._output && this._output.write) {
      this._output.write(query);
    }
    if (cb) {
      this.once('line', cb);
    }
  }

  pause(): this {
    this.emit('pause');
    return this;
  }

  resume(): this {
    this.emit('resume');
    return this;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.emit('close');
  }

  write(data: string | Buffer, _key?: { ctrl?: boolean; meta?: boolean; shift?: boolean; name?: string }): void {
    if (this._closed) return;
    const str = typeof data === 'string' ? data : data.toString();
    for (const char of str) {
      if (char === '\n' || char === '\r') {
        const line = this.line;
        this.line = '';
        this.cursor = 0;
        this.emit('line', line);
      } else {
        this.line += char;
        this.cursor++;
      }
    }
  }

  getCursorPos(): { rows: number; cols: number } {
    return { rows: 0, cols: this.cursor };
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<string> {
    const lines: string[] = [];
    let resolve: ((v: IteratorResult<string>) => void) | null = null;
    let done = false;

    this.on('line', (line: string) => {
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: line, done: false });
      } else {
        lines.push(line);
      }
    });
    this.once('close', () => {
      done = true;
      if (resolve) {
        const r = resolve;
        resolve = null;
        r({ value: undefined as any, done: true });
      }
    });

    while (!done) {
      if (lines.length > 0) {
        yield lines.shift()!;
      } else {
        const result = await new Promise<IteratorResult<string>>(r => { resolve = r; });
        if (result.done) return;
        yield result.value;
      }
    }
  }
}

export function createInterface(inputOrOptions?: any, output?: any, completer?: any, terminal?: boolean): Interface {
  return new Interface(inputOrOptions, output, completer, terminal);
}

export function clearLine(stream: any, dir: number, callback?: () => void): boolean {
  if (stream && typeof stream.clearLine === 'function') {
    return stream.clearLine(dir, callback);
  }
  if (callback) queueMicrotask(callback);
  return true;
}

export function cursorTo(stream: any, x: number, y?: number | (() => void), callback?: () => void): boolean {
  if (stream && typeof stream.cursorTo === 'function') {
    return stream.cursorTo(x, y, callback);
  }
  const cb = typeof y === 'function' ? y : callback;
  if (cb) queueMicrotask(cb);
  return true;
}

export function moveCursor(stream: any, dx: number, dy: number, callback?: () => void): boolean {
  if (stream && typeof stream.moveCursor === 'function') {
    return stream.moveCursor(dx, dy, callback);
  }
  if (callback) queueMicrotask(callback);
  return true;
}

export function emitKeypressEvents(_stream: any, _interface?: Interface): void {
  // No-op in browser — no raw keypresses available
}

const readline = {
  Interface, createInterface, clearLine, cursorTo, moveCursor, emitKeypressEvents, __atua,
};
export default readline;
