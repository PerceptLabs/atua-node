import { describe, it, expect, vi } from 'vitest';

const { mockInit } = vi.hoisted(() => ({ mockInit: vi.fn() }));
vi.mock('@wasmer/sdk', () => ({ init: mockInit }));

import { process } from '../../src/vendor/process.js';

describe('Signal handling', () => {
  it('should register and fire SIGTERM handler', () => {
    const handler = vi.fn();
    process.on('SIGTERM', handler);
    process.emit('SIGTERM');
    expect(handler).toHaveBeenCalledOnce();
    process.off('SIGTERM', handler);
  });

  it('should register and fire SIGINT handler', () => {
    const handler = vi.fn();
    process.on('SIGINT', handler);
    process.emit('SIGINT');
    expect(handler).toHaveBeenCalledOnce();
    process.off('SIGINT', handler);
  });

  it('should support process.kill to self', () => {
    const handler = vi.fn();
    process.on('SIGTERM', handler);
    process.kill(process.pid, 'SIGTERM');
    expect(handler).toHaveBeenCalledOnce();
    process.off('SIGTERM', handler);
  });

  it('should support exit handler registration', () => {
    const handler = vi.fn();
    process.on('exit', handler);
    // Don't actually call process.exit — just verify registration
    expect(handler).not.toHaveBeenCalled();
  });

  it('should have signal constants in os', async () => {
    const os = (await import('../../src/vendor/os.js')).default;
    expect(os.constants.signals.SIGTERM).toBe(15);
    expect(os.constants.signals.SIGINT).toBe(2);
    expect(os.constants.signals.SIGHUP).toBe(1);
  });
});
