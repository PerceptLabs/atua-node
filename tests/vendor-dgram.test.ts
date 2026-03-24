import { describe, it, expect } from 'vitest';
import { createSocket, Socket, __atua } from '../src/vendor/dgram.js';

describe('vendor/dgram', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('createSocket returns Socket', () => {
    const sock = createSocket('udp4');
    expect(sock).toBeInstanceOf(Socket);
  });
  it('socket has bind method', () => {
    const sock = createSocket('udp4');
    expect(typeof sock.bind).toBe('function');
  });
  it('socket has send method', () => {
    const sock = createSocket('udp4');
    expect(typeof sock.send).toBe('function');
  });
  it('socket has close method', () => {
    const sock = createSocket('udp4');
    expect(typeof sock.close).toBe('function');
  });
  it('bind throws ERR_NOT_SUPPORTED', () => {
    const sock = createSocket('udp4');
    expect(() => sock.bind(1234)).toThrow(/not supported/i);
  });
  it('send throws ERR_NOT_SUPPORTED', () => {
    const sock = createSocket('udp4');
    expect(() => sock.send('data')).toThrow(/not supported/i);
  });
  it('close emits close event', () => {
    const sock = createSocket('udp4');
    let closed = false;
    sock.on('close', () => { closed = true; });
    sock.close();
    expect(closed).toBe(true);
  });
});
