/**
 * Node.js dgram module — browser-compatible implementation.
 *
 * Browser ceiling: UDP sockets are not available in browser environments.
 * Socket loads without error but bind/send/close throw ERR_NOT_SUPPORTED.
 */
import { EventEmitter } from 'events';

export const __atua = true;

function notSupported(method: string): never {
  throw Object.assign(
    new Error(`dgram.Socket.${method}() is not supported in browser. UDP sockets require raw network access unavailable in browser environments.`),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

export class Socket extends EventEmitter {
  readonly type: string;
  private _bound = false;

  constructor(type: string | { type: string; reuseAddr?: boolean; ipv6Only?: boolean; recvBufferSize?: number; sendBufferSize?: number; signal?: AbortSignal }, _listener?: (msg: Buffer, rinfo: any) => void) {
    super();
    this.type = typeof type === 'string' ? type : type.type;
    if (_listener) this.on('message', _listener);
  }

  addMembership(_multicastAddress: string, _multicastInterface?: string): void {
    notSupported('addMembership');
  }

  addSourceSpecificMembership(_sourceAddress: string, _groupAddress: string, _multicastInterface?: string): void {
    notSupported('addSourceSpecificMembership');
  }

  address(): { address: string; family: string; port: number } {
    if (!this._bound) {
      throw Object.assign(new Error('Not bound'), { code: 'ERR_SOCKET_DGRAM_NOT_RUNNING' });
    }
    return { address: '0.0.0.0', family: 'IPv4', port: 0 };
  }

  bind(_port?: number | { port?: number; address?: string; exclusive?: boolean; fd?: number }, _address?: string | (() => void), _callback?: () => void): this {
    notSupported('bind');
  }

  close(_callback?: () => void): this {
    this.emit('close');
    if (_callback) queueMicrotask(_callback);
    return this;
  }

  connect(_port: number, _address?: string, _callback?: () => void): void {
    notSupported('connect');
  }

  disconnect(): void {
    notSupported('disconnect');
  }

  dropMembership(_multicastAddress: string, _multicastInterface?: string): void {
    notSupported('dropMembership');
  }

  dropSourceSpecificMembership(_sourceAddress: string, _groupAddress: string, _multicastInterface?: string): void {
    notSupported('dropSourceSpecificMembership');
  }

  getRecvBufferSize(): number {
    notSupported('getRecvBufferSize');
  }

  getSendBufferSize(): number {
    notSupported('getSendBufferSize');
  }

  getSendQueueCount(): number {
    return 0;
  }

  getSendQueueSize(): number {
    return 0;
  }

  ref(): this {
    return this;
  }

  remoteAddress(): { address: string; family: string; port: number } {
    notSupported('remoteAddress');
  }

  send(msg: any, _offsetOrPort?: number, _lengthOrAddress?: number | string, _portOrCallback?: number | (() => void), _address?: string | (() => void), _callback?: () => void): void {
    void msg;
    notSupported('send');
  }

  setBroadcast(_flag: boolean): void {
    notSupported('setBroadcast');
  }

  setMulticastInterface(_multicastInterface: string): void {
    notSupported('setMulticastInterface');
  }

  setMulticastLoopback(_flag: boolean): boolean {
    notSupported('setMulticastLoopback');
  }

  setMulticastTTL(_ttl: number): number {
    notSupported('setMulticastTTL');
  }

  setRecvBufferSize(_size: number): void {
    notSupported('setRecvBufferSize');
  }

  setSendBufferSize(_size: number): void {
    notSupported('setSendBufferSize');
  }

  setTTL(_ttl: number): number {
    notSupported('setTTL');
  }

  unref(): this {
    return this;
  }
}

export function createSocket(type: string | { type: string; reuseAddr?: boolean }, listener?: (msg: Buffer, rinfo: any) => void): Socket {
  return new Socket(type, listener);
}

const dgram = { Socket, createSocket, __atua };
export default dgram;
