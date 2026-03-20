// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';
import { BindingUrl, type AdaExports } from '../../src/bindings/binding-url.js';

const wasmExists = hasWasm('ada');

describe.skipIf(!wasmExists)('ada.wasm — real WASI execution', () => {
  let binding: BindingUrl;

  async function initBinding() {
    const raw = await loadReactor('ada');
    binding = new BindingUrl();
    binding.init(raw as unknown as AdaExports);
    return binding;
  }

  it('should export ada_parse and ada_is_valid', async () => {
    const raw = await loadReactor('ada');
    expect((raw as any).ada_parse).toBeDefined();
    expect((raw as any).ada_is_valid).toBeDefined();
    expect((raw as any).ada_free).toBeDefined();
  });

  it('should parse a simple HTTP URL', async () => {
    const b = await initBinding();
    const url = b.parse('http://example.com/path?q=1#hash');

    expect(url.valid).toBe(true);
    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('example.com');
    expect(url.pathname).toBe('/path');
    expect(url.search).toBe('?q=1');
    expect(url.hash).toBe('#hash');
  });

  it('should parse HTTPS URL with port', async () => {
    const b = await initBinding();
    const url = b.parse('https://example.com:8443/api');

    expect(url.valid).toBe(true);
    expect(url.protocol).toBe('https:');
    expect(url.port).toBe('8443');
  });

  it('should normalize backslashes', async () => {
    const b = await initBinding();
    const url = b.parse('http://example.com\\path\\to\\resource');

    expect(url.valid).toBe(true);
    expect(url.pathname).toBe('/path/to/resource');
  });

  it('should handle URL with credentials', async () => {
    const b = await initBinding();
    const url = b.parse('http://user:pass@example.com/');

    expect(url.valid).toBe(true);
    expect(url.username).toBe('user');
    expect(url.password).toBe('pass');
  });

  it('should mark invalid URLs as not valid', async () => {
    const b = await initBinding();
    const url = b.parse('not a url at all');

    expect(url.valid).toBe(false);
  });

  it('should compute origin', async () => {
    const b = await initBinding();
    const url = b.parse('http://example.com:8080/path');

    expect(url.origin).toBe('http://example.com:8080');
  });
});
