// TODO(browser): Replace with browser-native implementation
/**
 * Node.js string_decoder module re-export.
 * Pure JS — works in any environment.
 */
import string_decoder from 'string_decoder';

export const { StringDecoder } = string_decoder;
export default string_decoder;
