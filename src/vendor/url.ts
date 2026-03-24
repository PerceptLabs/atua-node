/**
 * Node.js url module facade.
 *
 * Provides the public require('url') API by delegating to
 * internalBinding('url') which wraps ada.wasm.
 */
export const __atua = true;

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

// ── fileURLToPath / pathToFileURL ───────────────────────────

export function fileURLToPath(url: string | URL): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  if (urlObj.protocol !== 'file:') {
    throw new TypeError('The URL must be of scheme file');
  }
  // Decode percent-encoded characters and return pathname
  let pathname = decodeURIComponent(urlObj.pathname);
  // On Windows-like paths, remove leading slash before drive letter (e.g., /C:/foo -> C:/foo)
  if (/^\/[a-zA-Z]:\//.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

export function pathToFileURL(path: string): URL {
  let resolved = path;
  // Ensure absolute path starts with /
  if (!resolved.startsWith('/') && !/^[a-zA-Z]:/.test(resolved)) {
    resolved = '/' + resolved;
  }
  // Handle Windows drive letters
  if (/^[a-zA-Z]:/.test(resolved)) {
    resolved = '/' + resolved;
  }
  return new URL('file://' + encodeURI(resolved).replace(/#/g, '%23').replace(/\?/g, '%3F'));
}

// ── domainToASCII / domainToUnicode ─────────────────────────

export function domainToASCII(domain: string): string {
  try {
    const url = new URL(`http://${domain}`);
    return url.hostname;
  } catch {
    return '';
  }
}

export function domainToUnicode(domain: string): string {
  try {
    // The URL constructor handles punycode, hostname gives the unicode form in modern browsers
    const url = new URL(`http://${domain}`);
    return url.hostname;
  } catch {
    return '';
  }
}

// ── urlToHttpOptions ────────────────────────────────────────

export function urlToHttpOptions(url: URL): {
  protocol: string;
  hostname: string;
  hash: string;
  search: string;
  pathname: string;
  path: string;
  href: string;
  port?: number;
  auth?: string;
} {
  const options: any = {
    protocol: url.protocol,
    hostname: typeof url.hostname === 'string' && url.hostname.startsWith('[')
      ? url.hostname.slice(1, -1)
      : url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname}${url.search}`,
    href: url.href,
  };
  if (url.port !== '') {
    options.port = Number(url.port);
  }
  if (url.username || url.password) {
    options.auth = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
  }
  return options;
}

export default {
  parse, resolve, format,
  fileURLToPath, pathToFileURL, domainToASCII, domainToUnicode, urlToHttpOptions,
};
