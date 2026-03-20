import { describe, it, expect, vi } from 'vitest';
import { isPrimary, isMaster, isWorker, fork, cluster } from '../../src/vendor/cluster.js';

describe('cluster module', () => {
  it('should report isPrimary/isMaster as true in main thread', () => {
    expect(isPrimary).toBe(true);
    expect(isMaster).toBe(true);
    expect(isWorker).toBe(false);
  });

  it('should fork a worker', () => {
    const worker = fork();
    expect(worker.id).toBeGreaterThan(0);
    expect(worker.process.pid).toBeGreaterThan(0);
    expect(worker.isDead).toBe(false);
  });

  it('should emit fork event', () => {
    const handler = vi.fn();
    cluster.on('fork', handler);
    const worker = fork();
    expect(handler).toHaveBeenCalledWith(worker);
    cluster.off('fork', handler);
  });

  it('should kill a worker', () => {
    const worker = fork();
    worker.kill();
    expect(worker.isDead).toBe(true);
  });
});
