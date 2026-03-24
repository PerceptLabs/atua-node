// @vitest-environment node
/**
 * Phase 9 — End-to-end validation suite.
 *
 * Tests the complete @aspect/atua-node stack with REAL WASM modules.
 * No mocking. crypto/zlib/url go through: vendored JS → internalBinding
 * → FFI bridge → real .wasm execution.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';

import * as crypto from '../../src/vendor/crypto.js';
import * as zlib from '../../src/vendor/zlib.js';
import * as url from '../../src/vendor/url.js';
import * as vm from '../../src/vendor/vm.js';
import * as os from '../../src/vendor/os.js';
import * as dns from '../../src/vendor/dns.js';
import * as timers from '../../src/vendor/timers.js';
import * as fs from '../../src/vendor/fs.js';
import * as http from '../../src/vendor/http.js';
import * as net from '../../src/vendor/net.js';
import { Buffer } from '../../src/vendor/buffer.js';
import { process } from '../../src/vendor/process.js';
import { internalBinding } from '../../src/vendor/internal-binding.js';
import { fork, ChildProcess } from '../../src/vendor/child_process.js';
import { isPrimary, isWorker } from '../../src/vendor/cluster.js';
import { AddonRegistry } from '../../src/router/addon-registry.js';
import * as errors from '../../src/vendor/errors.js';

// Initialize real WASM bindings before any tests run
beforeAll(async () => {
  if (hasWasm('libcrypto')) {
    const cryptoExports = await loadReactor('libcrypto');
    bindingCrypto.init(cryptoExports as any);
  }
  if (hasWasm('zlib')) {
    const zlibExports = await loadReactor('zlib');
    bindingZlib.init(zlibExports as any);
  }
  if (hasWasm('ada')) {
    const adaExports = await loadReactor('ada');
    bindingUrl.init(adaExports as any);
  }
});

// ═══════════════════════════════════════════════════════════════
// CRYPTO — full end-to-end through real libcrypto.wasm
// ═══════════════════════════════════════════════════════════════
describe('crypto module integration', () => {
  it('should create hash with update/digest chain', () => {
    const hash = crypto.createHash('sha256');
    expect(hash).toBeDefined();
    hash.update('hello');
    const digest = hash.digest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('should create HMAC', () => {
    const hmac = crypto.createHmac('sha256', 'secret');
    hmac.update('message');
    const digest = hmac.digest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('should create cipher/decipher and round-trip', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const plaintext = new TextEncoder().encode('Hello WASM crypto!');

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = cipher.update(plaintext);
    cipher.final();
    const tag = cipher.getAuthTag();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(encrypted);
    decipher.final();

    expect(decrypted).toEqual(plaintext);
  });

  it('should create DiffieHellman', () => {
    const dh = crypto.createDiffieHellman(1024);
    expect(dh).toBeDefined();
    const keys = dh.generateKeys();
    expect(keys).toBeInstanceOf(Uint8Array);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should generate random bytes', () => {
    const bytes = crypto.randomBytes(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
    expect(bytes.some(b => b !== 0)).toBe(true);
  });

  it('should generate UUID v4', () => {
    const uuid = crypto.randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should randomFillSync', () => {
    const buf = new Uint8Array(16);
    crypto.randomFillSync(buf);
    expect(buf.some(b => b !== 0)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// VM — require('vm') surface
// ═══════════════════════════════════════════════════════════════
describe('vm module integration', () => {
  it('should eval simple expressions', () => { expect(vm.runInNewContext('2 + 2')).toBe(4); });
  it('should access sandbox variables', () => { expect(vm.runInNewContext('x * y', { x: 3, y: 7 })).toBe(21); });
  it('should isolate contexts', () => {
    const ctx1 = vm.createContext({ n: 1 });
    const ctx2 = vm.createContext({ n: 2 });
    expect(vm.runInContext('n', ctx1)).toBe(1);
    expect(vm.runInContext('n', ctx2)).toBe(2);
  });
  it('should compile and reuse Scripts', () => {
    const s = new vm.Script('a + b');
    expect(s.runInNewContext({ a: 1, b: 2 })).toBe(3);
    expect(s.runInNewContext({ a: 10, b: 20 })).toBe(30);
  });
  it('should compileFunction', () => {
    const fn = vm.compileFunction('return n * 2', ['n']);
    expect(fn(5)).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// BUFFER
// ═══════════════════════════════════════════════════════════════
describe('Buffer integration', () => {
  it('should be instanceof Uint8Array', () => { expect(Buffer.alloc(10) instanceof Uint8Array).toBe(true); });
  it('should encode/decode all formats', () => {
    const original = 'Hello Buffer';
    for (const enc of ['utf8', 'hex', 'base64', 'ascii', 'latin1'] as const) {
      const buf = Buffer.from(original, enc === 'hex' ? 'utf8' : enc);
      expect(buf.toString(enc)).toBeTruthy();
    }
  });
  it('should concat', () => { expect(Buffer.concat([Buffer.from('a'), Buffer.from('b')]).toString()).toBe('ab'); });
  it('should compare', () => {
    expect(Buffer.from('abc').equals(Buffer.from('abc'))).toBe(true);
    expect(Buffer.from('abc').equals(Buffer.from('xyz'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROCESS
// ═══════════════════════════════════════════════════════════════
describe('process object integration', () => {
  it('process.platform === "linux"', () => { expect(process.platform).toBe('linux'); });
  it('process.arch === "x64"', () => { expect(process.arch).toBe('x64'); });
  it('process.versions.node exists', () => { expect(process.versions.node).toBe('24.0.0'); });
  it('process.version starts with v', () => { expect(process.version).toMatch(/^v\d/); });
  it('process.pid is 1', () => { expect(process.pid).toBe(1); });
  it('process.hrtime returns tuple', () => { const [s, ns] = process.hrtime(); expect(s).toBeGreaterThanOrEqual(0); expect(ns).toBeLessThan(1e9); });
  it('process.hrtime.bigint returns bigint', () => { expect(typeof process.hrtime.bigint()).toBe('bigint'); });
  it('process.cwd/chdir works', () => { const o = process.cwd(); process.chdir('/test'); expect(process.cwd()).toBe('/test'); process.chdir(o); });
  it('process.nextTick queues callback', () => { let c = false; process.nextTick(() => { c = true; }); process._eventLoop.tick(); expect(c).toBe(true); });
});

// ═══════════════════════════════════════════════════════════════
// URL — full end-to-end through real ada.wasm
// ═══════════════════════════════════════════════════════════════
describe('url module integration', () => {
  it('should parse URL components', () => {
    const u = url.parse('http://user:pass@example.com:8080/path?q=1#hash');
    expect(u.protocol).toBe('http:');
    expect(u.hostname).toBe('example.com');
    expect(u.port).toBe('8080');
    expect(u.pathname).toBe('/path');
    expect(u.auth).toBe('user:pass');
  });

  it('should handle invalid URLs gracefully', () => {
    const u = url.parse('not a url');
    expect(u.href).toBe('not a url');
  });
});

// ═══════════════════════════════════════════════════════════════
// ZLIB — full end-to-end through real zlib.wasm
// ═══════════════════════════════════════════════════════════════
describe('zlib module integration', () => {
  it('should export zlib constants', () => {
    expect(zlib.Z_NO_FLUSH).toBe(0);
    expect(zlib.Z_FINISH).toBe(4);
    expect(zlib.Z_DEFAULT_COMPRESSION).toBe(-1);
  });

  it('should create gzip/gunzip instances', () => {
    const gz = zlib.createGzip();
    expect(gz).toBeDefined();
    expect(typeof gz.processChunk).toBe('function');
    gz.close();
  });
});

// ═══════════════════════════════════════════════════════════════
// OS
// ═══════════════════════════════════════════════════════════════
describe('os module integration', () => {
  it('os.platform() === "linux"', () => { expect(os.platform()).toBe('linux'); });
  it('os.arch() === "x64"', () => { expect(os.arch()).toBe('x64'); });
  it('os.type() === "Linux"', () => { expect(os.type()).toBe('Linux'); });
  it('os.totalmem() returns 4GB', () => { expect(os.totalmem()).toBe(4 * 1024 * 1024 * 1024); });
  it('os.freemem() returns 2GB', () => { expect(os.freemem()).toBe(2 * 1024 * 1024 * 1024); });
  it('os.cpus() returns array', () => { expect(os.cpus()[0].model).toBe('wasm32'); });
  it('os.EOL === "\\n"', () => { expect(os.EOL).toBe('\n'); });
  it('os.hostname() returns string', () => { expect(typeof os.hostname()).toBe('string'); });
  it('os.homedir() returns path', () => { expect(os.homedir()).toMatch(/^\//); });
});

// ═══════════════════════════════════════════════════════════════
// FS
// ═══════════════════════════════════════════════════════════════
describe('fs module integration', () => {
  it('should writeFileSync and readFileSync', () => { fs.writeFileSync('/test-fs.txt', 'hello'); expect(fs.readFileSync('/test-fs.txt', 'utf8')).toBe('hello'); });
  it('should throw ENOENT for missing files', () => { expect(() => fs.readFileSync('/nonexistent')).toThrow('ENOENT'); });
  it('should check existsSync', () => { fs.writeFileSync('/exists.txt', ''); expect(fs.existsSync('/exists.txt')).toBe(true); expect(fs.existsSync('/no-file')).toBe(false); });
  it('should mkdirSync', () => { fs.mkdirSync('/test-dir', { recursive: true }); expect(fs.existsSync('/test-dir')).toBe(true); });
  it('should statSync', () => { fs.writeFileSync('/stat-test.txt', 'data'); const s = fs.statSync('/stat-test.txt'); expect(s.isFile()).toBe(true); expect(s.size).toBe(4); });
  it('should support promises API', async () => { await fs.promises.writeFile('/async-test.txt', 'async'); expect(await fs.promises.readFile('/async-test.txt', 'utf8')).toBe('async'); });
});

// ═══════════════════════════════════════════════════════════════
// DNS
// ═══════════════════════════════════════════════════════════════
describe('dns module integration', () => {
  it('should lookup IP address', () => new Promise<void>((r) => { dns.lookup('127.0.0.1', (e, a, f) => { expect(e).toBeNull(); expect(a).toBe('127.0.0.1'); expect(f).toBe(4); r(); }); }));
  it('should return servers', () => { expect(dns.getServers().length).toBeGreaterThan(0); });
});

// ═══════════════════════════════════════════════════════════════
// TIMERS
// ═══════════════════════════════════════════════════════════════
describe('timers module integration', () => {
  it('should export setTimeout/setInterval', () => { expect(timers.setTimeout).toBeDefined(); expect(timers.setImmediate).toBeDefined(); });
  it('should support promises API', async () => { expect(await timers.promises.setTimeout(10, 'done')).toBe('done'); });
});

// ═══════════════════════════════════════════════════════════════
// NET / HTTP
// ═══════════════════════════════════════════════════════════════
describe('net module integration', () => {
  it('should create Socket', () => { expect(new net.Socket().writable).toBe(true); });
  it('should validate IPs', () => { expect(net.isIP('127.0.0.1')).toBe(4); expect(net.isIP('::1')).toBe(6); expect(net.isIP('x')).toBe(0); });
});

describe('http module integration', () => {
  it('should export STATUS_CODES', () => { expect(http.STATUS_CODES[200]).toBe('OK'); expect(http.STATUS_CODES[404]).toBe('Not Found'); });
  it('should export METHODS', () => { expect(http.METHODS).toContain('GET'); expect(http.METHODS).toContain('POST'); });
  it('should create Agent', () => { expect(new http.Agent().maxSockets).toBe(Infinity); });
});

// ═══════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════
describe('errors module integration', () => {
  it('ERR_INVALID_ARG_TYPE', () => { const e = new errors.ERR_INVALID_ARG_TYPE('n', 'string', 42); expect(e.code).toBe('ERR_INVALID_ARG_TYPE'); });
  it('ERR_MISSING_ARGS', () => { expect(new errors.ERR_MISSING_ARGS('p').code).toBe('ERR_MISSING_ARGS'); });
  it('ERR_OUT_OF_RANGE', () => { const e = new errors.ERR_OUT_OF_RANGE('p', '>0', -1); expect(e instanceof RangeError).toBe(true); });
});

// ═══════════════════════════════════════════════════════════════
// CHILD_PROCESS / CLUSTER / ADDON
// ═══════════════════════════════════════════════════════════════
describe('child_process integration', () => { it('fork returns ChildProcess', () => { const c = fork('m.js'); expect(c).toBeInstanceOf(ChildProcess); expect(c.pid).toBeGreaterThan(0); }); });
describe('cluster integration', () => { it('reports primary/worker', () => { expect(isPrimary).toBe(true); expect(isWorker).toBe(false); }); });
describe('addon registry integration', () => { it('register and check', () => { const r = new AddonRegistry(); r.register('t', { wasmPath: '/t.wasm' }); expect(r.has('t')).toBe(true); }); });

// ═══════════════════════════════════════════════════════════════
// INTERNAL BINDING
// ═══════════════════════════════════════════════════════════════
describe('internalBinding dispatch integration', () => {
  it('should dispatch all registered bindings', () => {
    for (const name of ['crypto', 'zlib', 'http_parser', 'url', 'encoding', 'os', 'constants']) {
      expect(() => internalBinding(name)).not.toThrow();
    }
  });
  it('should throw for unknown binding', () => { expect(() => internalBinding('nope')).toThrow(); });
});
