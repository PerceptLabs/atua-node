// TODO(browser): Replace with browser-native implementation
/**
 * Node.js path module re-export.
 * Pure JS — works in any environment.
 */
import path from 'path';

export const {
  join, resolve, dirname, basename, extname, normalize,
  isAbsolute, relative, parse, format, sep, delimiter,
  posix, win32, toNamespacedPath,
} = path;

export default path;
