/**
 * Node.js http2 module — browser-compatible implementation.
 *
 * Exports all HTTP/2 header and NGHTTP2 constants. Server/client
 * creation throws ERR_NOT_SUPPORTED (browser ceiling for raw TCP).
 */
import { EventEmitter } from 'events';

export const __atua = true;

// ── HTTP/2 Header Constants ────────────────────────────────
export const constants = {
  // HTTP/2 header names
  HTTP2_HEADER_STATUS: ':status',
  HTTP2_HEADER_METHOD: ':method',
  HTTP2_HEADER_AUTHORITY: ':authority',
  HTTP2_HEADER_SCHEME: ':scheme',
  HTTP2_HEADER_PATH: ':path',
  HTTP2_HEADER_PROTOCOL: ':protocol',
  HTTP2_HEADER_ACCEPT_ENCODING: 'accept-encoding',
  HTTP2_HEADER_ACCEPT_LANGUAGE: 'accept-language',
  HTTP2_HEADER_ACCEPT_RANGES: 'accept-ranges',
  HTTP2_HEADER_ACCEPT: 'accept',
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_CREDENTIALS: 'access-control-allow-credentials',
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_HEADERS: 'access-control-allow-headers',
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_METHODS: 'access-control-allow-methods',
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN: 'access-control-allow-origin',
  HTTP2_HEADER_ACCESS_CONTROL_EXPOSE_HEADERS: 'access-control-expose-headers',
  HTTP2_HEADER_ACCESS_CONTROL_MAX_AGE: 'access-control-max-age',
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_HEADERS: 'access-control-request-headers',
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_METHOD: 'access-control-request-method',
  HTTP2_HEADER_AGE: 'age',
  HTTP2_HEADER_AUTHORIZATION: 'authorization',
  HTTP2_HEADER_CACHE_CONTROL: 'cache-control',
  HTTP2_HEADER_CONNECTION: 'connection',
  HTTP2_HEADER_CONTENT_DISPOSITION: 'content-disposition',
  HTTP2_HEADER_CONTENT_ENCODING: 'content-encoding',
  HTTP2_HEADER_CONTENT_LENGTH: 'content-length',
  HTTP2_HEADER_CONTENT_TYPE: 'content-type',
  HTTP2_HEADER_COOKIE: 'cookie',
  HTTP2_HEADER_DATE: 'date',
  HTTP2_HEADER_ETAG: 'etag',
  HTTP2_HEADER_FORWARDED: 'forwarded',
  HTTP2_HEADER_HOST: 'host',
  HTTP2_HEADER_IF_MODIFIED_SINCE: 'if-modified-since',
  HTTP2_HEADER_IF_NONE_MATCH: 'if-none-match',
  HTTP2_HEADER_IF_RANGE: 'if-range',
  HTTP2_HEADER_LAST_MODIFIED: 'last-modified',
  HTTP2_HEADER_LINK: 'link',
  HTTP2_HEADER_LOCATION: 'location',
  HTTP2_HEADER_RANGE: 'range',
  HTTP2_HEADER_REFERER: 'referer',
  HTTP2_HEADER_SERVER: 'server',
  HTTP2_HEADER_SET_COOKIE: 'set-cookie',
  HTTP2_HEADER_STRICT_TRANSPORT_SECURITY: 'strict-transport-security',
  HTTP2_HEADER_TRANSFER_ENCODING: 'transfer-encoding',
  HTTP2_HEADER_USER_AGENT: 'user-agent',
  HTTP2_HEADER_VARY: 'vary',
  HTTP2_HEADER_VIA: 'via',
  HTTP2_HEADER_WWW_AUTHENTICATE: 'www-authenticate',
  HTTP2_HEADER_KEEP_ALIVE: 'keep-alive',
  HTTP2_HEADER_PROXY_CONNECTION: 'proxy-connection',
  HTTP2_HEADER_X_FORWARDED_FOR: 'x-forwarded-for',
  HTTP2_HEADER_X_FORWARDED_HOST: 'x-forwarded-host',
  HTTP2_HEADER_X_FORWARDED_PROTO: 'x-forwarded-proto',

  // HTTP/2 method constants
  HTTP2_METHOD_ACL: 'ACL',
  HTTP2_METHOD_BASELINE_CONTROL: 'BASELINE-CONTROL',
  HTTP2_METHOD_BIND: 'BIND',
  HTTP2_METHOD_CHECKIN: 'CHECKIN',
  HTTP2_METHOD_CHECKOUT: 'CHECKOUT',
  HTTP2_METHOD_CONNECT: 'CONNECT',
  HTTP2_METHOD_COPY: 'COPY',
  HTTP2_METHOD_DELETE: 'DELETE',
  HTTP2_METHOD_GET: 'GET',
  HTTP2_METHOD_HEAD: 'HEAD',
  HTTP2_METHOD_LINK: 'LINK',
  HTTP2_METHOD_LOCK: 'LOCK',
  HTTP2_METHOD_MERGE: 'MERGE',
  HTTP2_METHOD_MKACTIVITY: 'MKACTIVITY',
  HTTP2_METHOD_MKCALENDAR: 'MKCALENDAR',
  HTTP2_METHOD_MKCOL: 'MKCOL',
  HTTP2_METHOD_MOVE: 'MOVE',
  HTTP2_METHOD_OPTIONS: 'OPTIONS',
  HTTP2_METHOD_PATCH: 'PATCH',
  HTTP2_METHOD_POST: 'POST',
  HTTP2_METHOD_PRI: 'PRI',
  HTTP2_METHOD_PROPFIND: 'PROPFIND',
  HTTP2_METHOD_PROPPATCH: 'PROPPATCH',
  HTTP2_METHOD_PUT: 'PUT',
  HTTP2_METHOD_REBIND: 'REBIND',
  HTTP2_METHOD_REPORT: 'REPORT',
  HTTP2_METHOD_SEARCH: 'SEARCH',
  HTTP2_METHOD_TRACE: 'TRACE',
  HTTP2_METHOD_UNBIND: 'UNBIND',
  HTTP2_METHOD_UNCHECKOUT: 'UNCHECKOUT',
  HTTP2_METHOD_UNLINK: 'UNLINK',
  HTTP2_METHOD_UNLOCK: 'UNLOCK',
  HTTP2_METHOD_UPDATE: 'UPDATE',

  // NGHTTP2 error codes
  NGHTTP2_NO_ERROR: 0x00,
  NGHTTP2_PROTOCOL_ERROR: 0x01,
  NGHTTP2_INTERNAL_ERROR: 0x02,
  NGHTTP2_FLOW_CONTROL_ERROR: 0x03,
  NGHTTP2_SETTINGS_TIMEOUT: 0x04,
  NGHTTP2_STREAM_CLOSED: 0x05,
  NGHTTP2_FRAME_SIZE_ERROR: 0x06,
  NGHTTP2_REFUSED_STREAM: 0x07,
  NGHTTP2_CANCEL: 0x08,
  NGHTTP2_COMPRESSION_ERROR: 0x09,
  NGHTTP2_CONNECT_ERROR: 0x0a,
  NGHTTP2_ENHANCE_YOUR_CALM: 0x0b,
  NGHTTP2_INADEQUATE_SECURITY: 0x0c,
  NGHTTP2_HTTP_1_1_REQUIRED: 0x0d,

  // Settings IDs
  NGHTTP2_SETTINGS_HEADER_TABLE_SIZE: 0x01,
  NGHTTP2_SETTINGS_ENABLE_PUSH: 0x02,
  NGHTTP2_SETTINGS_MAX_CONCURRENT_STREAMS: 0x03,
  NGHTTP2_SETTINGS_INITIAL_WINDOW_SIZE: 0x04,
  NGHTTP2_SETTINGS_MAX_FRAME_SIZE: 0x05,
  NGHTTP2_SETTINGS_MAX_HEADER_LIST_SIZE: 0x06,
  NGHTTP2_SETTINGS_ENABLE_CONNECT_PROTOCOL: 0x08,

  // Default settings values
  HTTP2_DEFAULT_ALPHN: 'h2',
  HTTP_STATUS_CONTINUE: 100,
  HTTP_STATUS_OK: 200,
  HTTP_STATUS_CREATED: 201,
  HTTP_STATUS_ACCEPTED: 202,
  HTTP_STATUS_NO_CONTENT: 204,
  HTTP_STATUS_MOVED_PERMANENTLY: 301,
  HTTP_STATUS_FOUND: 302,
  HTTP_STATUS_NOT_MODIFIED: 304,
  HTTP_STATUS_BAD_REQUEST: 400,
  HTTP_STATUS_UNAUTHORIZED: 401,
  HTTP_STATUS_FORBIDDEN: 403,
  HTTP_STATUS_NOT_FOUND: 404,
  HTTP_STATUS_METHOD_NOT_ALLOWED: 405,
  HTTP_STATUS_INTERNAL_SERVER_ERROR: 500,
  HTTP_STATUS_NOT_IMPLEMENTED: 501,
  HTTP_STATUS_BAD_GATEWAY: 502,
  HTTP_STATUS_SERVICE_UNAVAILABLE: 503,
  HTTP_STATUS_GATEWAY_TIMEOUT: 504,
} as const;

// Re-export all constants at top level too
export const {
  HTTP2_HEADER_STATUS, HTTP2_HEADER_METHOD, HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_SCHEME, HTTP2_HEADER_PATH,
} = constants;

export interface Http2Settings {
  headerTableSize?: number;
  enablePush?: boolean;
  initialWindowSize?: number;
  maxFrameSize?: number;
  maxConcurrentStreams?: number;
  maxHeaderListSize?: number;
  enableConnectProtocol?: boolean;
}

const DEFAULT_SETTINGS: Http2Settings = {
  headerTableSize: 4096,
  enablePush: true,
  initialWindowSize: 65535,
  maxFrameSize: 16384,
  maxConcurrentStreams: 4294967295,
  maxHeaderListSize: 4294967295,
  enableConnectProtocol: false,
};

export function getDefaultSettings(): Http2Settings {
  return { ...DEFAULT_SETTINGS };
}

export function getPackedSettings(settings: Http2Settings): Buffer {
  void settings;
  return new Uint8Array(0) as any;
}

export function getUnpackedSettings(_buf: Buffer | Uint8Array): Http2Settings {
  return getDefaultSettings();
}

function notSupported(method: string): never {
  throw Object.assign(
    new Error(`http2.${method}() is not supported in browser. HTTP/2 requires raw TCP sockets which are unavailable in browser environments.`),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

export function createServer(_options?: any, _onRequestHandler?: any): never {
  notSupported('createServer');
}

export function createSecureServer(_options?: any, _onRequestHandler?: any): never {
  notSupported('createSecureServer');
}

export function connect(_authority: string | URL, _options?: any, _listener?: any): never {
  notSupported('connect');
}

export class Http2ServerRequest extends EventEmitter {
  headers: Record<string, string> = {};
  httpVersion = '2.0';
  method = 'GET';
  url = '/';
}

export class Http2ServerResponse extends EventEmitter {
  statusCode = 200;
  writeHead(_statusCode: number, _headers?: Record<string, string>): this { return this; }
  end(_data?: any, _encoding?: string, _callback?: () => void): this { return this; }
  write(_chunk: any, _encoding?: string, _callback?: () => void): boolean { return true; }
}

export function sensitiveHeaders(): symbol {
  return Symbol('nodejs.http2.sensitiveHeaders');
}

const http2 = {
  constants, getDefaultSettings, getPackedSettings, getUnpackedSettings,
  createServer, createSecureServer, connect,
  Http2ServerRequest, Http2ServerResponse, sensitiveHeaders,
  __atua,
};
export default http2;
