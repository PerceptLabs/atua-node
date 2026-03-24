/**
 * Node.js querystring module — browser-compatible via querystring-es3 npm package.
 */
export const __atua = true;

import qs from 'querystring-es3';

export const parse = qs.parse ?? qs.decode;
export const stringify = qs.stringify ?? qs.encode;
export const decode = qs.decode ?? qs.parse;
export const encode = qs.encode ?? qs.stringify;
export const escape = qs.escape;
export const unescape = qs.unescape;

export default qs;
