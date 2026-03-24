// TODO(browser): Replace with browser-native implementation
/**
 * Node.js punycode module re-export.
 * Deprecated in Node.js but still needed for compatibility.
 */
// @ts-ignore — punycode is deprecated but available
import punycode from 'punycode';

export const { encode, decode, toASCII, toUnicode, ucs2, version } = punycode;
export default punycode;
