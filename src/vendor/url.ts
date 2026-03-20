/**
 * Node.js url module facade.
 *
 * Provides the public require('url') API by delegating to
 * internalBinding('url') which wraps ada.wasm.
 */

import { internalBinding } from './internal-binding.js';

const binding = internalBinding('url') as {
  parse(url: string): {
    href: string; protocol: string; hostname: string; port: string;
    pathname: string; search: string; hash: string;
    username: string; password: string; origin: string; valid: boolean;
  };
};

export interface UrlObject {
  protocol: string | null;
  slashes: boolean | null;
  auth: string | null;
  host: string | null;
  port: string | null;
  hostname: string | null;
  hash: string | null;
  search: string | null;
  query: string | Record<string, string> | null;
  pathname: string | null;
  path: string | null;
  href: string;
}

export function parse(urlStr: string, _parseQueryString?: boolean, _slashesDenoteHost?: boolean): UrlObject {
  const parsed = binding.parse(urlStr);

  if (!parsed.valid) {
    return {
      protocol: null, slashes: null, auth: null, host: null,
      port: null, hostname: null, hash: null, search: null,
      query: null, pathname: urlStr, path: urlStr, href: urlStr,
    };
  }

  const auth = parsed.username
    ? (parsed.password ? `${parsed.username}:${parsed.password}` : parsed.username)
    : null;
  const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  const path = parsed.search ? `${parsed.pathname}${parsed.search}` : parsed.pathname;

  return {
    protocol: parsed.protocol || null,
    slashes: parsed.protocol ? parsed.href.startsWith(parsed.protocol + '//') : null,
    auth,
    host: host || null,
    port: parsed.port || null,
    hostname: parsed.hostname || null,
    hash: parsed.hash || null,
    search: parsed.search || null,
    query: parsed.search ? parsed.search.slice(1) : null,
    pathname: parsed.pathname || null,
    path: path || null,
    href: parsed.href,
  };
}

export function resolve(from: string, to: string): string {
  return new URL(to, from).href;
}

export function format(urlObj: UrlObject | URL): string {
  if (urlObj instanceof URL) return urlObj.href;
  let result = '';
  if (urlObj.protocol) result += urlObj.protocol;
  if (urlObj.slashes) result += '//';
  if (urlObj.auth) result += urlObj.auth + '@';
  if (urlObj.host) result += urlObj.host;
  else if (urlObj.hostname) {
    result += urlObj.hostname;
    if (urlObj.port) result += ':' + urlObj.port;
  }
  if (urlObj.pathname) result += urlObj.pathname;
  if (urlObj.search) result += urlObj.search;
  if (urlObj.hash) result += urlObj.hash;
  return result;
}

// Re-export the WHATWG URL class
export { URL, URLSearchParams } from 'url';

export default { parse, resolve, format };
