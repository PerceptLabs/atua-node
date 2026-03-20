// @vitest-environment node
/**
 * Stress: Edge cases — known hard cases that break compat layers.
 * All operations use real .wasm — zero mocks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';
import { Z_FINISH, Z_SYNC_FLUSH } from '../../src/bindings/binding-zlib.js';
import * as crypto from '../../src/vendor/crypto.js';
import * as vm from '../../src/vendor/vm.js';
import { Buffer } from '../../src/vendor/buffer.js';
import { process } from '../../src/vendor/process.js';
import { EventLoop } from '../../src/libuv/phase-shim.js';

beforeAll(async () => {
  if (hasWasm('libcrypto')) bindingCrypto.init(await loadReactor('libcrypto') as any);
  if (hasWasm('zlib')) bindingZlib.init(await loadReactor('zlib') as any);
  if (hasWasm('ada')) bindingUrl.init(await loadReactor('ada') as any);
});

// ═══════════════════════════════════════════════════════════════
// BUFFER EDGE CASES
// ═══════════════════════════════════════════════════════════════
describe('Edge: Buffer', () => {
  it('Buffer.from("") — empty string → zero-length buffer', () => {
    const b = Buffer.from('');
    expect(b.length).toBe(0);
    expect(b instanceof Uint8Array).toBe(true);
  });

  it('Buffer.from([]) — empty array → zero-length buffer', () => {
    const b = Buffer.from([]);
    expect(b.length).toBe(0);
  });

  it('Buffer.alloc(0) — zero-length allocation', () => {
    const b = Buffer.alloc(0);
    expect(b.length).toBe(0);
    expect(b.toString()).toBe('');
  });

  it('Buffer.isEncoding("utf8") AND Buffer.isEncoding("utf-8") both true', () => {
    expect(Buffer.isEncoding('utf8')).toBe(true);
    expect(Buffer.isEncoding('utf-8')).toBe(true);
  });

  it('JSON.stringify(Buffer.from("test")) → correct serialization', () => {
    const b = Buffer.from('test');
    const json = JSON.stringify(b);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe('Buffer');
    expect(parsed.data).toEqual([116, 101, 115, 116]);
  });

  it('Buffer.from(arrayBuffer, offset, length) — sub-view', () => {
    const ab = new ArrayBuffer(10);
    const view = new Uint8Array(ab);
    for (let i = 0; i < 10; i++) view[i] = i;

    const b = Buffer.from(ab, 2, 5);
    expect(b.length).toBe(5);
    expect(b[0]).toBe(2);
    expect(b[4]).toBe(6);
  });

  it('byteLength for different encodings', () => {
    expect(Buffer.byteLength('hello', 'utf8')).toBe(5);
    expect(Buffer.byteLength('68656c6c6f', 'hex')).toBe(5);
    expect(Buffer.byteLength('aGVsbG8=', 'base64')).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROCESS EDGE CASES
// ═══════════════════════════════════════════════════════════════
describe('Edge: process', () => {
  it('nested nextTick: inner fires in same drain', () => {
    const order: number[] = [];
    process.nextTick(() => {
      order.push(1);
      process.nextTick(() => order.push(2));
    });
    process._eventLoop.tick();
    expect(order).toEqual([1, 2]);
  });

  it('3 nextTicks exhaust before setImmediate runs', () => {
    const loop = new EventLoop();
    const order: string[] = [];

    loop.queuePending(() => {
      loop.nextTick(() => order.push('tick1'));
      loop.nextTick(() => order.push('tick2'));
      loop.nextTick(() => order.push('tick3'));
      loop.setImmediate(() => order.push('immediate'));
    });

    loop.tick();

    const tick3Idx = order.indexOf('tick3');
    const immIdx = order.indexOf('immediate');
    expect(tick3Idx).toBeLessThan(immIdx);
  });

  it('process.env set + read + delete cycle', () => {
    process.env.EDGE_TEST = 'value';
    expect(process.env.EDGE_TEST).toBe('value');
    delete process.env.EDGE_TEST;
    expect(process.env.EDGE_TEST).toBeUndefined();
  });

  it('process.memoryUsage() has all expected keys', () => {
    const mu = process.memoryUsage();
    expect(mu).toHaveProperty('rss');
    expect(mu).toHaveProperty('heapTotal');
    expect(mu).toHaveProperty('heapUsed');
    expect(mu).toHaveProperty('external');
    expect(mu).toHaveProperty('arrayBuffers');
  });

  it('process.uptime() second call >= first call', () => {
    const t1 = process.uptime();
    const t2 = process.uptime();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});

// ═══════════════════════════════════════════════════════════════
// CRYPTO EDGE CASES
// ═══════════════════════════════════════════════════════════════
describe('Edge: crypto', () => {
  it('empty-input hash matches known SHA-256 value', () => {
    const h = crypto.createHash('sha256');
    h.update('');
    expect(h.digest('hex')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('Hash.copy() produces independent clone', () => {
    const original = crypto.createHash('sha256');
    original.update('hello');
    const clone = original.copy();

    original.update(' world');
    clone.update(' there');

    const d1 = original.digest('hex');
    const d2 = clone.digest('hex');

    expect(d1).not.toBe(d2);
    // "hello world" vs "hello there" → different digests
    expect(d1.length).toBe(64);
    expect(d2.length).toBe(64);
  });

  it('multiple update() calls = single concatenated update', () => {
    const h1 = crypto.createHash('sha256');
    h1.update('hello');
    h1.update(' ');
    h1.update('world');
    const d1 = h1.digest('hex');

    const h2 = crypto.createHash('sha256');
    h2.update('hello world');
    const d2 = h2.digest('hex');

    expect(d1).toBe(d2);
  });

  it('randomBytes(0).length === 0', () => {
    expect(crypto.randomBytes(0).length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// VM EDGE CASES
// ═══════════════════════════════════════════════════════════════
describe('Edge: vm', () => {
  it('error types propagate: TypeError in vm → catch TypeError in host', () => {
    try {
      vm.runInNewContext('null.x');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
    }
  });

  it('ReferenceError for undefined variable', () => {
    try {
      vm.runInNewContext('undeclaredVariable');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ReferenceError);
    }
  });

  it('return complex value from sandbox', () => {
    const result = vm.runInNewContext('({ a: 1, b: [2, 3], c: { d: 4 } })');
    expect(result).toEqual({ a: 1, b: [2, 3], c: { d: 4 } });
  });

  it('sandbox function called from vm code', () => {
    const result = vm.runInNewContext('fn(5)', { fn: (n: number) => n * n });
    expect(result).toBe(25);
  });
});

// ═══════════════════════════════════════════════════════════════
// EVENT LOOP EDGE CASES
// ═══════════════════════════════════════════════════════════════
describe('Edge: event loop', () => {
  it('timer ordering: setTimeout(fn,0) fires before setTimeout(fn,10000)', () => {
    const loop = new EventLoop();
    const order: string[] = [];

    loop.setTimeout(() => order.push('fast'), 0);
    loop.setTimeout(() => order.push('slow'), 10000);

    loop.tick();

    expect(order).toContain('fast');
    expect(order).not.toContain('slow'); // 10s timer hasn't expired
  });

  it('clearTimer prevents execution', () => {
    const loop = new EventLoop();
    let called = false;
    const id = loop.setTimeout(() => { called = true; }, 0);
    loop.clearTimer(id);
    loop.tick();
    expect(called).toBe(false);
  });

  it('setImmediate fires in check phase', () => {
    const loop = new EventLoop();
    let phase: string | null = null;
    loop.setImmediate(() => { phase = loop.phase; });
    loop.tick();
    expect(phase).toBe('check');
  });
});

// ═══════════════════════════════════════════════════════════════
// ZLIB EDGE CASES
// ═══════════════════════════════════════════════════════════════
describe('Edge: zlib', () => {
  it('compress then decompress empty data', () => {
    const d = bindingZlib.createDeflate();
    const { data: compressed } = d.process(new Uint8Array(0), Z_FINISH);
    d.end();

    const inf = bindingZlib.createInflate();
    const { data: decompressed } = inf.process(compressed, Z_SYNC_FLUSH);
    inf.end();

    expect(decompressed.length).toBe(0);
  });

  it('double end() does not throw', () => {
    const d = bindingZlib.createDeflate();
    d.end();
    d.end(); // second call should be safe
  });
});
