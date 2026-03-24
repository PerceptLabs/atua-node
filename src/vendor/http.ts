/**
 * Node.js http module facade.
 *
 * Client requests route through atua-net via net-bridge.
 * Server.listen() requires a host preview adapter.
 * HTTP parsing uses llhttp via binding-http-parser.
 */
export const __atua = true;

import { EventEmitter } from 'events';
import { Socket, Server as NetServer } from './net.js';

export const METHODS = ['ACL', 'BIND', 'CHECKOUT', 'CONNECT', 'COPY', 'DELETE', 'GET', 'HEAD', 'LINK', 'LOCK', 'M-SEARCH', 'MERGE', 'MKACTIVITY', 'MKCALENDAR', 'MKCOL', 'MOVE', 'NOTIFY', 'OPTIONS', 'PATCH', 'POST', 'PRI', 'PROPFIND', 'PROPPATCH', 'PURGE', 'PUT', 'REBIND', 'REPORT', 'SEARCH', 'SOURCE', 'SUBSCRIBE', 'TRACE', 'UNBIND', 'UNLINK', 'UNLOCK', 'UNSUBSCRIBE'];

export const STATUS_CODES: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created',
  204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently',
  302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect',
  308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized',
  403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  408: 'Request Timeout', 409: 'Conflict', 410: 'Gone',
  413: 'Payload Too Large', 415: 'Unsupported Media Type',
  429: 'Too Many Requests', 500: 'Internal Server Error',
  501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export class IncomingMessage extends EventEmitter {
  httpVersion = '1.1';
  httpVersionMajor = 1;
  httpVersionMinor = 1;
  headers: Record<string, string | string[]> = {};
  rawHeaders: string[] = [];
  method?: string;
  url?: string;
  statusCode?: number;
  statusMessage?: string;
  complete = false;
  readable = true;

  private _body: Uint8Array[] = [];

  _pushData(chunk: Uint8Array): void {
    this._body.push(chunk);
    this.emit('data', chunk);
  }

  _end(): void {
    this.complete = true;
    this.readable = false;
    this.emit('end');
  }
}

export class ServerResponse extends EventEmitter {
  statusCode = 200;
  statusMessage = 'OK';
  headersSent = false;
  finished = false;
  private _headers = new Map<string, string | string[]>();

  setHeader(name: string, value: string | string[]): this {
    this._headers.set(name.toLowerCase(), value);
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this._headers.get(name.toLowerCase());
  }

  removeHeader(name: string): void {
    this._headers.delete(name.toLowerCase());
  }

  getHeaderNames(): string[] {
    return Array.from(this._headers.keys());
  }

  hasHeader(name: string): boolean {
    return this._headers.has(name.toLowerCase());
  }

  writeHead(statusCode: number, statusMessage?: string | Record<string, string>, headers?: Record<string, string>): this {
    this.statusCode = statusCode;
    if (typeof statusMessage === 'string') {
      this.statusMessage = statusMessage;
    } else if (typeof statusMessage === 'object') {
      headers = statusMessage;
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        this.setHeader(k, v);
      }
    }
    this.headersSent = true;
    return this;
  }

  write(chunk: string | Uint8Array, _encoding?: string, callback?: Function): boolean {
    if (callback) queueMicrotask(() => callback());
    return true;
  }

  end(data?: string | Uint8Array, _encoding?: string, callback?: Function): this {
    if (data) this.write(data);
    this.finished = true;
    if (callback) queueMicrotask(() => callback());
    queueMicrotask(() => this.emit('finish'));
    return this;
  }
}

export class ClientRequest extends EventEmitter {
  method: string;
  path: string;
  private _headers = new Map<string, string>();
  private _body: Uint8Array[] = [];
  private _url: string;
  private _options: any;
  aborted = false;

  constructor(options: any, callback?: (res: IncomingMessage) => void) {
    super();
    if (callback) this.once('response', callback);

    if (typeof options === 'string') {
      const url = new URL(options);
      this._url = options;
      this.method = 'GET';
      this.path = url.pathname + url.search;
      this._options = { hostname: url.hostname, port: url.port, path: this.path };
    } else {
      this._options = options;
      this.method = options.method?.toUpperCase() ?? 'GET';
      const host = options.hostname ?? options.host ?? 'localhost';
      const port = options.port ?? 80;
      this.path = options.path ?? '/';
      this._url = `http://${host}:${port}${this.path}`;
    }

    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        this._headers.set(k, String(v));
      }
    }
  }

  setHeader(name: string, value: string): void {
    this._headers.set(name, value);
  }

  getHeader(name: string): string | undefined {
    return this._headers.get(name);
  }

  write(data: string | Uint8Array): boolean {
    this._body.push(typeof data === 'string' ? new TextEncoder().encode(data) : data);
    return true;
  }

  end(data?: string | Uint8Array, _encoding?: string, callback?: Function): this {
    if (data) this.write(data);

    const headers: Record<string, string> = {};
    this._headers.forEach((v, k) => { headers[k] = v; });

    const body = this._body.length > 0
      ? new Uint8Array(this._body.reduce((sum, b) => sum + b.length, 0))
      : undefined;

    if (body) {
      let offset = 0;
      for (const chunk of this._body) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
    }

    // Use browser fetch for the actual request
    globalThis.fetch(this._url, {
      method: this.method,
      headers,
      body: body && this.method !== 'GET' && this.method !== 'HEAD' ? body : undefined,
    }).then(async response => {
      const res = new IncomingMessage();
      res.statusCode = response.status;
      res.statusMessage = response.statusText;
      response.headers.forEach((v, k) => {
        res.headers[k] = v;
        res.rawHeaders.push(k, v);
      });

      this.emit('response', res);

      const responseBody = new Uint8Array(await response.arrayBuffer());
      if (responseBody.length > 0) {
        res._pushData(responseBody);
      }
      res._end();
    }).catch(err => {
      this.emit('error', err);
    });

    if (callback) queueMicrotask(() => callback());
    return this;
  }

  abort(): void {
    this.aborted = true;
    this.emit('abort');
  }

  destroy(err?: Error): this {
    if (err) this.emit('error', err);
    this.emit('close');
    return this;
  }
}

export function request(options: any, callback?: (res: IncomingMessage) => void): ClientRequest {
  return new ClientRequest(options, callback);
}

export function get(options: any, callback?: (res: IncomingMessage) => void): ClientRequest {
  const opts = typeof options === 'string' ? { method: 'GET' } : { ...options, method: 'GET' };
  const req = request(typeof options === 'string' ? options : opts, callback);
  req.end();
  return req;
}

export class Agent {
  maxSockets = Infinity;
  maxFreeSockets = 256;
  maxTotalSockets = Infinity;

  constructor(_options?: any) {}
  destroy(): void {}
}

export const globalAgent = new Agent();

export function createServer(_requestListener?: (req: IncomingMessage, res: ServerResponse) => void): NetServer {
  return new NetServer();
}

// ── Header validation ───────────────────────────────────────

const INVALID_HEADER_NAME_RE = /[^a-zA-Z0-9\-!#$%&'*+.^_`|~]/;
const INVALID_HEADER_VALUE_RE = /[\x00-\x08\x0a-\x1f\x7f]/;

export function validateHeaderName(name: string): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError(`Header name must be a valid HTTP token ["${name}"]`);
  }
  if (INVALID_HEADER_NAME_RE.test(name)) {
    throw new TypeError(`Header name must be a valid HTTP token ["${name}"]`);
  }
}

export function validateHeaderValue(name: string, value: unknown): void {
  if (value === undefined) {
    throw new TypeError(`Invalid value "${value}" for header "${name}"`);
  }
  const strValue = String(value);
  if (INVALID_HEADER_VALUE_RE.test(strValue)) {
    throw new TypeError(`Invalid character in header content ["${name}"]`);
  }
}

// ── setMaxIdleHTTPParsers ───────────────────────────────────

export function setMaxIdleHTTPParsers(_max: number): void {
  // No-op: browser doesn't pool HTTP parsers
}

export default {
  METHODS, STATUS_CODES,
  IncomingMessage, ServerResponse, ClientRequest,
  request, get, Agent, globalAgent, createServer,
  validateHeaderName, validateHeaderValue, setMaxIdleHTTPParsers,
};
