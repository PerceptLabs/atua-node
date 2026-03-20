/**
 * libuv Phase-Ordering Shim (Phase A)
 *
 * Implements libuv's event loop phase ordering in TypeScript (~300 LOC).
 * This shim provides correct phase ordering semantics without requiring
 * the full libuv C library compiled to WASM.
 *
 * Phases (matching libuv):
 *   1. Timers      — setTimeout/setInterval callbacks in min-heap order
 *   2. Pending     — deferred I/O callbacks
 *   3. Idle        — internal hooks (idle/prepare)
 *   4. Poll        — I/O completion (browser microtask drain)
 *   5. Check       — setImmediate callbacks
 *   6. Close       — close callbacks (socket.on('close'), etc.)
 *
 * process.nextTick() → microtask queue (runs between every phase)
 * setImmediate()    → check phase (after poll, before close)
 *
 * Integration: uses MessageChannel for phase stepping to cooperate
 * with the browser event loop.
 */

export type EventLoopPhase = 'timers' | 'pending' | 'idle' | 'poll' | 'check' | 'close';

interface TimerEntry {
  id: number;
  callback: () => void;
  expiry: number;
  interval: number; // 0 for one-shot
  cancelled: boolean;
}

interface PhaseCallback {
  callback: () => void;
  once: boolean;
}

export class EventLoop {
  private _timers: TimerEntry[] = [];
  private _pendingCallbacks: Array<() => void> = [];
  private _idleCallbacks: PhaseCallback[] = [];
  private _checkCallbacks: Array<() => void> = [];
  private _closeCallbacks: Array<() => void> = [];
  private _nextTickQueue: Array<() => void> = [];
  private _nextTimerId = 1;
  private _running = false;
  private _currentPhase: EventLoopPhase = 'timers';
  private _channel: MessageChannel | null = null;
  private _phaseListeners = new Map<string, Array<() => void>>();

  /** Get the current phase */
  get phase(): EventLoopPhase {
    return this._currentPhase;
  }

  /** Whether the loop is running */
  get isRunning(): boolean {
    return this._running;
  }

  // ── Timer Phase ─────────────────────────────────────────────

  /** Schedule a timer (setTimeout equivalent) */
  setTimeout(callback: () => void, delay: number): number {
    const id = this._nextTimerId++;
    const entry: TimerEntry = {
      id,
      callback,
      expiry: Date.now() + Math.max(delay, 0),
      interval: 0,
      cancelled: false,
    };
    this._insertTimer(entry);
    return id;
  }

  /** Schedule a repeating timer (setInterval equivalent) */
  setInterval(callback: () => void, interval: number): number {
    const id = this._nextTimerId++;
    const ms = Math.max(interval, 0);
    const entry: TimerEntry = {
      id,
      callback,
      expiry: Date.now() + ms,
      interval: Math.max(ms, 1),  // Re-queue with at least 1ms to prevent tight loops
      cancelled: false,
    };
    this._insertTimer(entry);
    return id;
  }

  /** Cancel a timer */
  clearTimer(id: number): void {
    const entry = this._timers.find(t => t.id === id);
    if (entry) entry.cancelled = true;
  }

  /** Insert timer maintaining min-heap order by expiry */
  private _insertTimer(entry: TimerEntry): void {
    this._timers.push(entry);
    this._timers.sort((a, b) => a.expiry - b.expiry);
  }

  // ── Pending Phase ───────────────────────────────────────────

  /** Queue a deferred I/O callback */
  queuePending(callback: () => void): void {
    this._pendingCallbacks.push(callback);
  }

  // ── Idle Phase ──────────────────────────────────────────────

  /** Register an idle callback */
  onIdle(callback: () => void, once: boolean = false): void {
    this._idleCallbacks.push({ callback, once });
  }

  // ── Check Phase (setImmediate) ──────────────────────────────

  /** Schedule a setImmediate callback */
  setImmediate(callback: () => void): void {
    this._checkCallbacks.push(callback);
  }

  // ── Close Phase ─────────────────────────────────────────────

  /** Queue a close callback */
  queueClose(callback: () => void): void {
    this._closeCallbacks.push(callback);
  }

  // ── nextTick ────────────────────────────────────────────────

  /** Queue a nextTick callback (runs between phases) */
  nextTick(callback: () => void): void {
    this._nextTickQueue.push(callback);
  }

  // ── Phase execution ─────────────────────────────────────────

  /** Drain the nextTick queue (runs between every phase) */
  private _drainNextTick(): void {
    while (this._nextTickQueue.length > 0) {
      const cb = this._nextTickQueue.shift()!;
      cb();
    }
  }

  /** Execute one iteration of the event loop */
  tick(): void {
    // Phase 1: Timers
    this._currentPhase = 'timers';
    this._emit('phase:timers');
    this._runTimers();
    this._drainNextTick();

    // Phase 2: Pending callbacks
    this._currentPhase = 'pending';
    this._emit('phase:pending');
    this._runPending();
    this._drainNextTick();

    // Phase 3: Idle
    this._currentPhase = 'idle';
    this._emit('phase:idle');
    this._runIdle();
    this._drainNextTick();

    // Phase 4: Poll (I/O completion — microtask drain in browser)
    this._currentPhase = 'poll';
    this._emit('phase:poll');
    // In browser, microtasks drain automatically.
    // We just signal that poll phase has run.
    this._drainNextTick();

    // Phase 5: Check (setImmediate)
    this._currentPhase = 'check';
    this._emit('phase:check');
    this._runCheck();
    this._drainNextTick();

    // Phase 6: Close
    this._currentPhase = 'close';
    this._emit('phase:close');
    this._runClose();
    this._drainNextTick();
  }

  /** Run timer callbacks that have expired */
  private _runTimers(): void {
    const now = Date.now();
    while (this._timers.length > 0 && this._timers[0].expiry <= now) {
      const entry = this._timers.shift()!;
      if (entry.cancelled) continue;
      entry.callback();
      // Re-queue interval timers
      if (entry.interval > 0 && !entry.cancelled) {
        entry.expiry = now + entry.interval;
        this._insertTimer(entry);
      }
    }
  }

  /** Run pending I/O callbacks */
  private _runPending(): void {
    const pending = this._pendingCallbacks.splice(0);
    for (const cb of pending) cb();
  }

  /** Run idle callbacks */
  private _runIdle(): void {
    const toRemove: number[] = [];
    for (let i = 0; i < this._idleCallbacks.length; i++) {
      const entry = this._idleCallbacks[i];
      entry.callback();
      if (entry.once) toRemove.push(i);
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this._idleCallbacks.splice(toRemove[i], 1);
    }
  }

  /** Run check (setImmediate) callbacks */
  private _runCheck(): void {
    const checks = this._checkCallbacks.splice(0);
    for (const cb of checks) cb();
  }

  /** Run close callbacks */
  private _runClose(): void {
    const closes = this._closeCallbacks.splice(0);
    for (const cb of closes) cb();
  }

  // ── Loop lifecycle ──────────────────────────────────────────

  /**
   * Start the event loop.
   * Uses MessageChannel to cooperate with the browser event loop —
   * each iteration yields control back to the browser.
   */
  start(): void {
    if (this._running) return;
    this._running = true;

    if (typeof MessageChannel !== 'undefined') {
      this._channel = new MessageChannel();
      this._channel.port1.onmessage = () => {
        if (!this._running) return;
        this.tick();
        if (this._hasWork()) {
          this._channel!.port2.postMessage(null);
        } else {
          this._running = false;
        }
      };
      this._channel.port2.postMessage(null);
    } else {
      // Fallback: synchronous ticking
      this.tick();
      this._running = false;
    }
  }

  /** Stop the event loop */
  stop(): void {
    this._running = false;
    if (this._channel) {
      this._channel.port1.close();
      this._channel.port2.close();
      this._channel = null;
    }
  }

  /** Check if there's still work to do */
  private _hasWork(): boolean {
    return (
      this._timers.some(t => !t.cancelled) ||
      this._pendingCallbacks.length > 0 ||
      this._checkCallbacks.length > 0 ||
      this._closeCallbacks.length > 0 ||
      this._nextTickQueue.length > 0
    );
  }

  // ── Events ──────────────────────────────────────────────────

  on(event: string, listener: () => void): void {
    const existing = this._phaseListeners.get(event);
    if (existing) {
      existing.push(listener);
    } else {
      this._phaseListeners.set(event, [listener]);
    }
  }

  off(event: string, listener: () => void): void {
    const existing = this._phaseListeners.get(event);
    if (!existing) return;
    const idx = existing.indexOf(listener);
    if (idx !== -1) existing.splice(idx, 1);
  }

  private _emit(event: string): void {
    const listeners = this._phaseListeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) listener();
  }
}
