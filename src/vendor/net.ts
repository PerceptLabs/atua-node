/**
 * Node.js net module facade.
 *
 * Client-side TCP sockets backed by atua-net via the net-bridge.
 * Server-side listen() requires a host preview adapter.
 */
export const __atua = true;

import { EventEmitter } from 'events';
import { AtuaNetBridge, type StreamHandle } from '../bridges/net-bridge.js';

const bridge = new AtuaNetBridge();

export class Socket extends EventEmitter {
  private _handle: StreamHandle | null = null;
  private _connecting = false;
  private _destroyed = false;

  readable = true;
  writable = true;
  remoteAddress?: string;
  remotePort?: number;
  localAddress = '0.0.0.0';
  localPort = 0;

  connect(options: { host?: string; port: number; } | number, hostOrCb?: string | Function, cb?: Function): this {
    let port: number;
    let host: string;
    let callback: Function | undefined;

    if (typeof options === 'number') {
      port = options;
      host = typeof hostOrCb === 'string' ? hostOrCb : 'localhost';
      callback = typeof hostOrCb === 'function' ? hostOrCb : cb;
    } else {
      port = options.port;
      host = options.host ?? 'localhost';
      callback = typeof hostOrCb === 'function' ? hostOrCb : cb;
    }

    if (callback) this.once('connect', callback as any);

    this._connecting = true;
    this.remoteAddress = host;
    this.remotePort = port;

    bridge.connect(host, port).then(handle => {
      this._handle = handle;
      this._connecting = false;
      this.emit('connect');
      this.emit('ready');
    }).catch(err => {
      this._connecting = false;
      this.emit('error', err);
    });

    return this;
  }

  write(data: string | Uint8Array, encoding?: string | Function, callback?: Function): boolean {
    const cb = typeof encoding === 'function' ? encoding : callback;
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    if (!this._handle || this._destroyed) {
      const err = new Error('This socket has been ended by the other party');
      if (cb) queueMicrotask(() => (cb as Function)(err));
      return false;
    }

    bridge.send(this._handle, bytes).then(() => {
      if (cb) (cb as Function)();
    }).catch(err => {
      if (cb) (cb as Function)(err);
      else this.emit('error', err);
    });

    return true;
  }

  end(data?: string | Uint8Array, encoding?: string, callback?: Function): this {
    if (data) this.write(data, encoding, callback);
    if (this._handle) {
      bridge.close(this._handle);
      this._handle = null;
    }
    this.writable = false;
    queueMicrotask(() => this.emit('end'));
    return this;
  }

  destroy(err?: Error): this {
    if (this._destroyed) return this;
    this._destroyed = true;
    if (this._handle) {
      bridge.close(this._handle);
      this._handle = null;
    }
    this.readable = false;
    this.writable = false;
    if (err) this.emit('error', err);
    this.emit('close', !!err);
    return this;
  }

  setNoDelay(_noDelay?: boolean): this { return this; }
  setKeepAlive(_enable?: boolean, _delay?: number): this { return this; }
  setTimeout(timeout: number, callback?: Function): this {
    if (callback) this.once('timeout', callback as any);
    if (timeout > 0) {
      globalThis.setTimeout(() => this.emit('timeout'), timeout);
    }
    return this;
  }
  ref(): this { return this; }
  unref(): this { return this; }
  get connecting() { return this._connecting; }
  get destroyed() { return this._destroyed; }
}

export class Server extends EventEmitter {
  listening = false;

  listen(_port?: number, _host?: string, _backlog?: number, callback?: Function): this {
    if (typeof _port === 'function') { callback = _port; }
    else if (typeof _host === 'function') { callback = _host; }
    else if (typeof _backlog === 'function') { callback = _backlog; }

    // Server listening requires a host preview adapter
    const err = new Error(
      'net.Server.listen() requires a host preview adapter. ' +
      'In Atua, server sockets are provided by the host environment, not WASIX.'
    );
    if (callback) queueMicrotask(() => (callback as Function)(err));
    else queueMicrotask(() => this.emit('error', err));
    return this;
  }

  close(callback?: Function): this {
    this.listening = false;
    if (callback) queueMicrotask(() => (callback as Function)());
    this.emit('close');
    return this;
  }

  address() { return null; }
}

export function createConnection(options: any, callback?: Function): Socket {
  const socket = new Socket();
  return socket.connect(options, callback);
}

export function connect(options: any, callback?: Function): Socket {
  return createConnection(options, callback);
}

export function createServer(_options?: any, _connectionListener?: Function): Server {
  return new Server();
}

export function isIP(input: string): number {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(input)) return 4;
  if (input.includes(':')) return 6;
  return 0;
}

export function isIPv4(input: string): boolean { return isIP(input) === 4; }
export function isIPv6(input: string): boolean { return isIP(input) === 6; }

// ── BlockList ───────────────────────────────────────────────

export class BlockList {
  private _rules: Array<{ type: 'address' | 'range' | 'subnet'; value: string }> = [];
  private _addresses: Set<string> = new Set();
  private _ranges: Array<{ start: string; end: string; family: string }> = [];
  private _subnets: Array<{ network: string; prefix: number; family: string }> = [];

  get rules(): string[] {
    return this._rules.map(r => r.value);
  }

  addAddress(address: string, type?: string): void {
    this._addresses.add(address);
    this._rules.push({ type: 'address', value: `Addr: ${type ?? 'ipv4'} ${address}` });
  }

  addRange(start: string, end: string, type?: string): void {
    const family = type ?? 'ipv4';
    this._ranges.push({ start, end, family });
    this._rules.push({ type: 'range', value: `Range: ${family} ${start}-${end}` });
  }

  addSubnet(net: string, prefix: number, type?: string): void {
    const family = type ?? 'ipv4';
    this._subnets.push({ network: net, prefix, family });
    this._rules.push({ type: 'subnet', value: `Subnet: ${family} ${net}/${prefix}` });
  }

  check(address: string, _type?: string): boolean {
    if (this._addresses.has(address)) return true;

    // Check ranges (simple string comparison for IPv4)
    for (const range of this._ranges) {
      if (address >= range.start && address <= range.end) return true;
    }

    // Check subnets (IPv4 only for now)
    for (const subnet of this._subnets) {
      if (this._matchSubnet(address, subnet.network, subnet.prefix)) return true;
    }

    return false;
  }

  private _matchSubnet(address: string, network: string, prefix: number): boolean {
    const addrParts = address.split('.').map(Number);
    const netParts = network.split('.').map(Number);
    if (addrParts.length !== 4 || netParts.length !== 4) return false;

    const addrNum = (addrParts[0] << 24) | (addrParts[1] << 16) | (addrParts[2] << 8) | addrParts[3];
    const netNum = (netParts[0] << 24) | (netParts[1] << 16) | (netParts[2] << 8) | netParts[3];
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix));

    return (addrNum & mask) === (netNum & mask);
  }
}

// ── SocketAddress ───────────────────────────────────────────

export class SocketAddress {
  address: string;
  port: number;
  family: string;
  flowlabel: number;

  constructor(options?: { address?: string; port?: number; family?: string; flowlabel?: number }) {
    this.address = options?.address ?? '127.0.0.1';
    this.port = options?.port ?? 0;
    this.family = options?.family ?? 'ipv4';
    this.flowlabel = options?.flowlabel ?? 0;
  }
}

// ── Auto-select family helpers ──────────────────────────────

let _autoSelectFamily = true;
let _autoSelectFamilyAttemptTimeout = 250;

export function getDefaultAutoSelectFamily(): boolean {
  return _autoSelectFamily;
}

export function setDefaultAutoSelectFamily(value: boolean): void {
  _autoSelectFamily = !!value;
}

export function getDefaultAutoSelectFamilyAttemptTimeout(): number {
  return _autoSelectFamilyAttemptTimeout;
}

export function setDefaultAutoSelectFamilyAttemptTimeout(value: number): void {
  _autoSelectFamilyAttemptTimeout = value;
}

export default {
  Socket, Server, createConnection, connect, createServer, isIP, isIPv4, isIPv6,
  BlockList, SocketAddress,
  getDefaultAutoSelectFamily, setDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout,
};
