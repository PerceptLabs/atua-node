/**
 * Node.js crypto module facade.
 *
 * Provides the public require('crypto') API by delegating to
 * internalBinding('crypto') which wraps libcrypto.wasm.
 */

import { internalBinding } from './internal-binding.js';

const binding = internalBinding('crypto') as {
  Hash: new (algorithm: string) => { update(data: Uint8Array | string): any; digest(encoding?: string): any; copy(): any };
  Hmac: new (algorithm: string, key: Uint8Array | string) => { update(data: Uint8Array | string): any; digest(encoding?: string): any };
  CipherBase: new (algorithm: string, key: Uint8Array, iv: Uint8Array, encrypt: boolean) => {
    update(data: Uint8Array): Uint8Array;
    final(): Uint8Array;
    getAuthTag(): Uint8Array;
    setAuthTag(tag: Uint8Array): void;
    setAAD(aad: Uint8Array): void;
  };
  DiffieHellman: new (sizeOrPrime?: number | Uint8Array, generator?: number) => {
    generateKeys(): Uint8Array;
    getPublicKey(): Uint8Array;
    computeSecret(key: Uint8Array): Uint8Array;
  };
  randomBytes(size: number): Uint8Array;
};

export function createHash(algorithm: string) {
  return new binding.Hash(algorithm);
}

export function createHmac(algorithm: string, key: Uint8Array | string) {
  return new binding.Hmac(algorithm, key);
}

export function createCipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array) {
  return new binding.CipherBase(algorithm, key, iv, true);
}

export function createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array) {
  return new binding.CipherBase(algorithm, key, iv, false);
}

export function createDiffieHellman(sizeOrPrime: number | Uint8Array, generator?: number) {
  return new binding.DiffieHellman(sizeOrPrime, generator);
}

function getRandomBytes(size: number): Uint8Array {
  // Use browser crypto when WASM binding isn't initialized
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint8Array(size);
    globalThis.crypto.getRandomValues(buf);
    return buf;
  }
  return binding.randomBytes(size);
}

export function randomBytes(size: number): Uint8Array;
export function randomBytes(size: number, callback: (err: Error | null, buf: Uint8Array) => void): void;
export function randomBytes(size: number, callback?: (err: Error | null, buf: Uint8Array) => void): Uint8Array | void {
  const buf = getRandomBytes(size);
  if (callback) {
    queueMicrotask(() => callback(null, buf));
    return;
  }
  return buf;
}

export function randomFillSync(buf: Uint8Array, offset?: number, size?: number): Uint8Array {
  const o = offset ?? 0;
  const s = size ?? buf.length - o;
  const random = getRandomBytes(s);
  buf.set(random, o);
  return buf;
}

export function randomUUID(): string {
  // Use browser crypto.randomUUID if available (faster, always works)
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback to our WASM-backed randomBytes
  const bytes = binding.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getHashes(): string[] {
  return ['sha256', 'sha512', 'sha1', 'md5'];
}

export function getCiphers(): string[] {
  return ['aes-256-gcm', 'aes-256-cbc', 'aes-128-gcm', 'aes-128-cbc', 'des-cbc', 'rc4', 'bf-cbc', 'chacha20-poly1305'];
}

export const constants = {
  DH_CHECK_P_NOT_SAFE_PRIME: 2,
  DH_CHECK_P_NOT_PRIME: 1,
  RSA_PKCS1_PADDING: 1,
  RSA_NO_PADDING: 3,
  RSA_PKCS1_OAEP_PADDING: 4,
};

export default {
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  createDiffieHellman,
  randomBytes,
  randomFillSync,
  randomUUID,
  getHashes,
  getCiphers,
  constants,
};
