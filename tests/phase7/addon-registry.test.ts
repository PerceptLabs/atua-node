import { describe, it, expect } from 'vitest';
import { AddonRegistry } from '../../src/router/addon-registry.js';

describe('Addon Registry', () => {
  it('should register an addon', () => {
    const registry = new AddonRegistry();
    registry.register('better-sqlite3', { wasmPath: '/wasm/better-sqlite3.wasm' });
    expect(registry.has('better-sqlite3')).toBe(true);
  });

  it('should list registered addons', () => {
    const registry = new AddonRegistry();
    registry.register('sharp', { wasmPath: '/wasm/sharp.wasm' });
    registry.register('canvas', { wasmPath: '/wasm/canvas.wasm' });
    expect(registry.list()).toEqual(['sharp', 'canvas']);
  });

  it('should throw for unregistered addon load', async () => {
    const registry = new AddonRegistry();
    await expect(registry.load('nonexistent')).rejects.toThrow('not registered');
  });

  it('should get addon entry details', () => {
    const registry = new AddonRegistry();
    registry.register('test-addon', { package: '@test/addon', wasmPath: '/wasm/test.wasm' });
    const entry = registry.get('test-addon');
    expect(entry?.name).toBe('test-addon');
    expect(entry?.package).toBe('@test/addon');
    expect(entry?.loaded).toBe(false);
  });
});
