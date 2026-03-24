import { describe, it, expect, vi } from 'vitest';
import { create, Domain, __atua } from '../src/vendor/domain.js';

describe('vendor/domain', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('create returns Domain', () => {
    const d = create();
    expect(d).toBeInstanceOf(Domain);
  });
  it('domain has run/add/remove methods', () => {
    const d = create();
    expect(typeof d.run).toBe('function');
    expect(typeof d.add).toBe('function');
    expect(typeof d.remove).toBe('function');
  });
  it('run executes function', () => {
    const d = create();
    const result = d.run(() => 42);
    expect(result).toBe(42);
  });
  it('error in run emits error event', () => {
    const d = create();
    const errHandler = vi.fn();
    d.on('error', errHandler);
    expect(() => d.run(() => { throw new Error('boom'); })).toThrow('boom');
    expect(errHandler).toHaveBeenCalledOnce();
    expect(errHandler.mock.calls[0][0].message).toBe('boom');
  });
  it('add/remove manage members', () => {
    const d = create();
    const { EventEmitter } = require('events');
    const ee = new EventEmitter();
    d.add(ee);
    expect(d.members).toContain(ee);
    d.remove(ee);
    expect(d.members).not.toContain(ee);
  });
});
