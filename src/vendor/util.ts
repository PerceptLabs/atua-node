/**
 * Node.js util module — browser-compatible custom implementation.
 */
export const __atua = true;

export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;

/** format — printf-style string formatting */
export function format(fmt: any, ...args: any[]): string {
  if (typeof fmt !== 'string') {
    return [fmt, ...args].map(a => typeof a === 'string' ? a : inspect(a)).join(' ');
  }
  let i = 0;
  let result = fmt.replace(/%([sdifjoO%])/g, (match: string, spec: string) => {
    if (spec === '%') return '%';
    if (i >= args.length) return match;
    const arg = args[i++];
    switch (spec) {
      case 's': return String(arg);
      case 'd': return Number(arg).toString();
      case 'i': return parseInt(arg, 10).toString();
      case 'f': return parseFloat(arg).toString();
      case 'j': try { return JSON.stringify(arg); } catch { return '[Circular]'; }
      case 'o': case 'O': return inspect(arg);
      default: return match;
    }
  });
  while (i < args.length) {
    result += ' ' + (typeof args[i] === 'string' ? args[i] : inspect(args[i]));
    i++;
  }
  return result;
}

/** formatWithOptions — format with inspect options */
export function formatWithOptions(inspectOptions: any, fmt: any, ...args: any[]): string {
  return format(fmt, ...args);
}

/** inspect — object to string representation */
export function inspect(obj: any, opts?: any): string {
  const options = typeof opts === 'boolean' ? { showHidden: opts } : (opts ?? {});
  const depth = options.depth ?? 2;
  const colors = options.colors ?? false;
  return _inspect(obj, depth, new Set(), colors);
}

function _inspect(obj: any, depth: number, seen: Set<any>, colors: boolean): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'string') return `'${obj}'`;
  if (typeof obj === 'number' || typeof obj === 'boolean' || typeof obj === 'bigint') return String(obj);
  if (typeof obj === 'symbol') return obj.toString();
  if (typeof obj === 'function') return `[Function: ${obj.name || '(anonymous)'}]`;

  if (seen.has(obj)) return '[Circular]';

  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof RegExp) return obj.toString();
  if (obj instanceof Error) return `${obj.name}: ${obj.message}`;
  if (typeof obj[Symbol.toPrimitive] === 'function') return String(obj[Symbol.toPrimitive]('string'));

  if (depth < 0) return Array.isArray(obj) ? '[Array]' : '[Object]';

  seen.add(obj);

  if (ArrayBuffer.isView(obj)) {
    const name = obj.constructor?.name ?? 'TypedArray';
    return `${name}(${(obj as any).length}) [${Array.from(obj as any).slice(0, 10).join(', ')}${(obj as any).length > 10 ? ', ...' : ''}]`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item => _inspect(item, depth - 1, seen, colors));
    return `[ ${items.join(', ')} ]`;
  }

  if (obj instanceof Map) {
    const entries = Array.from(obj.entries())
      .map(([k, v]) => `${_inspect(k, depth - 1, seen, colors)} => ${_inspect(v, depth - 1, seen, colors)}`);
    return `Map(${obj.size}) { ${entries.join(', ')} }`;
  }

  if (obj instanceof Set) {
    const items = Array.from(obj).map(v => _inspect(v, depth - 1, seen, colors));
    return `Set(${obj.size}) { ${items.join(', ')} }`;
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) {
    const ctor = obj.constructor?.name;
    return ctor && ctor !== 'Object' ? `${ctor} {}` : '{}';
  }
  const pairs = keys.map(k => `${k}: ${_inspect(obj[k], depth - 1, seen, colors)}`);
  const ctor = obj.constructor?.name;
  const prefix = ctor && ctor !== 'Object' ? `${ctor} ` : '';
  return `${prefix}{ ${pairs.join(', ')} }`;
}

inspect.defaultOptions = { depth: 2, colors: false, showHidden: false };
inspect.styles = {};
inspect.colors = {};
inspect.custom = Symbol.for('nodejs.util.inspect.custom');

/** inherits — classical prototype inheritance */
export function inherits(ctor: any, superCtor: any): void {
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  ctor.super_ = superCtor;
}

/** deprecate — wrap function with deprecation warning */
export function deprecate(fn: Function, msg: string, code?: string): Function {
  let warned = false;
  function deprecated(this: any, ...args: any[]) {
    if (!warned) {
      warned = true;
      console.warn(`DeprecationWarning: ${msg}${code ? ` (${code})` : ''}`);
    }
    return fn.apply(this, args);
  }
  Object.setPrototypeOf(deprecated, fn);
  return deprecated;
}

/** promisify — convert callback-style function to promise */
export function promisify(original: Function): (...args: any[]) => Promise<any> {
  if (typeof original !== 'function') throw new TypeError('The "original" argument must be of type Function');
  const custom = (original as any)[promisify.custom];
  if (custom) return custom;

  function fn(this: any, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      args.push((err: any, ...values: any[]) => {
        if (err) reject(err);
        else resolve(values.length <= 1 ? values[0] : values);
      });
      original.apply(this, args);
    });
  }
  Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
  return fn;
}
promisify.custom = Symbol.for('nodejs.util.promisify.custom');

/** callbackify — convert promise function to callback style */
export function callbackify(original: Function): (...args: any[]) => void {
  function fn(this: any, ...args: any[]) {
    const cb = args.pop();
    if (typeof cb !== 'function') throw new TypeError('The last argument must be of type Function');
    original.apply(this, args).then(
      (result: any) => queueMicrotask(() => cb(null, result)),
      (err: any) => queueMicrotask(() => cb(err ?? new Error('Promise rejected with falsy value'))),
    );
  }
  return fn;
}

/** types — type checking utilities */
export const types = {
  isDate: (v: any): v is Date => v instanceof Date,
  isRegExp: (v: any): v is RegExp => v instanceof RegExp,
  isMap: (v: any): v is Map<any, any> => v instanceof Map,
  isSet: (v: any): v is Set<any> => v instanceof Set,
  isWeakMap: (v: any): v is WeakMap<any, any> => v instanceof WeakMap,
  isWeakSet: (v: any): v is WeakSet<any> => v instanceof WeakSet,
  isPromise: (v: any): v is Promise<any> => v instanceof Promise,
  isArrayBuffer: (v: any): v is ArrayBuffer => v instanceof ArrayBuffer,
  isArrayBufferView: (v: any): boolean => ArrayBuffer.isView(v),
  isTypedArray: (v: any): boolean => ArrayBuffer.isView(v) && !(v instanceof DataView),
  isDataView: (v: any): v is DataView => v instanceof DataView,
  isSharedArrayBuffer: (v: any): boolean => typeof SharedArrayBuffer !== 'undefined' && v instanceof SharedArrayBuffer,
  isProxy: (_v: any): boolean => false, // Can't detect proxies in JS
  isNativeError: (v: any): boolean => v instanceof Error,
  isNumberObject: (v: any): boolean => v instanceof Number,
  isStringObject: (v: any): boolean => v instanceof String,
  isBooleanObject: (v: any): boolean => v instanceof Boolean,
  isBigIntObject: (v: any): boolean => typeof v === 'object' && v !== null && typeof v.valueOf() === 'bigint',
  isSymbolObject: (v: any): boolean => typeof v === 'object' && v !== null && typeof v.valueOf() === 'symbol',
  isGeneratorFunction: (v: any): boolean => v?.constructor?.name === 'GeneratorFunction',
  isAsyncFunction: (v: any): boolean => v?.constructor?.name === 'AsyncFunction',
  isGeneratorObject: (v: any): boolean => v?.[Symbol.toStringTag] === 'Generator',
  isMapIterator: (v: any): boolean => v?.[Symbol.toStringTag] === 'Map Iterator',
  isSetIterator: (v: any): boolean => v?.[Symbol.toStringTag] === 'Set Iterator',
  isUint8Array: (v: any): v is Uint8Array => v instanceof Uint8Array,
  isUint16Array: (v: any): boolean => v instanceof Uint16Array,
  isUint32Array: (v: any): boolean => v instanceof Uint32Array,
  isInt8Array: (v: any): boolean => v instanceof Int8Array,
  isInt16Array: (v: any): boolean => v instanceof Int16Array,
  isInt32Array: (v: any): boolean => v instanceof Int32Array,
  isFloat32Array: (v: any): boolean => v instanceof Float32Array,
  isFloat64Array: (v: any): boolean => v instanceof Float64Array,
  isAnyArrayBuffer: (v: any): boolean =>
    v instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && v instanceof SharedArrayBuffer),
};

/** isDeepStrictEqual — deep strict comparison */
export function isDeepStrictEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) { if (!b.has(k) || !isDeepStrictEqual(v, b.get(k))) return false; }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) { if (!b.has(v)) return false; }
    return true;
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    const av = new Uint8Array((a as any).buffer, (a as any).byteOffset, (a as any).byteLength);
    const bv = new Uint8Array((b as any).buffer, (b as any).byteOffset, (b as any).byteLength);
    if (av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) { if (av[i] !== bv[i]) return false; }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepStrictEqual(a[key], b[key])) return false;
  }
  return true;
}

/** debuglog — create debug logger */
export function debuglog(section: string): (...args: any[]) => void {
  const env = typeof globalThis.process !== 'undefined' ? (globalThis.process as any).env?.NODE_DEBUG : '';
  const enabled = env ? new RegExp(`\\b${section}\\b`, 'i').test(env) : false;
  if (enabled) return (...args: any[]) => console.error('%s: %s', section.toUpperCase(), format(...args));
  return () => {};
}

/** debug — alias for debuglog */
export const debug = debuglog;

/** parseArgs — Node 22+ argument parser */
export function parseArgs(config?: {
  args?: string[];
  options?: Record<string, { type: 'string' | 'boolean'; short?: string; multiple?: boolean; default?: any }>;
  strict?: boolean;
  allowPositionals?: boolean;
  tokens?: boolean;
}): { values: Record<string, any>; positionals: string[] } {
  const args = config?.args ?? [];
  const options = config?.options ?? {};
  const allowPositionals = config?.allowPositionals ?? false;
  const values: Record<string, any> = {};
  const positionals: string[] = [];

  // Set defaults
  for (const [name, opt] of Object.entries(options)) {
    if (opt.default !== undefined) values[name] = opt.default;
    else if (opt.multiple) values[name] = [];
    else if (opt.type === 'boolean') values[name] = false;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') { positionals.push(...args.slice(i + 1)); break; }
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=', 2);
      const opt = options[key];
      if (opt) {
        const v = opt.type === 'boolean' ? (val ?? true) : (val ?? args[++i]);
        if (opt.multiple) (values[key] ??= []).push(v);
        else values[key] = v;
      } else if (config?.strict !== false) {
        throw new Error(`Unknown option: --${key}`);
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const short = arg[1];
      const entry = Object.entries(options).find(([, o]) => o.short === short);
      if (entry) {
        const [name, opt] = entry;
        const v = opt.type === 'boolean' ? true : args[++i];
        if (opt.multiple) (values[name] ??= []).push(v);
        else values[name] = v;
      }
    } else if (allowPositionals) {
      positionals.push(arg);
    }
  }

  return { values, positionals };
}

/** styleText — Node 22+ text styling */
export function styleText(style: string | string[], text: string): string {
  return text; // No ANSI in browser
}

/** getCallSites — Node 22+ call site info */
export function getCallSites(): Array<{ functionName: string; scriptName: string; lineNumber: number; column: number }> {
  const err = new Error();
  const lines = (err.stack ?? '').split('\n').slice(2);
  return lines.map(line => {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    return {
      functionName: match?.[1] ?? '<anonymous>',
      scriptName: match?.[2] ?? '<unknown>',
      lineNumber: parseInt(match?.[3] ?? '0', 10),
      column: parseInt(match?.[4] ?? '0', 10),
    };
  });
}

export default {
  format, formatWithOptions, inspect, inherits, deprecate, promisify, callbackify,
  types, isDeepStrictEqual, debuglog, debug, TextEncoder, TextDecoder,
  parseArgs, styleText, getCallSites,
};
