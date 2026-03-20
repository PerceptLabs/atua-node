import { describe, it, expect, vi } from 'vitest';

const { mockInit } = vi.hoisted(() => ({ mockInit: vi.fn() }));
vi.mock('@wasmer/sdk', () => ({ init: mockInit }));

import * as crypto from '../../src/vendor/crypto.js';

describe('crypto module facade', () => {
  it('should export createHash', () => {
    expect(crypto.createHash).toBeDefined();
    expect(typeof crypto.createHash).toBe('function');
  });

  it('should export createCipheriv and createDecipheriv', () => {
    expect(crypto.createCipheriv).toBeDefined();
    expect(crypto.createDecipheriv).toBeDefined();
  });

  it('should export createDiffieHellman', () => {
    expect(crypto.createDiffieHellman).toBeDefined();
  });

  it('should export randomBytes', () => {
    expect(crypto.randomBytes).toBeDefined();
  });

  it('should export randomUUID', () => {
    const uuid = crypto.randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should list supported hashes', () => {
    const hashes = crypto.getHashes();
    expect(hashes).toContain('sha256');
    expect(hashes).toContain('sha512');
    expect(hashes).toContain('sha1');
    expect(hashes).toContain('md5');
  });

  it('should list supported ciphers', () => {
    const ciphers = crypto.getCiphers();
    expect(ciphers).toContain('aes-256-gcm');
    expect(ciphers).toContain('des-cbc');
    expect(ciphers).toContain('rc4');
    expect(ciphers).toContain('bf-cbc');
  });
});
