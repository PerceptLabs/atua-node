// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';
import {
  BindingHttpParser, HttpParser, HPE, HTTP_REQUEST, HTTP_RESPONSE,
  type LlhttpExports,
} from '../../src/bindings/binding-http-parser.js';

const wasmExists = hasWasm('llhttp');

describe.skipIf(!wasmExists)('llhttp.wasm — real WASI execution', () => {
  let exports: LlhttpExports;
  let binding: BindingHttpParser;

  async function initBinding() {
    const raw = await loadReactor('llhttp');
    exports = raw as unknown as LlhttpExports;
    binding = new BindingHttpParser();
    binding.init(exports);
    return binding;
  }

  it('should export sizeof_llhttp and llhttp_init', async () => {
    const raw = await loadReactor('llhttp');
    expect((raw as any).sizeof_llhttp).toBeDefined();
    expect((raw as any).llhttp_init).toBeDefined();
    expect((raw as any).llhttp_execute).toBeDefined();

    const size = ((raw as any).sizeof_llhttp as Function)();
    expect(size).toBeGreaterThan(0);
  });

  it('should parse a valid GET request', async () => {
    const b = await initBinding();
    const parser = b.createParser(HTTP_REQUEST);

    const request = 'GET /path?q=1 HTTP/1.1\r\nHost: example.com\r\n\r\n';
    const rc = parser.execute(new TextEncoder().encode(request));

    expect(rc).toBe(HPE.OK);
    expect(parser.message.method).toBe('GET');
    expect(parser.message.versionMajor).toBe(1);
    expect(parser.message.versionMinor).toBe(1);
    parser.free();
  });

  it('should parse a POST request', async () => {
    const b = await initBinding();
    const parser = b.createParser(HTTP_REQUEST);

    const request = 'POST /api HTTP/1.1\r\nHost: api.example.com\r\nContent-Length: 5\r\n\r\nhello';
    const rc = parser.execute(new TextEncoder().encode(request));

    expect(rc).toBe(HPE.OK);
    expect(parser.message.method).toBe('POST');
    parser.free();
  });

  it('should detect malformed requests with HPE error codes', async () => {
    const b = await initBinding();
    const parser = b.createParser(HTTP_REQUEST);

    // Invalid request line — should return an error
    const malformed = 'INVALID\r\n\r\n';
    const rc = parser.execute(new TextEncoder().encode(malformed));

    // llhttp should return a non-zero error code
    expect(rc).not.toBe(HPE.OK);
    parser.free();
  });

  it('should parse an HTTP response', async () => {
    const b = await initBinding();
    const parser = b.createParser(HTTP_RESPONSE);

    const response = 'HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello';
    const rc = parser.execute(new TextEncoder().encode(response));

    expect(rc).toBe(HPE.OK);
    expect(parser.message.statusCode).toBe(200);
    parser.free();
  });
});
