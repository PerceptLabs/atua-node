import { describe, it, expect, vi } from 'vitest';

const { mockInit } = vi.hoisted(() => ({ mockInit: vi.fn() }));
vi.mock('@wasmer/sdk', () => ({ init: mockInit }));

import { process } from '../../src/vendor/process.js';

describe('process object', () => {
  it('should report correct platform and arch', () => {
    expect(process.platform).toBe('linux');
    expect(process.arch).toBe('x64');
  });

  it('should have valid version strings', () => {
    expect(process.version).toBe('v24.0.0');
    expect(process.versions.node).toBe('24.0.0');
    expect(process.versions.v8).toBeDefined();
    expect(process.versions.openssl).toBe('3.4.0');
    expect(process.versions.zlib).toBe('1.3.1');
  });

  it('should have process identity', () => {
    expect(process.pid).toBe(1);
    expect(process.ppid).toBe(0);
    expect(process.title).toBe('node');
    expect(process.execPath).toBe('/usr/local/bin/node');
  });

  it('should provide hrtime', () => {
    const [sec, nsec] = process.hrtime();
    expect(sec).toBeGreaterThanOrEqual(0);
    expect(nsec).toBeGreaterThanOrEqual(0);
    expect(nsec).toBeLessThan(1e9);
  });

  it('should provide hrtime.bigint', () => {
    const ns = process.hrtime.bigint();
    expect(typeof ns).toBe('bigint');
    expect(ns).toBeGreaterThanOrEqual(0n);
  });

  it('should provide cwd/chdir', () => {
    const original = process.cwd();
    process.chdir('/test');
    expect(process.cwd()).toBe('/test');
    process.chdir(original);
  });

  it('should provide env object', () => {
    expect(typeof process.env).toBe('object');
  });

  it('should support nextTick', () => {
    return new Promise<void>(resolve => {
      let called = false;
      process.nextTick(() => { called = true; });
      // nextTick fires on the event loop tick
      process._eventLoop.tick();
      expect(called).toBe(true);
      resolve();
    });
  });

  it('should have stdout and stderr', () => {
    expect(process.stdout).toBeDefined();
    expect(process.stderr).toBeDefined();
    expect(process.stdout.writable).toBe(true);
    expect(process.stderr.writable).toBe(true);
  });

  it('should support signal handler registration', () => {
    const handler = vi.fn();
    process.on('SIGTERM', handler);
    process.emit('SIGTERM');
    expect(handler).toHaveBeenCalledOnce();
    process.off('SIGTERM', handler);
  });

  it('should support exit handler', () => {
    const handler = vi.fn();
    process.on('exit', handler);
    // Don't actually exit — just test registration
    expect(handler).not.toHaveBeenCalled();
  });
});
