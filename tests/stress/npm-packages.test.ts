// @vitest-environment node
/**
 * Stress: Real package API patterns.
 * Reproduces call sequences from Express, jsonwebtoken, dotenv, archiver, EJS.
 * All operations use real .wasm — zero mocks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadReactor, hasWasm } from '../wasm-real/_loader.js';
import { bindingCrypto } from '../../src/bindings/binding-crypto.js';
import { bindingZlib } from '../../src/bindings/binding-zlib.js';
import { bindingUrl } from '../../src/bindings/binding-url.js';
import { Z_FINISH, Z_SYNC_FLUSH } from '../../src/bindings/binding-zlib.js';
import * as crypto from '../../src/vendor/crypto.js';
import * as zlib from '../../src/vendor/zlib.js';
import * as vm from '../../src/vendor/vm.js';
import * as fs from '../../src/vendor/fs.js';
import { Buffer } from '../../src/vendor/buffer.js';
import { process } from '../../src/vendor/process.js';

beforeAll(async () => {
  if (hasWasm('libcrypto')) bindingCrypto.init(await loadReactor('libcrypto') as any);
  if (hasWasm('zlib')) bindingZlib.init(await loadReactor('zlib') as any);
  if (hasWasm('ada')) bindingUrl.init(await loadReactor('ada') as any);
});

// ═══════════════════════════════════════════════════════════════
// EXPRESS PATTERNS
// ═══════════════════════════════════════════════════════════════
describe('Express patterns', () => {
  it('req/res object shape matches Express expectations', () => {
    const req = { method: 'GET', url: '/api/users', headers: { host: 'localhost:3000', 'content-type': 'application/json' } };
    const res = {
      statusCode: 200,
      _headers: new Map<string, string>(),
      setHeader(name: string, value: string) { this._headers.set(name.toLowerCase(), value); },
      getHeader(name: string) { return this._headers.get(name.toLowerCase()); },
      end(body?: string) { return body; },
    };

    expect(req.method).toBe('GET');
    expect(req.url).toBe('/api/users');
    res.setHeader('Content-Type', 'application/json');
    expect(res.getHeader('content-type')).toBe('application/json');
    res.statusCode = 404;
    expect(res.statusCode).toBe(404);
  });

  it('middleware next() chain executes in order', () => {
    const order: string[] = [];
    type Middleware = (req: any, res: any, next: () => void) => void;

    const mw1: Middleware = (_req, _res, next) => { order.push('mw1'); next(); };
    const mw2: Middleware = (_req, _res, next) => { order.push('mw2'); next(); };
    const mw3: Middleware = (_req, _res, _next) => { order.push('mw3'); };

    const stack = [mw1, mw2, mw3];
    let idx = 0;
    function next() { if (idx < stack.length) stack[idx++]({}, {}, next); }
    next();

    expect(order).toEqual(['mw1', 'mw2', 'mw3']);
  });

  it('error middleware detected by 4-arg function.length', () => {
    const normalMw = (_req: any, _res: any, _next: any) => {};
    const errorMw = (_err: any, _req: any, _res: any, _next: any) => {};
    expect(normalMw.length).toBe(3);
    expect(errorMw.length).toBe(4);
  });

  it('JSON body parsing via Buffer.concat + JSON.parse', () => {
    const chunks = [
      Buffer.from('{"user'),
      Buffer.from('name":"'),
      Buffer.from('test"}'),
    ];
    const body = Buffer.concat(chunks);
    const parsed = JSON.parse(body.toString('utf8'));
    expect(parsed.username).toBe('test');
  });
});

// ═══════════════════════════════════════════════════════════════
// JSONWEBTOKEN PATTERNS
// ═══════════════════════════════════════════════════════════════
describe('jsonwebtoken patterns', () => {
  it('HMAC-SHA256 + base64url encoding for JWT signature', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: '1234567890', name: 'Test', iat: 1516239022 })).toString('base64url');
    const signingInput = `${header}.${payload}`;

    const hmac = crypto.createHmac('sha256', 'super-secret-key');
    hmac.update(signingInput);
    const signature = hmac.digest('base64url');

    expect(signature.length).toBeGreaterThan(0);
    expect(signature).not.toContain('+');
    expect(signature).not.toContain('/');
    expect(signature).not.toContain('=');

    const token = `${header}.${payload}.${signature}`;
    const parts = token.split('.');
    expect(parts.length).toBe(3);
  });

  it('decode base64url payload', () => {
    const payload = { sub: '1234', name: 'Test User' };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    expect(decoded.sub).toBe('1234');
    expect(decoded.name).toBe('Test User');
  });
});

// ═══════════════════════════════════════════════════════════════
// DOTENV PATTERNS
// ═══════════════════════════════════════════════════════════════
describe('dotenv patterns', () => {
  it('parse KEY=VALUE with quotes and comments', () => {
    const envFile = `
# This is a comment
DB_HOST=localhost
DB_PORT=5432
DB_NAME="my_database"
SECRET_KEY='s3cr3t'
EMPTY=
# Another comment
MULTIWORD=hello world
`.trim();

    fs.writeFileSync('/.env', envFile);
    const content = fs.readFileSync('/.env', 'utf8') as string;

    const parsed: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx);
      let value = trimmed.substring(eqIdx + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      parsed[key] = value;
    }

    expect(parsed.DB_HOST).toBe('localhost');
    expect(parsed.DB_PORT).toBe('5432');
    expect(parsed.DB_NAME).toBe('my_database');
    expect(parsed.SECRET_KEY).toBe('s3cr3t');
    expect(parsed.EMPTY).toBe('');
    expect(parsed.MULTIWORD).toBe('hello world');

    // Mutate process.env
    Object.assign(process.env, parsed);
    expect(process.env.DB_HOST).toBe('localhost');
  });
});

// ═══════════════════════════════════════════════════════════════
// ARCHIVER / COMPRESSION PATTERNS
// ═══════════════════════════════════════════════════════════════
describe('archiver/compression patterns', () => {
  it('gzip with custom windowBits and memLevel', () => {
    const gz = zlib.createGzip({ windowBits: 15, memLevel: 9 });
    const data = new TextEncoder().encode('Compressed file content for archiver test');
    const compressed = gz.processChunk(data, 4); // Z_FINISH
    gz.close();
    expect(compressed.length).toBeGreaterThan(0);
  });

  it('multiple files compressed in sequence', () => {
    const files = ['file1.txt content here', 'file2.txt more content', 'file3.txt final data'];
    const compressed: Uint8Array[] = [];

    for (const content of files) {
      const d = bindingZlib.createDeflate();
      const { data } = d.process(new TextEncoder().encode(content), Z_FINISH);
      d.end();
      compressed.push(data);
    }

    expect(compressed.length).toBe(3);
    compressed.forEach(c => expect(c.length).toBeGreaterThan(0));

    // Verify each decompresses correctly
    files.forEach((content, i) => {
      const inf = bindingZlib.createInflate();
      const { data } = inf.process(compressed[i], Z_SYNC_FLUSH);
      inf.end();
      expect(new TextDecoder().decode(data)).toBe(content);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// EJS / TEMPLATE ENGINE PATTERNS
// ═══════════════════════════════════════════════════════════════
describe('EJS/template engine patterns', () => {
  it('vm.runInNewContext with function sandbox (template rendering)', () => {
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const templateCode = `escape('<script>alert("xss")</script>')`;
    const result = vm.runInNewContext(templateCode, { escape });
    expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('Script reused with different locals', () => {
    const script = new vm.Script('greeting + " " + name + "!"');
    const results = [
      script.runInNewContext({ greeting: 'Hello', name: 'Alice' }),
      script.runInNewContext({ greeting: 'Hi', name: 'Bob' }),
      script.runInNewContext({ greeting: 'Hey', name: 'Charlie' }),
    ];
    expect(results).toEqual(['Hello Alice!', 'Hi Bob!', 'Hey Charlie!']);
  });

  it('template with conditionals and loops', () => {
    const code = `
      items.filter(function(item) { return item.active; })
           .map(function(item) { return item.name; })
           .join(", ")
    `;
    const result = vm.runInNewContext(code, {
      items: [
        { name: 'Apple', active: true },
        { name: 'Banana', active: false },
        { name: 'Cherry', active: true },
      ],
    });
    expect(result).toBe('Apple, Cherry');
  });
});
