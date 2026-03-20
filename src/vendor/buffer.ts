/**
 * Node.js Buffer implementation.
 *
 * Buffer extends Uint8Array with encoding support and Node.js API surface.
 * All encodings: utf8, ascii, base64, base64url, hex, binary/latin1, utf16le/ucs2.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export class Buffer extends Uint8Array {
  // ── Static constructors ───────────────────────────────────

  static alloc(size: number, fill?: number | string | Uint8Array, encoding?: string): Buffer {
    const buf = new Buffer(size);
    if (fill !== undefined) {
      if (typeof fill === 'number') {
        buf.fill(fill);
      } else if (typeof fill === 'string') {
        const bytes = Buffer.from(fill, encoding);
        for (let i = 0; i < size; i++) buf[i] = bytes[i % bytes.length];
      } else {
        for (let i = 0; i < size; i++) buf[i] = fill[i % fill.length];
      }
    }
    return buf;
  }

  static allocUnsafe(size: number): Buffer {
    return new Buffer(size);
  }

  static from(value: string | ArrayBuffer | Uint8Array | number[] | Buffer, encodingOrOffset?: string | number, length?: number): Buffer {
    if (typeof value === 'string') {
      return Buffer._fromString(value, (encodingOrOffset as string) ?? 'utf8');
    }
    if (value instanceof ArrayBuffer) {
      const offset = (encodingOrOffset as number) ?? 0;
      const len = length ?? (value.byteLength - offset);
      const buf = new Buffer(new Uint8Array(value, offset, len));
      return buf;
    }
    if (value instanceof Uint8Array || Array.isArray(value)) {
      const buf = new Buffer(value.length);
      for (let i = 0; i < value.length; i++) buf[i] = value[i];
      return buf;
    }
    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object');
  }

  static concat(list: (Uint8Array | Buffer)[], totalLength?: number): Buffer {
    const total = totalLength ?? list.reduce((sum, b) => sum + b.length, 0);
    const result = Buffer.alloc(total);
    let offset = 0;
    for (const buf of list) {
      const toCopy = Math.min(buf.length, total - offset);
      result.set(buf.subarray(0, toCopy), offset);
      offset += toCopy;
      if (offset >= total) break;
    }
    return result;
  }

  static isBuffer(obj: unknown): obj is Buffer {
    return obj instanceof Buffer;
  }

  static isEncoding(encoding: string): boolean {
    return ['utf8', 'utf-8', 'ascii', 'base64', 'base64url', 'hex', 'binary', 'latin1', 'utf16le', 'ucs2', 'ucs-2'].includes(encoding.toLowerCase());
  }

  static byteLength(str: string, encoding?: string): number {
    return Buffer._fromString(str, encoding ?? 'utf8').length;
  }

  static compare(a: Uint8Array, b: Uint8Array): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    if (a.length < b.length) return -1;
    if (a.length > b.length) return 1;
    return 0;
  }

  // ── Instance methods ──────────────────────────────────────

  toString(encoding?: string, start?: number, end?: number): string {
    const s = start ?? 0;
    const e = end ?? this.length;
    const slice = this.subarray(s, e);
    return Buffer._toString(slice, encoding ?? 'utf8');
  }

  write(str: string, offset?: number, length?: number, encoding?: string): number {
    const off = offset ?? 0;
    const enc = encoding ?? 'utf8';
    const bytes = Buffer._fromString(str, enc);
    const len = Math.min(length ?? bytes.length, bytes.length, this.length - off);
    for (let i = 0; i < len; i++) this[off + i] = bytes[i];
    return len;
  }

  copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number {
    const ts = targetStart ?? 0;
    const ss = sourceStart ?? 0;
    const se = sourceEnd ?? this.length;
    const len = Math.min(se - ss, target.length - ts);
    for (let i = 0; i < len; i++) target[ts + i] = this[ss + i];
    return len;
  }

  equals(other: Uint8Array): boolean {
    return Buffer.compare(this, other) === 0;
  }

  compare(target: Uint8Array): number {
    return Buffer.compare(this, target);
  }

  toJSON(): { type: 'Buffer'; data: number[] } {
    return { type: 'Buffer', data: Array.from(this) };
  }

  slice(start?: number, end?: number): Buffer {
    const sliced = super.slice(start, end);
    return Buffer.from(sliced);
  }

  // ── Encoding helpers ──────────────────────────────────────

  private static _fromString(str: string, encoding: string): Buffer {
    const enc = encoding.toLowerCase();
    switch (enc) {
      case 'utf8':
      case 'utf-8': {
        const bytes = new TextEncoder().encode(str);
        return new Buffer(bytes);
      }
      case 'ascii':
      case 'binary':
      case 'latin1': {
        const buf = new Buffer(str.length);
        for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i) & 0xff;
        return buf;
      }
      case 'base64': {
        const raw = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
        const buf = new Buffer(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        return buf;
      }
      case 'base64url': {
        const padded = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
        return Buffer._fromString(padded + pad, 'base64');
      }
      case 'hex': {
        const buf = new Buffer(str.length / 2);
        for (let i = 0; i < str.length; i += 2) {
          buf[i / 2] = parseInt(str.substring(i, i + 2), 16);
        }
        return buf;
      }
      case 'utf16le':
      case 'ucs2':
      case 'ucs-2': {
        const buf = new Buffer(str.length * 2);
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          buf[i * 2] = code & 0xff;
          buf[i * 2 + 1] = (code >> 8) & 0xff;
        }
        return buf;
      }
      default:
        throw new TypeError(`Unknown encoding: ${encoding}`);
    }
  }

  private static _toString(bytes: Uint8Array, encoding: string): string {
    const enc = encoding.toLowerCase();
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return new TextDecoder().decode(bytes);
      case 'ascii':
      case 'binary':
      case 'latin1': {
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return str;
      }
      case 'base64': {
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return btoa(str);
      }
      case 'base64url': {
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      }
      case 'hex': {
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
          hex += (bytes[i] >> 4).toString(16) + (bytes[i] & 0xf).toString(16);
        }
        return hex;
      }
      case 'utf16le':
      case 'ucs2':
      case 'ucs-2': {
        let str = '';
        for (let i = 0; i < bytes.length - 1; i += 2) {
          str += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
        }
        return str;
      }
      default:
        throw new TypeError(`Unknown encoding: ${encoding}`);
    }
  }
}

export default { Buffer };
