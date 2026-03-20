/**
 * Node.js https module facade.
 *
 * Same as http but with TLS. Client requests use fetch with https:// URLs.
 */

import { ClientRequest, IncomingMessage, Agent as HttpAgent, createServer as httpCreateServer } from './http.js';
import { Server as NetServer } from './net.js';

export class Agent extends HttpAgent {
  constructor(options?: any) {
    super(options);
  }
}

export const globalAgent = new Agent();

export function request(options: any, callback?: (res: IncomingMessage) => void): ClientRequest {
  if (typeof options === 'string') {
    return new ClientRequest(options, callback);
  }
  const opts = { ...options, protocol: 'https:' };
  const host = opts.hostname ?? opts.host ?? 'localhost';
  const port = opts.port ?? 443;
  const path = opts.path ?? '/';
  const url = `https://${host}:${port}${path}`;
  return new ClientRequest({ ...opts, _url: url }, callback);
}

export function get(options: any, callback?: (res: IncomingMessage) => void): ClientRequest {
  const req = request(options, callback);
  req.end();
  return req;
}

export function createServer(_options?: any, _requestListener?: Function): NetServer {
  return httpCreateServer() as any;
}

export default { Agent, globalAgent, request, get, createServer };
