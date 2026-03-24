import { describe, it, expect } from 'vitest';
import { constants, getDefaultSettings, createServer, __atua } from '../src/vendor/http2.js';

describe('vendor/http2', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('constants has HTTP2_HEADER_PATH', () => {
    expect(constants.HTTP2_HEADER_PATH).toBe(':path');
  });
  it('constants has HTTP2_HEADER_METHOD', () => {
    expect(constants.HTTP2_HEADER_METHOD).toBe(':method');
  });
  it('constants has HTTP2_HEADER_STATUS', () => {
    expect(constants.HTTP2_HEADER_STATUS).toBe(':status');
  });
  it('constants has NGHTTP2 error codes', () => {
    expect(constants.NGHTTP2_NO_ERROR).toBe(0);
    expect(constants.NGHTTP2_PROTOCOL_ERROR).toBe(1);
  });
  it('getDefaultSettings returns settings object', () => {
    const settings = getDefaultSettings();
    expect(typeof settings).toBe('object');
    expect(typeof settings.headerTableSize).toBe('number');
    expect(typeof settings.maxFrameSize).toBe('number');
  });
  it('createServer is a function', () => {
    expect(typeof createServer).toBe('function');
  });
  it('createServer throws ERR_NOT_SUPPORTED', () => {
    expect(() => createServer()).toThrow(/not supported/i);
  });
});
