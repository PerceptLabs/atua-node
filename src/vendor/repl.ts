/**
 * Node.js repl module — browser-compatible implementation.
 *
 * Provides REPLServer, start(), REPL_MODE constants, and Recoverable error.
 */
import { EventEmitter } from 'events';

export const __atua = true;

export const REPL_MODE_SLOPPY = Symbol.for('repl-sloppy');
export const REPL_MODE_STRICT = Symbol.for('repl-strict');

export class Recoverable extends SyntaxError {
  err: Error;
  constructor(err: Error) {
    super(err.message);
    this.err = err;
    this.name = 'Recoverable';
  }
}

export interface ReplOptions {
  prompt?: string;
  input?: any;
  output?: any;
  terminal?: boolean;
  eval?: (code: string, context: any, filename: string, callback: (err: Error | null, result?: any) => void) => void;
  useColors?: boolean;
  useGlobal?: boolean;
  ignoreUndefined?: boolean;
  writer?: (obj: any) => string;
  completer?: (line: string, callback: (err: Error | null, result: [string[], string]) => void) => void;
  replMode?: symbol;
  breakEvalOnSigint?: boolean;
  preview?: boolean;
}

export class REPLServer extends EventEmitter {
  readonly prompt: string;
  readonly input: any;
  readonly output: any;
  readonly terminal: boolean;
  readonly useColors: boolean;
  readonly useGlobal: boolean;
  readonly ignoreUndefined: boolean;
  readonly replMode: symbol;
  context: Record<string, any> = {};
  lines: string[] = [];
  line: string = '';
  cursor: number = 0;
  private _commands: Map<string, { help: string; action: (text: string) => void }> = new Map();
  private _eval: (code: string, context: any, filename: string, callback: (err: Error | null, result?: any) => void) => void;
  private _writer: (obj: any) => string;
  private _closed = false;

  constructor(options: ReplOptions = {}) {
    super();
    this.prompt = options.prompt ?? '> ';
    this.input = options.input ?? null;
    this.output = options.output ?? null;
    this.terminal = options.terminal ?? false;
    this.useColors = options.useColors ?? false;
    this.useGlobal = options.useGlobal ?? false;
    this.ignoreUndefined = options.ignoreUndefined ?? false;
    this.replMode = options.replMode ?? REPL_MODE_SLOPPY;
    this._writer = options.writer ?? ((obj: any) => typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
    this._eval = options.eval ?? defaultEval;
    this._setupContext();
    this._setupDefaultCommands();
  }

  private _setupContext(): void {
    if (this.useGlobal) {
      this.context = globalThis as any;
    } else {
      this.context = Object.create(null);
      this.context.console = console;
    }
  }

  private _setupDefaultCommands(): void {
    this.defineCommand('help', {
      help: 'Print this help message',
      action: () => {
        for (const [name, cmd] of this._commands) {
          this._writeOutput(`.${name}\t${cmd.help}\n`);
        }
        this.displayPrompt();
      },
    });
    this.defineCommand('exit', {
      help: 'Exit the REPL',
      action: () => { this.close(); },
    });
    this.defineCommand('clear', {
      help: 'Break, and also clear the local context',
      action: () => {
        this._setupContext();
        this._writeOutput('Successfully cleared context.\n');
        this.displayPrompt();
      },
    });
  }

  private _writeOutput(text: string): void {
    if (this.output && typeof this.output.write === 'function') {
      this.output.write(text);
    }
  }

  defineCommand(keyword: string, cmd: { help: string; action: (text: string) => void } | ((text: string) => void)): void {
    if (typeof cmd === 'function') {
      this._commands.set(keyword, { help: '', action: cmd });
    } else {
      this._commands.set(keyword, cmd);
    }
  }

  displayPrompt(preserveCursor?: boolean): void {
    if (this._closed) return;
    this._writeOutput(this.prompt);
    if (!preserveCursor) this.cursor = this.prompt.length;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.emit('exit');
    this.emit('close');
  }

  setPrompt(prompt: string): void {
    (this as any).prompt = prompt;
  }

  clearBufferedCommand(): void {
    this.line = '';
    this.lines = [];
  }

  setupHistory(_historyPath: string, callback: (err: Error | null, repl: REPLServer) => void): void {
    callback(null, this);
  }
}

function defaultEval(
  code: string,
  context: any,
  _filename: string,
  callback: (err: Error | null, result?: any) => void
): void {
  try {
    // Remove trailing newline and wrapping parens from REPL
    let trimmed = code.trim();
    if (trimmed.startsWith('(') && trimmed.endsWith('\n)')) {
      trimmed = trimmed.slice(1, -2);
    }
    // Use Function constructor as a minimal eval alternative
    const fn = new Function('context', `with(context){return(${trimmed})}`);
    const result = fn(context);
    callback(null, result);
  } catch (e: any) {
    if (e instanceof SyntaxError && /unexpected end of input/i.test(e.message)) {
      callback(new Recoverable(e));
    } else {
      callback(e);
    }
  }
}

export function start(options?: string | ReplOptions): REPLServer {
  const opts: ReplOptions = typeof options === 'string' ? { prompt: options } : (options ?? {});
  const server = new REPLServer(opts);
  server.displayPrompt();
  return server;
}

export const builtinModules: string[] = [];

const repl = {
  REPLServer, start, Recoverable, REPL_MODE_SLOPPY, REPL_MODE_STRICT, builtinModules, __atua,
};
export default repl;
