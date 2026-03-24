// TODO(browser): Replace with browser-native implementation
/**
 * Node.js util module re-export.
 * Pure JS — works in any environment.
 */
import util from 'util';

export const {
  inspect, format, formatWithOptions, deprecate, inherits,
  promisify, callbackify, types, isDeepStrictEqual,
  debuglog, debug: debugFn,
} = util;

export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;

export default util;
