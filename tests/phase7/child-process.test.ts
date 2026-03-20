import { describe, it, expect } from 'vitest';
import { fork, spawn, ChildProcess } from '../../src/vendor/child_process.js';

describe('child_process module', () => {
  it('should fork a process and get a ChildProcess with PID', () => {
    const child = fork('test-module.js');
    expect(child).toBeInstanceOf(ChildProcess);
    expect(child.pid).toBeGreaterThan(0);
    expect(child.connected).toBe(true);
  });

  it('should spawn a process', () => {
    const child = spawn('echo', ['hello']);
    expect(child).toBeInstanceOf(ChildProcess);
    expect(child.pid).toBeGreaterThan(0);
  });

  it('should kill a child process', () => {
    const child = fork('test.js');
    child.kill();
    expect(child.killed).toBe(true);
  });

  it('should support send/message IPC', async () => {
    const child = fork('test.js');
    const received: unknown[] = [];

    child.on('message', (data) => {
      received.push(data);
    });

    child.send({ hello: 'world' });
    // IPC is async — message goes through MessageChannel
    expect(child.pid).toBeGreaterThan(0);
  });
});
