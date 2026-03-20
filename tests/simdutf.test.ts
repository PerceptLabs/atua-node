import { describe, it, expect, beforeEach } from 'vitest';
import {
  BindingEncoding, type SimdutfExports,
  ENCODING_UTF8, ENCODING_UTF16_LE, ENCODING_UNKNOWN,
} from '../src/bindings/binding-encoding.js';

/**
 * Mock simdutf WASM exports (scalar fallback).
 * Uses TextEncoder/TextDecoder for actual conversion logic.
 */
function createMockSimdutfExports(): SimdutfExports {
  const memoryBuffer = new ArrayBuffer(256 * 1024);
  let nextAlloc = 4096;
  const memory = { buffer: memoryBuffer } as WebAssembly.Memory;

  function malloc(size: number): number {
    const ptr = nextAlloc;
    nextAlloc += Math.max(size, 4);
    nextAlloc = (nextAlloc + 3) & ~3;
    return ptr;
  }

  const exports: SimdutfExports = {
    memory,
    malloc,
    free: () => {},

    validate_utf8(bufPtr: number, len: number): number {
      const data = new Uint8Array(memoryBuffer, bufPtr, len);
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(data);
        return 1; // valid
      } catch {
        return 0; // invalid
      }
    },

    validate_utf16(bufPtr: number, len: number): number {
      // len is number of UTF-16 code units
      try {
        const data = new Uint8Array(memoryBuffer, bufPtr, len * 2);
        // Check for unpaired surrogates
        const u16 = new Uint16Array(data.buffer, data.byteOffset, len);
        for (let i = 0; i < len; i++) {
          const code = u16[i];
          if (code >= 0xD800 && code <= 0xDBFF) {
            // High surrogate — must be followed by low
            if (i + 1 >= len || u16[i + 1] < 0xDC00 || u16[i + 1] > 0xDFFF) {
              return 0;
            }
            i++; // skip low surrogate
          } else if (code >= 0xDC00 && code <= 0xDFFF) {
            // Lone low surrogate
            return 0;
          }
        }
        return 1;
      } catch {
        return 0;
      }
    },

    convert_utf8_to_utf16(inputPtr: number, inputLen: number, outputPtr: number): number {
      const utf8 = new Uint8Array(memoryBuffer, inputPtr, inputLen);
      const text = new TextDecoder('utf-8').decode(utf8);
      const u16 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        u16[i] = text.charCodeAt(i);
      }
      new Uint8Array(memoryBuffer, outputPtr, u16.length * 2).set(new Uint8Array(u16.buffer));
      return text.length;
    },

    convert_utf16_to_utf8(inputPtr: number, inputLen: number, outputPtr: number): number {
      const u16 = new Uint16Array(memoryBuffer, inputPtr, inputLen);
      let text = '';
      for (let i = 0; i < inputLen; i++) {
        text += String.fromCharCode(u16[i]);
      }
      const utf8 = new TextEncoder().encode(text);
      new Uint8Array(memoryBuffer, outputPtr, utf8.length).set(utf8);
      return utf8.length;
    },

    utf8_length_from_utf16(inputPtr: number, inputLen: number): number {
      const u16 = new Uint16Array(memoryBuffer, inputPtr, inputLen);
      let text = '';
      for (let i = 0; i < inputLen; i++) text += String.fromCharCode(u16[i]);
      return new TextEncoder().encode(text).length;
    },

    utf16_length_from_utf8(inputPtr: number, inputLen: number): number {
      const data = new Uint8Array(memoryBuffer, inputPtr, inputLen);
      return new TextDecoder('utf-8').decode(data).length;
    },

    detect_encoding(bufPtr: number, len: number): number {
      const data = new Uint8Array(memoryBuffer, bufPtr, len);
      // Simple BOM detection
      if (len >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
        return ENCODING_UTF8;
      }
      if (len >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
        return ENCODING_UTF16_LE;
      }
      // Try UTF-8 validation
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(data);
        return ENCODING_UTF8;
      } catch {
        return ENCODING_UNKNOWN;
      }
    },
  };

  return exports;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('BindingEncoding (simdutf)', () => {
  let binding: BindingEncoding;

  beforeEach(() => {
    binding = new BindingEncoding();
    binding.init(createMockSimdutfExports());
  });

  it('should report ready after init', () => {
    expect(binding.isReady).toBe(true);
  });

  it('should throw if not initialized', () => {
    const uninit = new BindingEncoding();
    expect(() => uninit.validateUtf8(new Uint8Array(0))).toThrow('not initialized');
  });

  describe('UTF-8 validation', () => {
    it('should validate valid ASCII as UTF-8', () => {
      const data = new TextEncoder().encode('Hello, World!');
      expect(binding.validateUtf8(data)).toBe(true);
    });

    it('should validate valid multibyte UTF-8', () => {
      const data = new TextEncoder().encode('こんにちは世界 🌍');
      expect(binding.validateUtf8(data)).toBe(true);
    });

    it('should reject invalid UTF-8 sequences', () => {
      // Invalid continuation byte
      const invalid = new Uint8Array([0xC0, 0x00]);
      expect(binding.validateUtf8(invalid)).toBe(false);
    });

    it('should reject overlong encoding', () => {
      // Overlong encoding of NUL
      const overlong = new Uint8Array([0xC0, 0x80]);
      expect(binding.validateUtf8(overlong)).toBe(false);
    });

    it('should validate empty input', () => {
      expect(binding.validateUtf8(new Uint8Array(0))).toBe(true);
    });
  });

  describe('UTF-8 ↔ UTF-16 conversion', () => {
    it('should convert ASCII UTF-8 to UTF-16', () => {
      const utf8 = new TextEncoder().encode('Hello');
      const utf16 = binding.utf8ToUtf16(utf8);
      // UTF-16: each char is 2 bytes for ASCII
      expect(utf16.length).toBe(10); // 5 chars × 2 bytes
    });

    it('should convert UTF-16 back to UTF-8', () => {
      const utf8 = new TextEncoder().encode('Hello');
      const utf16 = binding.utf8ToUtf16(utf8);
      const roundTripped = binding.utf16ToUtf8(utf16);
      expect(new TextDecoder().decode(roundTripped)).toBe('Hello');
    });

    it('should handle multibyte characters', () => {
      const original = '日本語テスト';
      const utf8 = new TextEncoder().encode(original);
      const utf16 = binding.utf8ToUtf16(utf8);
      const roundTripped = binding.utf16ToUtf8(utf16);
      expect(new TextDecoder().decode(roundTripped)).toBe(original);
    });

    it('should handle emoji (4-byte UTF-8)', () => {
      const original = '🚀✨🌍';
      const utf8 = new TextEncoder().encode(original);
      const utf16 = binding.utf8ToUtf16(utf8);
      const roundTripped = binding.utf16ToUtf8(utf16);
      expect(new TextDecoder().decode(roundTripped)).toBe(original);
    });
  });

  describe('Encoding detection', () => {
    it('should detect UTF-8 BOM', () => {
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      expect(binding.detectEncoding(bom)).toBe(ENCODING_UTF8);
    });

    it('should detect UTF-16 LE BOM', () => {
      const bom = new Uint8Array([0xFF, 0xFE, 0x48, 0x00]);
      expect(binding.detectEncoding(bom)).toBe(ENCODING_UTF16_LE);
    });

    it('should detect plain UTF-8 without BOM', () => {
      const data = new TextEncoder().encode('Plain UTF-8 text');
      expect(binding.detectEncoding(data)).toBe(ENCODING_UTF8);
    });
  });
});
