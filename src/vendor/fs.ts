/**
 * Node.js fs module facade.
 *
 * Routes filesystem operations through fs-bridge → AtuaFS (OPFS-backed).
 * Provides both callback and sync APIs.
 */
export const __atua = true;

import { EventEmitter } from 'events';
import { FsBridge, type FileSystem, type FileStat, type DirEntry, O_RDONLY, O_WRONLY, O_CREAT, O_RDWR, O_APPEND, O_TRUNC } from '../bridges/fs-bridge.js';

const _bridge = new FsBridge();
const _encoder = new TextEncoder();
const _decoder = new TextDecoder();

// In-memory filesystem for standalone operation
const _memFs = new Map<string, Uint8Array>();
const _memDirs = new Set<string>(['/']);

function normalizePath(p: string): string {
  if (!p.startsWith('/')) p = '/' + p;
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function dirName(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '/' : p.substring(0, idx);
}

// ── Stats class ─────────────────────────────────────────────

export class Stats {
  dev = 0;
  ino = 0;
  mode: number;
  nlink = 1;
  uid = 1000;
  gid = 1000;
  rdev = 0;
  size: number;
  blksize = 4096;
  blocks: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  private _isFile: boolean;
  private _isDir: boolean;
  private _isSymlink: boolean;

  constructor(opts: { size: number; isFile: boolean; isDirectory: boolean; isSymlink?: boolean; mode?: number; mtime?: number }) {
    this.size = opts.size;
    this._isFile = opts.isFile;
    this._isDir = opts.isDirectory;
    this._isSymlink = opts.isSymlink ?? false;
    this.mode = opts.mode ?? (opts.isDirectory ? 0o755 : 0o644);
    this.blocks = Math.ceil(this.size / 512);
    const now = opts.mtime ?? Date.now();
    this.atimeMs = now;
    this.mtimeMs = now;
    this.ctimeMs = now;
    this.birthtimeMs = now;
    this.atime = new Date(now);
    this.mtime = new Date(now);
    this.ctime = new Date(now);
    this.birthtime = new Date(now);
  }

  isFile(): boolean { return this._isFile; }
  isDirectory(): boolean { return this._isDir; }
  isBlockDevice(): boolean { return false; }
  isCharacterDevice(): boolean { return false; }
  isSymbolicLink(): boolean { return this._isSymlink; }
  isFIFO(): boolean { return false; }
  isSocket(): boolean { return false; }
}

// ── Async API ───────────────────────────────────────────────

export function readFile(path: string, options: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const encoding = typeof options === 'string' ? options : options?.encoding;
  const p = normalizePath(String(path));

  queueMicrotask(() => {
    const data = _memFs.get(p);
    if (!data) {
      (callback as Function)(Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT' }));
      return;
    }
    if (encoding) {
      (callback as Function)(null, _decoder.decode(data));
    } else {
      (callback as Function)(null, data);
    }
  });
}

export function writeFile(path: string, data: string | Uint8Array, options: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const encoding = typeof options === 'string' ? options : options?.encoding ?? 'utf8';
  const p = normalizePath(String(path));
  const bytes = typeof data === 'string' ? _encoder.encode(data) : data;

  _memFs.set(p, new Uint8Array(bytes));
  const dir = dirName(p);
  _memDirs.add(dir);

  if (callback) queueMicrotask(() => (callback as Function)(null));
}

export function stat(path: string, callback: (err: Error | null, stats?: Stats) => void): void {
  const p = normalizePath(String(path));
  queueMicrotask(() => {
    if (_memFs.has(p)) {
      callback(null, new Stats({ size: _memFs.get(p)!.length, isFile: true, isDirectory: false }));
    } else if (_memDirs.has(p)) {
      callback(null, new Stats({ size: 0, isFile: false, isDirectory: true }));
    } else {
      callback(Object.assign(new Error(`ENOENT: no such file or directory, stat '${p}'`), { code: 'ENOENT' }));
    }
  });
}

export function mkdir(path: string, options: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const p = normalizePath(String(path));
  _memDirs.add(p);
  if (options?.recursive) {
    let current = '';
    for (const part of p.split('/').filter(Boolean)) {
      current += '/' + part;
      _memDirs.add(current);
    }
  }
  if (callback) queueMicrotask(() => (callback as Function)(null));
}

export function readdir(path: string, options: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const p = normalizePath(String(path));
  const prefix = p === '/' ? '/' : p + '/';
  const entries: string[] = [];

  for (const key of _memFs.keys()) {
    if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name && !entries.includes(name)) entries.push(name);
    }
  }
  for (const dir of _memDirs) {
    if (dir.startsWith(prefix) && dir !== p) {
      const rest = dir.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name && !entries.includes(name)) entries.push(name);
    }
  }

  if (callback) queueMicrotask(() => (callback as Function)(null, entries));
}

export function unlink(path: string, callback: (err: Error | null) => void): void {
  const p = normalizePath(String(path));
  _memFs.delete(p);
  queueMicrotask(() => callback(null));
}

export function rename(oldPath: string, newPath: string, callback: (err: Error | null) => void): void {
  const op = normalizePath(String(oldPath));
  const np = normalizePath(String(newPath));
  const data = _memFs.get(op);
  if (data) {
    _memFs.set(np, data);
    _memFs.delete(op);
  }
  queueMicrotask(() => callback(null));
}

export function existsSync(path: string): boolean {
  const p = normalizePath(String(path));
  return _memFs.has(p) || _memDirs.has(p);
}

export function access(path: string, mode: any, callback?: Function): void {
  if (typeof mode === 'function') { callback = mode; }
  const p = normalizePath(String(path));
  queueMicrotask(() => {
    if (_memFs.has(p) || _memDirs.has(p)) {
      (callback as Function)(null);
    } else {
      (callback as Function)(Object.assign(new Error(`ENOENT: '${p}'`), { code: 'ENOENT' }));
    }
  });
}

// ── Sync API ────────────────────────────────────────────────

export function readFileSync(path: string, options?: any): string | Uint8Array {
  const encoding = typeof options === 'string' ? options : options?.encoding;
  const p = normalizePath(String(path));
  const data = _memFs.get(p);
  if (!data) throw Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT' });
  return encoding ? _decoder.decode(data) : new Uint8Array(data);
}

export function writeFileSync(path: string, data: string | Uint8Array, options?: any): void {
  const p = normalizePath(String(path));
  const bytes = typeof data === 'string' ? _encoder.encode(data) : data;
  _memFs.set(p, new Uint8Array(bytes));
  _memDirs.add(dirName(p));
}

export function statSync(path: string): Stats {
  const p = normalizePath(String(path));
  if (_memFs.has(p)) return new Stats({ size: _memFs.get(p)!.length, isFile: true, isDirectory: false });
  if (_memDirs.has(p)) return new Stats({ size: 0, isFile: false, isDirectory: true });
  throw Object.assign(new Error(`ENOENT: '${p}'`), { code: 'ENOENT' });
}

export function mkdirSync(path: string, options?: any): void {
  const p = normalizePath(String(path));
  _memDirs.add(p);
  if (options?.recursive) {
    let current = '';
    for (const part of p.split('/').filter(Boolean)) {
      current += '/' + part;
      _memDirs.add(current);
    }
  }
}

export function readdirSync(path: string): string[] {
  const p = normalizePath(String(path));
  const prefix = p === '/' ? '/' : p + '/';
  const entries: string[] = [];
  for (const key of _memFs.keys()) {
    if (key.startsWith(prefix)) {
      const name = key.slice(prefix.length).split('/')[0];
      if (name && !entries.includes(name)) entries.push(name);
    }
  }
  return entries;
}

export function unlinkSync(path: string): void {
  _memFs.delete(normalizePath(String(path)));
}

export function rmSync(path: string, _options?: any): void {
  const p = normalizePath(String(path));
  _memFs.delete(p);
  _memDirs.delete(p);
}

// ── Watch (polling-based) ───────────────────────────────────

export function watch(filename: string, _options?: any, listener?: Function): EventEmitter {
  const watcher = new EventEmitter();
  const p = normalizePath(String(filename));
  let lastSize = _memFs.get(p)?.length ?? -1;

  const interval = globalThis.setInterval(() => {
    const current = _memFs.get(p)?.length ?? -1;
    if (current !== lastSize) {
      lastSize = current;
      const cb = listener ?? (() => {});
      cb('change', filename);
      watcher.emit('change', 'change', filename);
    }
  }, 500);

  (watcher as any).close = () => globalThis.clearInterval(interval);
  return watcher;
}

// ── Promises API ────────────────────────────────────────────

export const promises = {
  readFile: (path: string, options?: any) => new Promise<string | Uint8Array>((resolve, reject) => {
    readFile(path, options ?? {}, (err: any, data: any) => err ? reject(err) : resolve(data));
  }),
  writeFile: (path: string, data: string | Uint8Array, options?: any) => new Promise<void>((resolve, reject) => {
    writeFile(path, data, options ?? {}, (err: any) => err ? reject(err) : resolve());
  }),
  stat: (path: string) => new Promise<Stats>((resolve, reject) => {
    stat(path, (err, stats) => err ? reject(err) : resolve(stats!));
  }),
  mkdir: (path: string, options?: any) => new Promise<void>((resolve, reject) => {
    mkdir(path, options ?? {}, (err: any) => err ? reject(err) : resolve());
  }),
  readdir: (path: string, options?: any) => new Promise<string[]>((resolve, reject) => {
    readdir(path, options ?? {}, (err: any, entries: any) => err ? reject(err) : resolve(entries));
  }),
  unlink: (path: string) => new Promise<void>((resolve, reject) => {
    unlink(path, (err) => err ? reject(err) : resolve());
  }),
  access: (path: string, mode?: any) => new Promise<void>((resolve, reject) => {
    access(path, mode, (err: any) => err ? reject(err) : resolve());
  }),
  rename: (oldPath: string, newPath: string) => new Promise<void>((resolve, reject) => {
    rename(oldPath, newPath, (err) => err ? reject(err) : resolve());
  }),
  chmod: (path: string, _mode: number) => new Promise<void>((resolve) => {
    // chmod is a no-op in the in-memory filesystem
    queueMicrotask(() => resolve());
  }),
  symlink: (target: string, path: string, _type?: string) => new Promise<void>((resolve) => {
    // Symlinks stored as the target path in _memFs
    const p = normalizePath(String(path));
    _memFs.set(p, _encoder.encode(target));
    _memDirs.add(dirName(p));
    resolve();
  }),
  readlink: (path: string) => new Promise<string>((resolve, reject) => {
    const p = normalizePath(String(path));
    const data = _memFs.get(p);
    if (!data) {
      reject(Object.assign(new Error(`ENOENT: no such file or directory, readlink '${p}'`), { code: 'ENOENT' }));
    } else {
      resolve(_decoder.decode(data));
    }
  }),
};

// ── Dirent class ────────────────────────────────────────────

export class Dirent {
  name: string;
  private _isFile: boolean;
  private _isDir: boolean;
  private _isSymlink: boolean;

  constructor(name: string, opts: { isFile: boolean; isDirectory: boolean; isSymlink?: boolean }) {
    this.name = name;
    this._isFile = opts.isFile;
    this._isDir = opts.isDirectory;
    this._isSymlink = opts.isSymlink ?? false;
  }

  isFile(): boolean { return this._isFile; }
  isDirectory(): boolean { return this._isDir; }
  isSymbolicLink(): boolean { return this._isSymlink; }
  isBlockDevice(): boolean { return false; }
  isCharacterDevice(): boolean { return false; }
  isFIFO(): boolean { return false; }
  isSocket(): boolean { return false; }
}

// ── Dir class ───────────────────────────────────────────────

export class Dir {
  path: string;
  private _entries: Dirent[];
  private _index: number;
  private _closed: boolean;

  constructor(dirPath: string, entries: Dirent[]) {
    this.path = dirPath;
    this._entries = entries;
    this._index = 0;
    this._closed = false;
  }

  async close(): Promise<void> {
    this._closed = true;
  }

  async read(): Promise<Dirent | null> {
    if (this._closed || this._index >= this._entries.length) return null;
    return this._entries[this._index++];
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Dirent> {
    const self = this;
    return {
      async next(): Promise<IteratorResult<Dirent>> {
        const entry = await self.read();
        if (entry === null) return { done: true, value: undefined as any };
        return { done: false, value: entry };
      },
      [Symbol.asyncIterator]() { return this; },
    };
  }
}

// ── opendir ─────────────────────────────────────────────────

export function opendir(path: string, options?: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const p = normalizePath(String(path));

  queueMicrotask(() => {
    if (!_memDirs.has(p)) {
      const err = Object.assign(new Error(`ENOENT: no such file or directory, opendir '${p}'`), { code: 'ENOENT' });
      if (callback) (callback as Function)(err);
      return;
    }

    const prefix = p === '/' ? '/' : p + '/';
    const nameSet = new Set<string>();
    const entries: Dirent[] = [];

    for (const key of _memFs.keys()) {
      if (key.startsWith(prefix)) {
        const name = key.slice(prefix.length).split('/')[0];
        if (name && !nameSet.has(name)) {
          nameSet.add(name);
          entries.push(new Dirent(name, { isFile: true, isDirectory: false }));
        }
      }
    }
    for (const dir of _memDirs) {
      if (dir.startsWith(prefix) && dir !== p) {
        const name = dir.slice(prefix.length).split('/')[0];
        if (name && !nameSet.has(name)) {
          nameSet.add(name);
          entries.push(new Dirent(name, { isFile: false, isDirectory: true }));
        }
      }
    }

    if (callback) (callback as Function)(null, new Dir(p, entries));
  });
}

// ── cp / cpSync ─────────────────────────────────────────────

export function cp(src: string, dest: string, options?: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const srcPath = normalizePath(String(src));
  const destPath = normalizePath(String(dest));

  queueMicrotask(() => {
    try {
      cpSync(srcPath, destPath, options);
      if (callback) (callback as Function)(null);
    } catch (err) {
      if (callback) (callback as Function)(err);
    }
  });
}

export function cpSync(src: string, dest: string, options?: any): void {
  const srcPath = normalizePath(String(src));
  const destPath = normalizePath(String(dest));
  const recursive = options?.recursive ?? false;

  if (_memFs.has(srcPath)) {
    // Copy a single file
    _memFs.set(destPath, new Uint8Array(_memFs.get(srcPath)!));
    _memDirs.add(dirName(destPath));
    return;
  }

  if (_memDirs.has(srcPath)) {
    if (!recursive) {
      throw Object.assign(
        new Error(`ERR_FS_EISDIR: Path is a directory. To copy a directory, use the recursive option.`),
        { code: 'ERR_FS_EISDIR' }
      );
    }
    // Recursively copy directory contents
    _memDirs.add(destPath);
    const prefix = srcPath === '/' ? '/' : srcPath + '/';
    for (const [key, value] of _memFs.entries()) {
      if (key.startsWith(prefix)) {
        const relative = key.slice(srcPath.length);
        const newKey = destPath + relative;
        _memFs.set(newKey, new Uint8Array(value));
        _memDirs.add(dirName(newKey));
      }
    }
    for (const dir of _memDirs) {
      if (dir.startsWith(prefix)) {
        const relative = dir.slice(srcPath.length);
        _memDirs.add(destPath + relative);
      }
    }
    return;
  }

  throw Object.assign(new Error(`ENOENT: no such file or directory, cp '${srcPath}'`), { code: 'ENOENT' });
}

// ── statfs ──────────────────────────────────────────────────

export function statfs(path: string, options?: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  queueMicrotask(() => {
    // Return reasonable defaults for an in-memory filesystem
    const result = {
      type: 0x2fc12fc1, // OPFS magic
      bsize: 4096,
      blocks: 262144, // ~1 GB
      bfree: 131072,
      bavail: 131072,
      files: 65536,
      ffree: 65536,
    };
    if (callback) (callback as Function)(null, result);
  });
}

// ── chmod (async) ───────────────────────────────────────────

export function chmod(path: string, mode: number, callback: (err: Error | null) => void): void {
  // No-op in the in-memory filesystem
  queueMicrotask(() => callback(null));
}

// ── symlink / readlink (async) ──────────────────────────────

export function symlink(target: string, path: string, typeOrCallback?: string | Function, callback?: Function): void {
  if (typeof typeOrCallback === 'function') { callback = typeOrCallback; }
  const p = normalizePath(String(path));
  _memFs.set(p, _encoder.encode(target));
  _memDirs.add(dirName(p));
  if (callback) queueMicrotask(() => (callback as Function)(null));
}

export function readlink(path: string, options?: any, callback?: Function): void {
  if (typeof options === 'function') { callback = options; options = {}; }
  const p = normalizePath(String(path));
  queueMicrotask(() => {
    const data = _memFs.get(p);
    if (!data) {
      if (callback) (callback as Function)(Object.assign(new Error(`ENOENT: no such file or directory, readlink '${p}'`), { code: 'ENOENT' }));
    } else {
      if (callback) (callback as Function)(null, _decoder.decode(data));
    }
  });
}

// ── glob / globSync ─────────────────────────────────────────

export function glob(_pattern: string, _options?: any, callback?: Function): void {
  if (typeof _options === 'function') { callback = _options; }
  const err = Object.assign(
    new Error('fs.glob is not supported in the Atua runtime'),
    { code: 'ERR_NOT_SUPPORTED' }
  );
  if (callback) queueMicrotask(() => (callback as Function)(err));
  else throw err;
}

export function globSync(_pattern: string, _options?: any): never {
  throw Object.assign(
    new Error('fs.globSync is not supported in the Atua runtime'),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

// ── Constants ───────────────────────────────────────────────

export const constants = {
  F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
  O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_TRUNC, O_APPEND,
  S_IRUSR: 0o400, S_IWUSR: 0o200, S_IXUSR: 0o100,
  S_IRGRP: 0o040, S_IWGRP: 0o020, S_IXGRP: 0o010,
  S_IROTH: 0o004, S_IWOTH: 0o002, S_IXOTH: 0o001,
};

export default {
  readFile, writeFile, stat, mkdir, readdir, unlink, rename, access,
  readFileSync, writeFileSync, statSync, mkdirSync, readdirSync, unlinkSync, rmSync,
  existsSync, watch, promises, constants, Stats,
  Dirent, Dir, opendir, cp, cpSync, statfs, chmod, symlink, readlink,
  glob, globSync,
};
