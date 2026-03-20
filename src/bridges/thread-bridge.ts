/**
 * ThreadBridge — Maps WASIX threading to Web Workers + SharedArrayBuffer.
 *
 * @wasmer/sdk handles thread_spawn automatically via Web Workers + SAB.
 * This bridge configures thread pool settings, manages cleanup, and
 * exposes mutex/condvar primitives mapped to Atomics.wait()/Atomics.notify().
 */

export interface ThreadPoolConfig {
  /** Maximum number of concurrent worker threads (default: navigator.hardwareConcurrency or 4) */
  maxThreads: number;
  /** Stack size per thread in bytes (default: 1MB) */
  stackSize: number;
}

export interface MutexHandle {
  id: number;
  /** Lock the mutex (blocks via Atomics.wait) */
  lock(): void;
  /** Try to lock without blocking — returns true if acquired */
  tryLock(): boolean;
  /** Unlock the mutex */
  unlock(): void;
}

export interface CondvarHandle {
  id: number;
  /** Wait on the condition variable (must hold associated mutex) */
  wait(mutex: MutexHandle): void;
  /** Wait with timeout in milliseconds — returns true if signaled, false if timed out */
  waitTimeout(mutex: MutexHandle, timeoutMs: number): boolean;
  /** Wake one waiting thread */
  notifyOne(): number;
  /** Wake all waiting threads */
  notifyAll(): number;
}

// Mutex state constants
const MUTEX_UNLOCKED = 0;
const MUTEX_LOCKED = 1;

// Condvar signal constants
const CONDVAR_IDLE = 0;
const CONDVAR_SIGNALED = 1;

export class ThreadBridge {
  private _config: ThreadPoolConfig;
  private _sab: SharedArrayBuffer | null = null;
  private _i32View: Int32Array | null = null;
  private _nextMutexOffset = 0;
  private _nextCondvarOffset = 0;
  private _mutexCount = 0;
  private _condvarCount = 0;
  private _activeThreads = 0;

  constructor(config?: Partial<ThreadPoolConfig>) {
    const defaultConcurrency =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;

    this._config = {
      maxThreads: config?.maxThreads ?? defaultConcurrency,
      stackSize: config?.stackSize ?? 1024 * 1024, // 1MB
    };
  }

  /** Get the thread pool configuration for @wasmer/sdk runWasix() */
  getWasixThreadConfig(): { threadSpawnConfig: { stackSize: number } } {
    return {
      threadSpawnConfig: {
        stackSize: this._config.stackSize,
      },
    };
  }

  /** Initialize the shared memory for synchronization primitives */
  initSharedMemory(size: number = 4096): SharedArrayBuffer {
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error('SharedArrayBuffer is not available. COOP/COEP headers are required.');
    }

    this._sab = new SharedArrayBuffer(size);
    this._i32View = new Int32Array(this._sab);
    this._nextMutexOffset = 0;
    this._nextCondvarOffset = Math.floor(size / 4 / 2); // Condvars in second half (Int32 indices)
    return this._sab;
  }

  /** Get or create shared memory */
  get sharedMemory(): SharedArrayBuffer | null {
    return this._sab;
  }

  /** Create a mutex backed by Atomics */
  createMutex(): MutexHandle {
    if (!this._i32View || !this._sab) {
      this.initSharedMemory();
    }
    const view = this._i32View!;
    const offset = this._nextMutexOffset++;
    const id = this._mutexCount++;

    // Initialize to unlocked
    Atomics.store(view, offset, MUTEX_UNLOCKED);

    return {
      id,
      lock(): void {
        while (true) {
          // Try to acquire: CAS unlocked → locked
          const old = Atomics.compareExchange(view, offset, MUTEX_UNLOCKED, MUTEX_LOCKED);
          if (old === MUTEX_UNLOCKED) return; // acquired
          // Already locked — wait
          Atomics.wait(view, offset, MUTEX_LOCKED);
        }
      },
      tryLock(): boolean {
        const old = Atomics.compareExchange(view, offset, MUTEX_UNLOCKED, MUTEX_LOCKED);
        return old === MUTEX_UNLOCKED;
      },
      unlock(): void {
        Atomics.store(view, offset, MUTEX_UNLOCKED);
        Atomics.notify(view, offset, 1);
      },
    };
  }

  /** Create a condition variable backed by Atomics */
  createCondvar(): CondvarHandle {
    if (!this._i32View || !this._sab) {
      this.initSharedMemory();
    }
    const view = this._i32View!;
    const offset = this._nextCondvarOffset++;
    const id = this._condvarCount++;

    // Initialize to idle
    Atomics.store(view, offset, CONDVAR_IDLE);

    return {
      id,
      wait(mutex: MutexHandle): void {
        mutex.unlock();
        Atomics.wait(view, offset, CONDVAR_IDLE);
        Atomics.store(view, offset, CONDVAR_IDLE);
        mutex.lock();
      },
      waitTimeout(mutex: MutexHandle, timeoutMs: number): boolean {
        mutex.unlock();
        const result = Atomics.wait(view, offset, CONDVAR_IDLE, timeoutMs);
        Atomics.store(view, offset, CONDVAR_IDLE);
        mutex.lock();
        return result !== 'timed-out';
      },
      notifyOne(): number {
        Atomics.store(view, offset, CONDVAR_SIGNALED);
        return Atomics.notify(view, offset, 1);
      },
      notifyAll(): number {
        Atomics.store(view, offset, CONDVAR_SIGNALED);
        return Atomics.notify(view, offset);
      },
    };
  }

  /** Track thread creation */
  onThreadSpawned(): void {
    this._activeThreads++;
  }

  /** Track thread exit */
  onThreadExited(): void {
    this._activeThreads = Math.max(0, this._activeThreads - 1);
  }

  /** Get current active thread count */
  get activeThreadCount(): number {
    return this._activeThreads;
  }

  /** Get maximum allowed threads */
  get maxThreads(): number {
    return this._config.maxThreads;
  }

  /** Check if we can spawn more threads */
  get canSpawnThread(): boolean {
    return this._activeThreads < this._config.maxThreads;
  }
}
