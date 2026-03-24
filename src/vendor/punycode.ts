/**
 * Node.js punycode module — browser-compatible via punycode npm package.
 * Deprecated in Node.js but still needed for compatibility.
 */
export const __atua = true;

import punycode from 'punycode';

export const encode = punycode.encode;
export const decode = punycode.decode;
export const toASCII = punycode.toASCII;
export const toUnicode = punycode.toUnicode;
export const ucs2 = punycode.ucs2;

export default punycode;
