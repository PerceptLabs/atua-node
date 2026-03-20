// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';
import {
  BindingZlib, type ZlibExports,
  Z_FINISH, Z_SYNC_FLUSH, Z_OK, Z_STREAM_END,
  Z_DEFAULT_COMPRESSION, Z_BEST_SPEED, Z_DEFAULT_STRATEGY,
} from '../../src/bindings/binding-zlib.js';

const wasmExists = hasWasm('zlib');

describe.skipIf(!wasmExists)('zlib.wasm — real WASI execution', () => {
  let exports: ZlibExports;
  let binding: BindingZlib;

  async function initBinding() {
    const raw = await loadReactor('zlib');
    exports = raw as unknown as ZlibExports;
    binding = new BindingZlib();
    binding.init(exports);
    return binding;
  }

  it('should export sizeof_z_stream', async () => {
    const raw = await loadReactor('zlib');
    const fn = (raw as any).sizeof_z_stream as Function;
    expect(fn).toBeDefined();
    const size = fn();
    // z_stream on wasm32: 56 bytes (standard layout)
    expect(size).toBeGreaterThanOrEqual(48);
    expect(size).toBeLessThanOrEqual(128);
  });

  it('should deflate and inflate roundtrip', async () => {
    const b = await initBinding();

    const original = new TextEncoder().encode(
      'Hello, real zlib compression! This is a test of the WASM zlib module. Repeated text helps compression ratio. Repeated text helps compression ratio.'
    );

    // Compress
    const deflate = b.createDeflate();
    const { data: compressed, rc: drc } = deflate.process(original, Z_FINISH);
    expect(drc).toBe(Z_STREAM_END);
    deflate.end();

    // Real compression should produce different (likely smaller) output
    expect(compressed.length).toBeGreaterThan(0);
    expect(compressed).not.toEqual(original);

    // Decompress
    const inflate = b.createInflate();
    const { data: decompressed } = inflate.process(compressed, Z_SYNC_FLUSH);
    inflate.end();

    expect(new TextDecoder().decode(decompressed)).toBe(new TextDecoder().decode(original));
  });

  it('should handle Z_SYNC_FLUSH correctly', async () => {
    const b = await initBinding();

    const input = new TextEncoder().encode('sync flush data');
    const deflate = b.createDeflate();
    const { rc } = deflate.process(input, Z_SYNC_FLUSH);
    expect(rc).toBe(Z_OK);
    deflate.end();
  });

  it('should support deflateParams mid-stream', async () => {
    const b = await initBinding();

    const deflate = b.createDeflate(Z_BEST_SPEED);
    deflate.process(new TextEncoder().encode('first chunk'), Z_SYNC_FLUSH);

    const rc = deflate.params(Z_DEFAULT_COMPRESSION, Z_DEFAULT_STRATEGY);
    expect(rc).toBe(Z_OK);

    deflate.process(new TextEncoder().encode('second chunk'), Z_SYNC_FLUSH);
    deflate.end();
  });
});
