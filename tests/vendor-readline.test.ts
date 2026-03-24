import { describe, it, expect } from 'vitest';
import { createInterface, __atua } from '../src/vendor/readline.js';

describe('vendor/readline', () => {
  it('__atua is true', () => {
    expect(__atua).toBe(true);
  });
  it('createInterface returns object', () => {
    const rl = createInterface();
    expect(rl).toBeDefined();
    expect(typeof rl).toBe('object');
  });
  it('interface has question method', () => {
    const rl = createInterface();
    expect(typeof rl.question).toBe('function');
  });
  it('interface has prompt method', () => {
    const rl = createInterface();
    expect(typeof rl.prompt).toBe('function');
  });
  it('interface has close method', () => {
    const rl = createInterface();
    expect(typeof rl.close).toBe('function');
  });
  it('close emits close event', () => {
    const rl = createInterface();
    let closed = false;
    rl.on('close', () => { closed = true; });
    rl.close();
    expect(closed).toBe(true);
  });
  it('setPrompt and getPrompt work', () => {
    const rl = createInterface();
    rl.setPrompt('>> ');
    expect(rl.getPrompt()).toBe('>> ');
  });
});
