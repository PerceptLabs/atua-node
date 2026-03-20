/**
 * Node.js tls module facade.
 *
 * Client TLS connections backed by atua-net (which uses rustls).
 * Server TLS requires a host preview adapter.
 */

import { EventEmitter } from 'events';
import { Socket } from './net.js';
import { AtuaNetBridge } from '../bridges/net-bridge.js';

const bridge = new AtuaNetBridge();

export class TLSSocket extends EventEmitter {
  private _socket: Socket;
  authorized = true;
  encrypted = true;
  remoteAddress?: string;
  remotePort?: number;

  constructor(socket?: Socket, _options?: any) {
    super();
    this._socket = socket ?? new Socket();
  }

  connect(options: { host?: string; port: number; servername?: string }, callback?: Function): this {
    const host = options.host ?? 'localhost';
    const port = options.port;

    if (callback) this.once('secureConnect', callback as any);

    bridge.connect(host, port, true).then(handle => {
      this.remoteAddress = host;
      this.remotePort = port;
      this.emit('connect');
      this.emit('secureConnect');
    }).catch(err => {
      this.emit('error', err);
    });

    return this;
  }

  write(data: string | Uint8Array, encoding?: string | Function, callback?: Function): boolean {
    return this._socket.write(data, encoding, callback);
  }

  end(data?: string | Uint8Array): this {
    this._socket.end(data);
    return this;
  }

  destroy(err?: Error): this {
    this._socket.destroy(err);
    return this;
  }

  getPeerCertificate(): Record<string, unknown> {
    return {};
  }

  getCipher(): { name: string; standardName: string; version: string } {
    return { name: 'TLS_AES_256_GCM_SHA384', standardName: 'TLS_AES_256_GCM_SHA384', version: 'TLSv1.3' };
  }

  getProtocol(): string {
    return 'TLSv1.3';
  }
}

export function connect(options: any, callback?: Function): TLSSocket {
  const socket = new TLSSocket();
  return socket.connect(options, callback);
}

export function createSecureContext(_options?: any): { context: string } {
  return { context: 'atua-tls' };
}

export function createServer(_options?: any, _listener?: Function): any {
  throw new Error(
    'tls.createServer() requires a host preview adapter. ' +
    'In Atua, TLS server sockets are provided by the host environment.'
  );
}

export const DEFAULT_MIN_VERSION = 'TLSv1.2';
export const DEFAULT_MAX_VERSION = 'TLSv1.3';

export default { TLSSocket, connect, createSecureContext, createServer, DEFAULT_MIN_VERSION, DEFAULT_MAX_VERSION };
