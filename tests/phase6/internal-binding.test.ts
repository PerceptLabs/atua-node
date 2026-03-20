import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInit } = vi.hoisted(() => ({ mockInit: vi.fn() }));
vi.mock('@wasmer/sdk', () => ({ init: mockInit }));

import { internalBinding } from '../../src/vendor/internal-binding.js';

describe('internalBinding dispatch', () => {
  it('should return crypto binding with Hash constructor', () => {
    const crypto = internalBinding('crypto') as any;
    expect(crypto.Hash).toBeDefined();
    expect(crypto.Hmac).toBeDefined();
    expect(crypto.CipherBase).toBeDefined();
    expect(crypto.DiffieHellman).toBeDefined();
    expect(crypto.randomBytes).toBeDefined();
  });

  it('should return zlib binding with Zlib constructor', () => {
    const zlib = internalBinding('zlib') as any;
    expect(zlib.Zlib).toBeDefined();
    expect(zlib.Z_NO_FLUSH).toBe(0);
    expect(zlib.Z_FINISH).toBe(4);
  });

  it('should return http_parser binding', () => {
    const parser = internalBinding('http_parser') as any;
    expect(parser.HTTPParser).toBeDefined();
    expect(parser.HTTP_REQUEST).toBe(1);
  });

  it('should return url binding with parse function', () => {
    const url = internalBinding('url') as any;
    expect(url.parse).toBeDefined();
  });

  it('should return os binding with real values', () => {
    const os = internalBinding('os') as any;
    expect(os.platform()).toBe('linux');
    expect(os.arch()).toBe('x64');
    expect(os.type()).toBe('Linux');
    expect(os.totalmem()).toBe(4 * 1024 * 1024 * 1024);
    expect(os.freemem()).toBe(2 * 1024 * 1024 * 1024);
    expect(os.cpus()).toHaveLength(1);
    expect(os.cpus()[0].model).toBe('wasm32');
    expect(os.EOL).toBe('\n');
  });

  it('should return constants binding', () => {
    const constants = internalBinding('constants') as any;
    expect(constants.fs.O_RDONLY).toBe(0);
    expect(constants.fs.O_WRONLY).toBe(1);
    expect(constants.os.signals.SIGTERM).toBe(15);
  });

  it('should throw for unknown bindings', () => {
    expect(() => internalBinding('nonexistent')).toThrow("No such binding: 'nonexistent'");
  });
});
