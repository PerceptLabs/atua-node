// TODO(browser): Replace with browser-native implementation
/**
 * Node.js querystring module re-export.
 * Pure JS — works in any environment.
 */
import querystring from 'querystring';

export const { parse, stringify, decode, encode, escape, unescape } = querystring;
export default querystring;
