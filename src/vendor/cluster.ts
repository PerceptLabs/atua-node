/**
 * Node.js cluster module facade.
 *
 * Maps cluster.fork() to Workers via proc-bridge.
 * Round-robin distribution via MessageChannel.
 */
export const __atua = true;

import { EventEmitter } from 'events';
import { ProcBridge } from '../bridges/proc-bridge.js';

const _bridge = new ProcBridge();

class ClusterWorker extends EventEmitter {
  id: number;
  process: { pid: number; kill: () => void };
  isDead = false;
  exitedAfterDisconnect = false;
  private _handle;

  constructor(id: number, handle: ReturnType<ProcBridge['exec']>) {
    super();
    this.id = id;
    this._handle = handle;
    this.process = {
      pid: handle.pid,
      kill: () => handle.kill(),
    };

    handle.onMessage((data) => this.emit('message', data));
    handle.wait().then((result) => {
      this.isDead = true;
      this.emit('exit', result.exitCode, null);
      this.emit('disconnect');
      cluster.emit('exit', this, result.exitCode, null);
    });
  }

  send(message: unknown, _sendHandle?: unknown, _options?: unknown, callback?: Function): boolean {
    this._handle.send(message);
    if (callback) queueMicrotask(() => callback(null));
    return true;
  }

  kill(signal?: string): void {
    this._handle.kill();
    this.isDead = true;
  }

  disconnect(): void {
    this.exitedAfterDisconnect = true;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return !this.isDead;
  }
}

let _nextWorkerId = 1;
const _workers = new Map<number, ClusterWorker>();

class Cluster extends EventEmitter {
  isPrimary = true;
  isMaster = true; // Alias
  isWorker = false;
  workers = _workers;
  schedulingPolicy = 2; // SCHED_RR (round-robin)

  // Settings
  settings: {
    exec?: string;
    args?: string[];
    silent?: boolean;
  } = {};

  setupPrimary(settings?: any): void {
    if (settings) Object.assign(this.settings, settings);
    this.setupMaster(settings);
  }

  setupMaster(settings?: any): void {
    if (settings) Object.assign(this.settings, settings);
  }

  fork(env?: Record<string, string>): ClusterWorker {
    const id = _nextWorkerId++;
    const handle = _bridge.exec({
      args: [this.settings.exec ?? process?.argv?.[1] ?? 'worker'],
      env,
    });

    const worker = new ClusterWorker(id, handle);
    _workers.set(id, worker);

    this.emit('fork', worker);
    queueMicrotask(() => {
      this.emit('online', worker);
    });

    return worker;
  }

  disconnect(callback?: Function): void {
    for (const worker of _workers.values()) {
      worker.disconnect();
    }
    if (callback) queueMicrotask(() => callback());
  }
}

export const cluster = new Cluster();
export const isPrimary = cluster.isPrimary;
export const isMaster = cluster.isMaster;
export const isWorker = cluster.isWorker;
export const workers = cluster.workers;
export const fork = cluster.fork.bind(cluster);
export const setupPrimary = cluster.setupPrimary.bind(cluster);
export const setupMaster = cluster.setupMaster.bind(cluster);
export const disconnect = cluster.disconnect.bind(cluster);
export const schedulingPolicy = cluster.schedulingPolicy;
export const settings = cluster.settings;

// EventEmitter methods on cluster
export const on = cluster.on.bind(cluster);
export const once = cluster.once.bind(cluster);
export const off = cluster.off.bind(cluster);
export const emit = cluster.emit.bind(cluster);

export default cluster;
