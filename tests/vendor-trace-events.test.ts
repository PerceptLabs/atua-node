import { describe, it, expect } from 'vitest';
import { createTracing, getEnabledCategories, __atua } from '../src/vendor/trace_events.js';

describe('vendor/trace_events', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('createTracing returns object with enable/disable/enabled', () => {
    const t = createTracing({ categories: ['node'] });
    expect(typeof t.enable).toBe('function');
    expect(typeof t.disable).toBe('function');
    expect(typeof t.enabled).toBe('boolean');
  });
  it('createTracing starts disabled', () => {
    const t = createTracing({ categories: ['v8'] });
    expect(t.enabled).toBe(false);
  });
  it('enable/disable toggle enabled state', () => {
    const t = createTracing({ categories: ['node'] });
    t.enable();
    expect(t.enabled).toBe(true);
    t.disable();
    expect(t.enabled).toBe(false);
  });
  it('categories is joined string', () => {
    const t = createTracing({ categories: ['node', 'v8'] });
    expect(t.categories).toBe('node,v8');
  });
  it('getEnabledCategories returns undefined', () => {
    expect(getEnabledCategories()).toBeUndefined();
  });
});
