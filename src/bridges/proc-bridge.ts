/**
 * ProcBridge — Maps WASIX process operations to Worker isolation.
 *
 * - proc_exec → new Worker with fresh WASIX instance
 * - proc_fork → Wasmer memory snapshot + new Worker
 * - IPC via MessageChannel
 */

export interface ProcessHandle {
  pid: number;
  /** Send data to the child process */
  send(data: unknown): void;
  /** Register a handler for messages from the child */
  onMessage(handler: (data: unknown) => void): void;
  /** Wait for the process to exit */
  wait(): Promise<ProcessExitResult>;
  /** Kill the process */
  kill(): void;
}

export interface ProcessExitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  /** WASM module to execute */
  wasmModule?: WebAssembly.Module;
  /** Command-line arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Filesystem mounts */
  mounts?: Record<string, unknown>;
}

export class ProcBridge {
  private _nextPid = 1;
  private _processes = new Map<number, ProcessEntry>();

  /** proc_exec — Spawn a new process (Worker with fresh WASIX instance) */
  exec(options: ExecOptions): ProcessHandle {
    const pid = this._nextPid++;
    const { port1, port2 } = new MessageChannel();

    let messageHandler: ((data: unknown) => void) | null = null;
    let resolveWait: ((result: ProcessExitResult) => void) | null = null;
    const waitPromise = new Promise<ProcessExitResult>((resolve) => {
      resolveWait = resolve;
    });

    // Listen for messages from the child
    port1.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'exit') {
        resolveWait?.({
          exitCode: msg.exitCode ?? 0,
          stdout: msg.stdout ?? '',
          stderr: msg.stderr ?? '',
        });
        this._cleanup(pid);
      } else if (msg?.type === 'message') {
        messageHandler?.(msg.data);
      }
    };

    const entry: ProcessEntry = {
      pid,
      port: port1,
      childPort: port2,
      worker: null,
      killed: false,
      options,
    };
    this._processes.set(pid, entry);

    // Simulate process startup by posting an init message
    // In real implementation, this would create a Worker and post the WASM module
    port2.onmessage = () => {}; // Keep port alive

    const handle: ProcessHandle = {
      pid,
      send(data: unknown): void {
        port1.postMessage({ type: 'message', data });
      },
      onMessage(handler: (data: unknown) => void): void {
        messageHandler = handler;
      },
      wait(): Promise<ProcessExitResult> {
        return waitPromise;
      },
      kill(): void {
        entry.killed = true;
        port1.postMessage({ type: 'kill' });
        resolveWait?.({ exitCode: -1, stdout: '', stderr: 'killed' });
        entry.port.close();
        entry.childPort.close();
      },
    };

    return handle;
  }

  /** proc_fork — Fork current process (memory snapshot + new Worker) */
  fork(options?: ExecOptions): ProcessHandle {
    // Fork is implemented as exec with the same module
    // In a real implementation, this would snapshot Wasmer memory
    return this.exec(options ?? {});
  }

  /** Simulate a child process completing (for testing) */
  _simulateExit(pid: number, result: ProcessExitResult): void {
    const entry = this._processes.get(pid);
    if (!entry) return;

    entry.childPort.postMessage({
      type: 'exit',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  /** Simulate a message from child to parent (for testing) */
  _simulateMessage(pid: number, data: unknown): void {
    const entry = this._processes.get(pid);
    if (!entry) return;

    entry.childPort.postMessage({ type: 'message', data });
  }

  /** Get active process count */
  get activeProcessCount(): number {
    return this._processes.size;
  }

  /** Check if a process is alive */
  isAlive(pid: number): boolean {
    const entry = this._processes.get(pid);
    return entry !== undefined && !entry.killed;
  }

  private _cleanup(pid: number): void {
    const entry = this._processes.get(pid);
    if (entry) {
      entry.port.close();
      entry.childPort.close();
      this._processes.delete(pid);
    }
  }
}

interface ProcessEntry {
  pid: number;
  port: MessagePort;
  childPort: MessagePort;
  worker: Worker | null;
  killed: boolean;
  options: ExecOptions;
}
