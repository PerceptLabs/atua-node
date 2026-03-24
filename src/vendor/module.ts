/**
 * Node.js module module — browser-compatible implementation.
 *
 * Provides Module class, builtinModules list, isBuiltin, createRequire, etc.
 */
export const __atua = true;

export const builtinModules: string[] = [
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process',
  'cluster', 'console', 'constants', 'crypto', 'dgram',
  'diagnostics_channel', 'dns', 'dns/promises', 'domain', 'events',
  'fs', 'fs/promises', 'http', 'http2', 'https',
  'inspector', 'inspector/promises', 'module', 'net', 'os',
  'path', 'path/posix', 'path/win32', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'readline/promises', 'repl',
  'stream', 'stream/consumers', 'stream/promises', 'stream/web',
  'string_decoder', 'sys', 'test', 'timers', 'timers/promises',
  'tls', 'trace_events', 'tty', 'url', 'util',
  'util/types', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
];

const _builtinSet = new Set(builtinModules);

export function isBuiltin(moduleName: string): boolean {
  if (_builtinSet.has(moduleName)) return true;
  if (moduleName.startsWith('node:')) {
    return _builtinSet.has(moduleName.slice(5));
  }
  return false;
}

export const wrapper = [
  '(function (exports, require, module, __filename, __dirname) { ',
  '\n});',
];

export function wrap(script: string): string {
  return wrapper[0] + script + wrapper[1];
}

export class Module {
  id: string;
  path: string;
  exports: any = {};
  filename: string | null = null;
  loaded: boolean = false;
  children: Module[] = [];
  paths: string[] = [];
  parent: Module | null = null;

  static builtinModules = builtinModules;
  static _cache: Record<string, Module> = Object.create(null);
  static _pathCache: Record<string, string> = Object.create(null);
  static _extensions: Record<string, (module: Module, filename: string) => void> = {
    '.js': (_mod, _filename) => { /* would load JS */ },
    '.json': (_mod, _filename) => { /* would load JSON */ },
    '.node': (_mod, _filename) => {
      throw new Error('Native .node addons are not supported in browser');
    },
  };
  static globalPaths: string[] = [];
  static isBuiltin = isBuiltin;
  static wrap = wrap;
  static wrapper = wrapper;

  constructor(id: string = '', parent?: Module | null) {
    this.id = id;
    this.path = id.substring(0, id.lastIndexOf('/')) || '.';
    this.parent = parent ?? null;
    if (parent) parent.children.push(this);
  }

  require(_id: string): any {
    throw new Error('Module.require() is not supported in browser environment');
  }

  static _resolveFilename(request: string, _parent?: Module, _isMain?: boolean, _options?: any): string {
    if (isBuiltin(request)) return request;
    return request;
  }

  static _nodeModulePaths(from: string): string[] {
    const parts = from.split('/').filter(Boolean);
    const paths: string[] = [];
    for (let i = parts.length; i >= 0; i--) {
      const dir = '/' + parts.slice(0, i).join('/');
      if (parts[i - 1] === 'node_modules') continue;
      paths.push(dir + '/node_modules');
    }
    return paths;
  }

  static _initPaths(): void {
    Module.globalPaths = ['/usr/lib/node_modules'];
  }

  static runMain(): void {
    // No-op in browser
  }

  static createRequire(_filename: string | URL): NodeRequire {
    throw Object.assign(
      new Error('createRequire is not supported in browser environment. Use ES modules instead.'),
      { code: 'ERR_NOT_SUPPORTED' }
    );
  }

  static syncBuiltinESMExports(): void {
    // No-op
  }

  static findSourceMap(_path: string): undefined {
    return undefined;
  }

  static SourceMap = class SourceMap {
    payload: any;
    constructor(payload: any) { this.payload = payload; }
    findEntry(_line: number, _column: number) { return {}; }
  };
}

const mod = {
  Module, builtinModules, isBuiltin, wrap, wrapper, __atua,
  createRequire: Module.createRequire,
  syncBuiltinESMExports: Module.syncBuiltinESMExports,
  findSourceMap: Module.findSourceMap,
  SourceMap: Module.SourceMap,
};
export default mod;
