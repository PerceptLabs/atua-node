/**
 * Node.js child_process module facade.
 *
 * Wire to ProcBridge for process spawning.
 * fork() → Worker + MessageChannel IPC
 * exec() → limited shell emulation
 * spawn() → Worker with stdin/stdout/stderr
 */

import { EventEmitter } from 'events';
import { ProcBridge } from '../bridges/proc-bridge.js';

const _bridge = new ProcBridge();

export class ChildProcess extends EventEmitter {
  pid: number;
  connected = true;
  killed = false;
  exitCode: number | null = null;
  signalCode: string | null = null;
  stdin: any = null;
  stdout: any = null;
  stderr: any = null;

  private _handle;

  constructor(handle: ReturnType<ProcBridge['exec']>) {
    super();
    this._handle = handle;
    this.pid = handle.pid;

    handle.onMessage((data) => {
      this.emit('message', data);
    });

    handle.wait().then((result) => {
      this.exitCode = result.exitCode;
      this.connected = false;
      this.emit('exit', result.exitCode, null);
      this.emit('close', result.exitCode, null);
    });
  }

  send(message: unknown, _sendHandle?: unknown, _options?: unknown, callback?: Function): boolean {
    this._handle.send(message);
    if (callback) queueMicrotask(() => callback(null));
    return true;
  }

  kill(signal?: string | number): boolean {
    this._handle.kill();
    this.killed = true;
    this.signalCode = typeof signal === 'string' ? signal : 'SIGTERM';
    return true;
  }

  disconnect(): void {
    this.connected = false;
    this.emit('disconnect');
  }

  ref(): this { return this; }
  unref(): this { return this; }
}

export function fork(modulePath: string, args?: string[], options?: any): ChildProcess {
  const handle = _bridge.exec({
    args: [modulePath, ...(args ?? [])],
    env: options?.env,
  });
  return new ChildProcess(handle);
}

export function spawn(command: string, args?: string[], options?: any): ChildProcess {
  const handle = _bridge.exec({
    args: [command, ...(args ?? [])],
    env: options?.env,
  });
  return new ChildProcess(handle);
}

export function exec(command: string, options?: any, callback?: Function): ChildProcess {
  if (typeof options === 'function') { callback = options; options = {}; }

  const handle = _bridge.exec({ args: ['/bin/sh', '-c', command] });
  const child = new ChildProcess(handle);

  if (callback) {
    handle.wait().then(result => {
      (callback as Function)(
        result.exitCode !== 0 ? new Error(`Command failed: ${command}`) : null,
        result.stdout,
        result.stderr
      );
    });
  }

  return child;
}

export function execSync(command: string, _options?: any): string {
  throw new Error('execSync is not supported in the browser environment. Use exec() with callbacks.');
}

export function execFile(file: string, args?: string[], options?: any, callback?: Function): ChildProcess {
  if (typeof args === 'function') { callback = args; args = []; }
  if (typeof options === 'function') { callback = options; options = {}; }
  return spawn(file, args, options);
}

export default { fork, spawn, exec, execSync, execFile, ChildProcess };
