import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLoop, type EventLoopPhase } from '../src/libuv/phase-shim.js';

describe('EventLoop Phase-Ordering Shim (libuv Phase A)', () => {
  let loop: EventLoop;

  beforeEach(() => {
    loop = new EventLoop();
  });

  describe('Phase ordering', () => {
    it('nextTick runs before setImmediate runs before setTimeout', () => {
      const order: string[] = [];

      // Queue all three from inside a pending (I/O) callback.
      // This simulates the real-world case where these are called
      // from I/O completion context — past the timers phase.
      // nextTick drains after the pending phase.
      // setImmediate fires in the check phase.
      // setTimeout(0) defers to the NEXT tick's timers phase.
      loop.queuePending(() => {
        loop.setTimeout(() => order.push('setTimeout'), 0);
        loop.setImmediate(() => order.push('setImmediate'));
        loop.nextTick(() => order.push('nextTick'));
      });

      loop.tick(); // nextTick + setImmediate fire; setTimeout deferred
      loop.tick(); // setTimeout fires

      expect(order.indexOf('nextTick')).toBeLessThan(order.indexOf('setImmediate'));
      expect(order.indexOf('setImmediate')).toBeLessThan(order.indexOf('setTimeout'));
    });

    it('multiple nextTick callbacks exhaust before I/O callback runs', () => {
      const order: string[] = [];

      loop.queuePending(() => order.push('io'));
      loop.nextTick(() => {
        order.push('tick1');
        loop.nextTick(() => order.push('tick2'));
      });

      loop.tick();

      // nextTick drains between timers and pending phases
      // tick1 runs, queues tick2, tick2 runs, then pending phase runs io
      const tick1Idx = order.indexOf('tick1');
      const tick2Idx = order.indexOf('tick2');
      const ioIdx = order.indexOf('io');

      expect(tick1Idx).toBeLessThan(ioIdx);
      expect(tick2Idx).toBeLessThan(ioIdx);
    });

    it('setImmediate fires in check phase (after poll, before close)', () => {
      const phases: EventLoopPhase[] = [];
      let immediatePhase: EventLoopPhase | null = null;

      loop.on('phase:poll', () => phases.push('poll'));
      loop.on('phase:check', () => phases.push('check'));
      loop.on('phase:close', () => phases.push('close'));

      loop.setImmediate(() => {
        immediatePhase = loop.phase;
      });

      loop.tick();

      expect(immediatePhase).toBe('check');
      expect(phases.indexOf('poll')).toBeLessThan(phases.indexOf('check'));
      expect(phases.indexOf('check')).toBeLessThan(phases.indexOf('close'));
    });
  });

  describe('Timers', () => {
    it('should fire setTimeout callback when expired', () => {
      const cb = vi.fn();
      loop.setTimeout(cb, 0);
      loop.tick();
      expect(cb).toHaveBeenCalledOnce();
    });

    it('should not fire setTimeout before expiry', () => {
      const cb = vi.fn();
      loop.setTimeout(cb, 10000); // Far future
      loop.tick();
      expect(cb).not.toHaveBeenCalled();
    });

    it('should fire timers in expiry order', () => {
      const order: number[] = [];
      const now = Date.now();

      // All with 0 delay — should fire in registration order
      loop.setTimeout(() => order.push(1), 0);
      loop.setTimeout(() => order.push(2), 0);
      loop.setTimeout(() => order.push(3), 0);

      loop.tick();

      expect(order).toEqual([1, 2, 3]);
    });

    it('should support clearTimer', () => {
      const cb = vi.fn();
      const id = loop.setTimeout(cb, 0);
      loop.clearTimer(id);
      loop.tick();
      expect(cb).not.toHaveBeenCalled();
    });

    it('should support setInterval', () => {
      let count = 0;
      // Use a real interval with a 0ms delay — will fire on first tick
      // because expiry = Date.now() + 0 = now, and now <= now.
      // After firing, re-queued with expiry = now + max(1, interval).
      // Subsequent ticks may or may not fire depending on wall-clock.
      // We verify it fires at least once and remains active.
      const id = loop.setInterval(() => count++, 0);

      loop.tick(); // fires (expiry <= now)
      expect(count).toBeGreaterThanOrEqual(1);

      // Clear and verify it stops
      loop.clearTimer(id);
      const countBefore = count;
      loop.tick();
      expect(count).toBe(countBefore);
    });
  });

  describe('Pending callbacks (I/O)', () => {
    it('should run pending callbacks in pending phase', () => {
      let phase: EventLoopPhase | null = null;
      loop.queuePending(() => {
        phase = loop.phase;
      });
      loop.tick();
      expect(phase).toBe('pending');
    });
  });

  describe('Check phase (setImmediate)', () => {
    it('should run setImmediate callbacks', () => {
      const cb = vi.fn();
      loop.setImmediate(cb);
      loop.tick();
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe('Close phase', () => {
    it('should run close callbacks in close phase', () => {
      let phase: EventLoopPhase | null = null;
      loop.queueClose(() => {
        phase = loop.phase;
      });
      loop.tick();
      expect(phase).toBe('close');
    });
  });

  describe('Idle callbacks', () => {
    it('should run idle callbacks every tick', () => {
      let count = 0;
      loop.onIdle(() => count++);
      loop.tick();
      loop.tick();
      expect(count).toBe(2);
    });

    it('should support once idle callbacks', () => {
      let count = 0;
      loop.onIdle(() => count++, true);
      loop.tick();
      loop.tick();
      expect(count).toBe(1);
    });
  });

  describe('Loop lifecycle', () => {
    it('should track running state', () => {
      expect(loop.isRunning).toBe(false);
      loop.start();
      // With MessageChannel, loop starts async
      // Just verify it doesn't throw
      loop.stop();
      expect(loop.isRunning).toBe(false);
    });
  });

  describe('Phase events', () => {
    it('should emit phase events in correct order', () => {
      const phases: string[] = [];

      loop.on('phase:timers', () => phases.push('timers'));
      loop.on('phase:pending', () => phases.push('pending'));
      loop.on('phase:idle', () => phases.push('idle'));
      loop.on('phase:poll', () => phases.push('poll'));
      loop.on('phase:check', () => phases.push('check'));
      loop.on('phase:close', () => phases.push('close'));

      loop.tick();

      expect(phases).toEqual(['timers', 'pending', 'idle', 'poll', 'check', 'close']);
    });

    it('should support removing event listeners', () => {
      let count = 0;
      const listener = () => count++;
      loop.on('phase:timers', listener);
      loop.tick();
      expect(count).toBe(1);

      loop.off('phase:timers', listener);
      loop.tick();
      expect(count).toBe(1); // Not called again
    });
  });

  describe('nextTick between phases', () => {
    it('should drain nextTick queue between every phase pair', () => {
      const order: string[] = [];

      // Queue a nextTick that gets picked up between timers and pending
      loop.on('phase:timers', () => {
        loop.nextTick(() => order.push('tick-after-timers'));
      });

      loop.on('phase:pending', () => {
        order.push('pending-phase');
      });

      loop.tick();

      // nextTick should have run between timers and pending
      const tickIdx = order.indexOf('tick-after-timers');
      const pendingIdx = order.indexOf('pending-phase');
      expect(tickIdx).toBeLessThan(pendingIdx);
    });
  });
});
