// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hasWasm, loadReactor } from './_loader.js';
import {
  BindingEncoding, type SimdutfExports,
  ENCODING_UTF8, ENCODING_UTF16_LE,
} from '../../src/bindings/binding-encoding.js';

const wasmExists = hasWasm('simdutf');

describe.skipIf(!wasmExists)('simdutf.wasm — real WASI execution', () => {
  let binding: BindingEncoding;

  async function initBinding() {
    const raw = await loadReactor('simdutf');
    binding = new BindingEncoding();
    binding.init(raw as unknown as SimdutfExports);
    return binding;
  }

  it('should export validate_utf8 and convert functions', async () => {
    const raw = await loadReactor('simdutf');
    expect((raw as any).validate_utf8).toBeDefined();
    expect((raw as any).convert_utf8_to_utf16).toBeDefined();
    expect((raw as any).convert_utf16_to_utf8).toBeDefined();
  });

  it('should validate valid UTF-8', async () => {
    const b = await initBinding();
    const data = new TextEncoder().encode('Hello, World!');
    expect(b.validateUtf8(data)).toBe(true);
  });

  it('should validate multibyte UTF-8', async () => {
    const b = await initBinding();
    const data = new TextEncoder().encode('こんにちは世界');
    expect(b.validateUtf8(data)).toBe(true);
  });

  it('should reject invalid UTF-8', async () => {
    const b = await initBinding();
    const invalid = new Uint8Array([0xC0, 0x00]); // Invalid continuation byte
    expect(b.validateUtf8(invalid)).toBe(false);
  });

  it('should convert UTF-8 to UTF-16 and back', async () => {
    const b = await initBinding();
    const original = 'Hello, World!';
    const utf8 = new TextEncoder().encode(original);

    const utf16 = b.utf8ToUtf16(utf8);
    expect(utf16.length).toBe(original.length * 2); // ASCII: 2 bytes per char in UTF-16

    const roundTripped = b.utf16ToUtf8(utf16);
    expect(new TextDecoder().decode(roundTripped)).toBe(original);
  });

  it('should handle emoji in UTF-8/UTF-16 conversion', async () => {
    const b = await initBinding();
    const original = 'Hello 🌍!';
    const utf8 = new TextEncoder().encode(original);

    const utf16 = b.utf8ToUtf16(utf8);
    const roundTripped = b.utf16ToUtf8(utf16);
    expect(new TextDecoder().decode(roundTripped)).toBe(original);
  });

  it('should detect UTF-8 encoding', async () => {
    const b = await initBinding();
    const data = new TextEncoder().encode('Plain UTF-8 text');
    const encoding = b.detectEncoding(data);
    expect(encoding).toBe(ENCODING_UTF8);
  });
});
