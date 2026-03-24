/**
 * Node.js path module — browser-compatible via path-browserify.
 */
export const __atua = true;

// @ts-ignore — path-browserify types
import path from 'path-browserify';

export const join = path.join;
export const resolve = path.resolve;
export const dirname = path.dirname;
export const basename = path.basename;
export const extname = path.extname;
export const normalize = path.normalize;
export const isAbsolute = path.isAbsolute;
export const relative = path.relative;
export const parse = path.parse;
export const format = path.format;
export const sep = path.sep;
export const delimiter = path.delimiter;
export const posix = path.posix;
export const win32 = path.win32;
export const toNamespacedPath = path.toNamespacedPath ?? ((p: string) => p);

/** Node 24: matchesGlob — implement basic glob matching */
export function matchesGlob(path_: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    + '$'
  );
  return regex.test(path_);
}

export default path;
