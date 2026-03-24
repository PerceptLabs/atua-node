/**
 * Node.js process object.
 *
 * Provides process.versions, process.platform, process.arch,
 * process.hrtime, process.nextTick, process.env, process.cwd(),
 * process.stdout/stderr/stdin, and signal handling.
 */

import { EventLoop } from '../libuv/phase-shim.js';

type SignalHandler = (...args: unknown[]) => void;

const _exitHandlers: Array<(code: number) => void> = [];
const _signalHandlers = new Map<string, SignalHandler[]>();
let _cwd = '/';
let _exitCode = 0;
const _env: Record<string, string> = {};
const _eventLoop = new EventLoop();

class ProcessStdout {
  write(data: string | Uint8Array): boolean {
    if (typeof data === 'string') {
      // eslint-disable-next-line no-console
      console.log(data.endsWith('\n') ? data.slice(0, -1) : data);
    }
    return true;
  }
  get writable() { return true; }
  get isTTY() { return false; }
}

class ProcessStderr {
  write(data: string | Uint8Array): boolean {
    if (typeof data === 'string') {
      // eslint-disable-next-line no-console
      console.error(data.endsWith('\n') ? data.slice(0, -1) : data);
    }
    return true;
  }
  get writable() { return true; }
  get isTTY() { return false; }
}

class ProcessStdin {
  get readable() { return false; }
  get isTTY() { return false; }
  resume() { return this; }
  pause() { return this; }
  on(_event: string, _handler: Function) { return this; }
}

const _hrtimeBase = typeof performance !== 'undefined' ? performance.now() : Date.now();

function hrtime(previousTimestamp?: [number, number]): [number, number] {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = (now - _hrtimeBase) * 1e6; // to nanoseconds
  const seconds = Math.floor(elapsed / 1e9);
  const nanoseconds = Math.floor(elapsed % 1e9);

  if (previousTimestamp) {
    let diffSec = seconds - previousTimestamp[0];
    let diffNs = nanoseconds - previousTimestamp[1];
    if (diffNs < 0) {
      diffSec -= 1;
      diffNs += 1e9;
    }
    return [diffSec, diffNs];
  }

  return [seconds, nanoseconds];
}

hrtime.bigint = function hrtimeBigint(): bigint {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return BigInt(Math.floor((now - _hrtimeBase) * 1e6));
};

export const process = {
  // Versioning
  versions: {
    node: '22.0.0',
    v8: '12.4.254.21',
    uv: '1.48.0',
    zlib: '1.3.1',
    openssl: '3.3.0',
    modules: '127',
    napi: '9',
    llhttp: '9.2.1',
    ares: '1.28.1',
    icu: '75.1',
  } as Record<string, string>,
  version: 'v22.0.0',

  // Platform info — report as Linux x64 for compatibility
  platform: 'linux' as string,
  arch: 'x64' as string,
  release: {
    name: 'node',
    lts: 'Jod',
    sourceUrl: '',
    headersUrl: '',
  },

  // Process identity
  pid: 1,
  ppid: 0,
  title: 'node',
  argv: ['node'] as string[],
  argv0: 'node',
  execArgv: [] as string[],
  execPath: '/usr/local/bin/node',

  // Environment
  env: _env,

  // Working directory
  cwd: () => _cwd,
  chdir: (dir: string) => { _cwd = dir; },

  // High-resolution time
  hrtime,

  // Event loop integration
  nextTick: (fn: () => void, ...args: unknown[]) => {
    if (args.length > 0) {
      _eventLoop.nextTick(() => fn(...args as []));
    } else {
      _eventLoop.nextTick(fn);
    }
  },

  // I/O streams
  stdout: new ProcessStdout() as any,
  stderr: new ProcessStderr() as any,
  stdin: new ProcessStdin() as any,

  // Exit handling
  get exitCode() { return _exitCode; },
  set exitCode(code: number) { _exitCode = code; },
  exit: (code?: number) => {
    const exitCode = code ?? _exitCode;
    for (const handler of _exitHandlers) {
      handler(exitCode);
    }
  },

  // Signal handling (mapped to browser events)
  on: (event: string, handler: SignalHandler) => {
    if (event === 'exit') {
      _exitHandlers.push(handler as (code: number) => void);
      return process;
    }

    if (event === 'SIGTERM' || event === 'SIGINT') {
      if (typeof addEventListener !== 'undefined') {
        addEventListener('beforeunload', () => handler());
      }
    } else if (event === 'SIGHUP') {
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') handler();
        });
      }
    }

    const handlers = _signalHandlers.get(event) ?? [];
    handlers.push(handler);
    _signalHandlers.set(event, handlers);
    return process;
  },

  off: (event: string, handler: SignalHandler) => {
    const handlers = _signalHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
    return process;
  },

  emit: (event: string, ...args: unknown[]) => {
    const handlers = _signalHandlers.get(event);
    if (handlers) {
      for (const h of handlers) h(...args);
      return true;
    }
    return false;
  },

  kill: (pid: number, signal?: string | number) => {
    // Signal delivery in browser context — fire registered handlers
    const sigName = typeof signal === 'number'
      ? Object.entries({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }).find(([, v]) => v === signal)?.[0] ?? 'SIGTERM'
      : signal ?? 'SIGTERM';

    if (pid === process.pid || pid === 0) {
      process.emit(sigName);
    }
  },

  // Resource usage
  memoryUsage: () => ({
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    arrayBuffers: 0,
  }),

  // CPU usage
  cpuUsage: (previousValue?: { user: number; system: number }) => {
    const now = { user: 0, system: 0 };
    if (previousValue) {
      return { user: now.user - previousValue.user, system: now.system - previousValue.system };
    }
    return now;
  },

  // Misc
  uptime: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000,
  features: { inspector: false, debug: false, uv: true, ipv6: true, tls_alpn: true, tls_sni: true, tls_ocsp: true, tls: true },
  config: { variables: {} },
  dlopen: (_module: unknown, _filename: string) => {
    throw new Error('process.dlopen: use the addon registry (Phase 7)');
  },

  // Uncaught exception
  _exiting: false,

  // EventLoop access (for internal use)
  _eventLoop,
};

export default process;
