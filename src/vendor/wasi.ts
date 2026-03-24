/**
 * Node.js wasi module — browser-compatible implementation.
 *
 * Provides the WASI class. Delegates to @wasmer/sdk when available.
 * Throws a clear error on start() if no WASI runtime is present.
 */
export const __atua = true;

export interface WASIOptions {
  version?: 'preview1' | 'unstable';
  args?: string[];
  env?: Record<string, string>;
  preopens?: Record<string, string>;
  returnOnExit?: boolean;
  stdin?: number;
  stdout?: number;
  stderr?: number;
}

export class WASI {
  private _args: string[];
  private _env: Record<string, string>;
  private _preopens: Record<string, string>;
  private _returnOnExit: boolean;
  private _version: string;
  private _instance: WebAssembly.Instance | null = null;
  private _started = false;

  constructor(options: WASIOptions = {}) {
    this._version = options.version ?? 'preview1';
    this._args = options.args ?? [];
    this._env = options.env ?? {};
    this._preopens = options.preopens ?? {};
    this._returnOnExit = options.returnOnExit ?? false;
  }

  start(instance: WebAssembly.Instance): number | void {
    if (this._started) {
      throw new Error('WASI instance has already started');
    }
    this._started = true;
    this._instance = instance;

    // Try to find _start export
    const start = instance.exports._start;
    if (typeof start !== 'function') {
      throw new Error('Instance does not export a _start function');
    }

    // Check if @wasmer/sdk or similar WASIX runtime is globally available
    const wasmerInit = (globalThis as any).__wasmer_wasi_init;
    if (wasmerInit) {
      return wasmerInit(instance, {
        args: this._args,
        env: this._env,
        preopens: this._preopens,
      });
    }

    // Without a proper WASI implementation, provide basic WASI imports
    // that will be used by the import object
    try {
      const result = (start as Function)();
      if (this._returnOnExit) return typeof result === 'number' ? result : 0;
    } catch (err: any) {
      if (err instanceof WebAssembly.RuntimeError) {
        throw new Error(
          `WASI execution failed: ${err.message}. ` +
          `A full WASI runtime (@wasmer/sdk) is required for complex WASI modules in the browser.`
        );
      }
      throw err;
    }
  }

  initialize(instance: WebAssembly.Instance): void {
    if (this._started) {
      throw new Error('WASI instance has already started');
    }
    this._instance = instance;

    const init = instance.exports._initialize;
    if (typeof init === 'function') {
      (init as Function)();
    }
  }

  getImportObject(): Record<string, Record<string, WebAssembly.ImportValue>> {
    const self = this;
    const noopFd = () => 0;
    return {
      wasi_snapshot_preview1: {
        args_get: noopFd,
        args_sizes_get: noopFd,
        environ_get: noopFd,
        environ_sizes_get: noopFd,
        clock_res_get: noopFd,
        clock_time_get: (_id: number, _precision: bigint, out: number) => {
          if (self._instance) {
            const mem = self._instance.exports.memory as WebAssembly.Memory;
            const view = new DataView(mem.buffer);
            const now = BigInt(Math.floor(Date.now() * 1e6));
            view.setBigUint64(out, now, true);
          }
          return 0;
        },
        fd_advise: noopFd,
        fd_allocate: noopFd,
        fd_close: noopFd,
        fd_datasync: noopFd,
        fd_fdstat_get: noopFd,
        fd_fdstat_set_flags: noopFd,
        fd_fdstat_set_rights: noopFd,
        fd_filestat_get: noopFd,
        fd_filestat_set_size: noopFd,
        fd_filestat_set_times: noopFd,
        fd_pread: noopFd,
        fd_prestat_get: () => 8, // EBADF
        fd_prestat_dir_name: noopFd,
        fd_pwrite: noopFd,
        fd_read: noopFd,
        fd_readdir: noopFd,
        fd_renumber: noopFd,
        fd_seek: noopFd,
        fd_sync: noopFd,
        fd_tell: noopFd,
        fd_write: (_fd: number, _iovs: number, _iovsLen: number, _nwritten: number) => {
          // Minimal fd_write for stdout/stderr
          return 0;
        },
        path_create_directory: noopFd,
        path_filestat_get: noopFd,
        path_filestat_set_times: noopFd,
        path_link: noopFd,
        path_open: noopFd,
        path_readlink: noopFd,
        path_remove_directory: noopFd,
        path_rename: noopFd,
        path_symlink: noopFd,
        path_unlink_file: noopFd,
        poll_oneoff: noopFd,
        proc_exit: (code: number) => {
          if (self._returnOnExit) return code;
          throw new Error(`WASI process exited with code ${code}`);
        },
        proc_raise: noopFd,
        sched_yield: noopFd,
        random_get: (buf: number, bufLen: number) => {
          if (self._instance) {
            const mem = self._instance.exports.memory as WebAssembly.Memory;
            const bytes = new Uint8Array(mem.buffer, buf, bufLen);
            crypto.getRandomValues(bytes);
          }
          return 0;
        },
        sock_accept: () => 58, // ENOTSUP
        sock_recv: () => 58,
        sock_send: () => 58,
        sock_shutdown: () => 58,
      },
    };
  }

  get wasiImport(): Record<string, WebAssembly.ImportValue> {
    return this.getImportObject().wasi_snapshot_preview1;
  }
}

const wasi = { WASI, __atua };
export default wasi;
