import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FsBridge, type FileSystem, type FileStat, type DirEntry, O_RDONLY, O_WRONLY, O_CREAT, O_APPEND } from '../src/bridges/fs-bridge.js';
import { ThreadBridge } from '../src/bridges/thread-bridge.js';
import { ProcBridge } from '../src/bridges/proc-bridge.js';
import { NetBridge, AtuaNetBridge, type INetBridge, type StreamHandle, type FetchResponse } from '../src/bridges/net-bridge.js';

// ── In-memory FileSystem mock ───────────────────────────────────
function createMockFs(files: Record<string, Uint8Array> = {}): FileSystem {
  const store = new Map<string, Uint8Array>(Object.entries(files));

  return {
    async readFile(path: string): Promise<Uint8Array> {
      const data = store.get(path);
      if (!data) throw new Error(`ENOENT: ${path}`);
      return data;
    },
    async writeFile(path: string, data: Uint8Array): Promise<void> {
      store.set(path, data);
    },
    async stat(path: string): Promise<FileStat> {
      if (store.has(path)) {
        return { size: store.get(path)!.length, isFile: true, isDirectory: false, lastModified: Date.now() };
      }
      // Check if it's a "directory" (prefix match)
      for (const key of store.keys()) {
        if (key.startsWith(path + '/')) {
          return { size: 0, isFile: false, isDirectory: true, lastModified: Date.now() };
        }
      }
      throw new Error(`ENOENT: ${path}`);
    },
    async readdir(path: string): Promise<DirEntry[]> {
      const prefix = path === '/' ? '/' : path + '/';
      const entries: DirEntry[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const name = rest.split('/')[0];
          if (name && !entries.some(e => e.name === name)) {
            entries.push({ name, type: rest.includes('/') ? 'directory' : 'file' });
          }
        }
      }
      return entries;
    },
    async mkdir(_path: string): Promise<void> {},
    async unlink(path: string): Promise<void> {
      store.delete(path);
    },
    async exists(path: string): Promise<boolean> {
      return store.has(path);
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// FsBridge Tests
// ═══════════════════════════════════════════════════════════════
describe('FsBridge', () => {
  let bridge: FsBridge;
  let mockFs: FileSystem;

  beforeEach(() => {
    bridge = new FsBridge();
    mockFs = createMockFs({
      '/hello.txt': new TextEncoder().encode('Hello from AtuaFS!'),
    });
    bridge.mount({ guestPath: '/data', hostFs: mockFs });
  });

  it('should mount and unmount filesystems', () => {
    expect(bridge.getMounts().size).toBe(1);
    bridge.unmount('/data');
    expect(bridge.getMounts().size).toBe(0);
  });

  it('should build WASIX mount config', () => {
    const mounts = bridge.buildWasixMounts();
    expect(mounts['/data']).toBe(mockFs);
  });

  describe('fd_read / fd_write', () => {
    it('should read a file via pathOpen + fdRead', async () => {
      const fd = await bridge.pathOpen('/data/hello.txt', O_RDONLY);
      const data = await bridge.fdRead(fd, 1024);
      expect(new TextDecoder().decode(data)).toBe('Hello from AtuaFS!');
      bridge.fdClose(fd);
    });

    it('should write a file via pathOpen + fdWrite', async () => {
      const fd = await bridge.pathOpen('/data/output.txt', O_WRONLY | O_CREAT);
      const content = new TextEncoder().encode('written from WASIX');
      const written = await bridge.fdWrite(fd, content);
      expect(written).toBe(content.length);
      bridge.fdClose(fd);

      // Verify via direct fs read
      const readFd = await bridge.pathOpen('/data/output.txt', O_RDONLY);
      const readData = await bridge.fdRead(readFd, 1024);
      expect(new TextDecoder().decode(readData)).toBe('written from WASIX');
      bridge.fdClose(readFd);
    });

    it('should write a file in JS and read from C (WASIX) side', async () => {
      // JS writes via AtuaFS
      await mockFs.writeFile('/test-file.txt', new TextEncoder().encode('JS wrote this'));

      // "C side" reads via fd_read through bridge
      const fd = await bridge.pathOpen('/data/test-file.txt', O_RDONLY);
      const data = await bridge.fdRead(fd, 1024);
      expect(new TextDecoder().decode(data)).toBe('JS wrote this');
      bridge.fdClose(fd);
    });

    it('should write from C (WASIX) side and read in JS', async () => {
      // "C side" writes via fd_write through bridge
      const fd = await bridge.pathOpen('/data/c-output.txt', O_WRONLY | O_CREAT);
      await bridge.fdWrite(fd, new TextEncoder().encode('C wrote this'));
      bridge.fdClose(fd);

      // JS reads via AtuaFS
      const data = await mockFs.readFile('/c-output.txt');
      expect(new TextDecoder().decode(data)).toBe('C wrote this');
    });
  });

  describe('fd_stat', () => {
    it('should return file stats', async () => {
      const fd = await bridge.pathOpen('/data/hello.txt', O_RDONLY);
      const stat = await bridge.fdStat(fd);
      expect(stat.isFile).toBe(true);
      expect(stat.size).toBe(18); // "Hello from AtuaFS!"
      bridge.fdClose(fd);
    });
  });

  describe('fd_readdir', () => {
    it('should list directory entries', async () => {
      const dirFs = createMockFs({
        '/file1.txt': new TextEncoder().encode('a'),
        '/file2.txt': new TextEncoder().encode('b'),
      });
      bridge.mount({ guestPath: '/home', hostFs: dirFs });

      const fd = await bridge.pathOpen('/home', O_RDONLY);
      const entries = await bridge.fdReaddir(fd);
      expect(entries.length).toBe(2);
      expect(entries.map(e => e.name).sort()).toEqual(['file1.txt', 'file2.txt']);
      bridge.fdClose(fd);
    });
  });

  describe('fd_dup', () => {
    it('should duplicate a file descriptor', async () => {
      const fd = await bridge.pathOpen('/data/hello.txt', O_RDONLY);
      const fd2 = bridge.fdDup(fd);
      expect(fd2).not.toBe(fd);

      // Both should read the same file
      const data1 = await bridge.fdRead(fd, 1024);
      const data2 = await bridge.fdRead(fd2, 1024);
      expect(new TextDecoder().decode(data1)).toBe('Hello from AtuaFS!');
      expect(new TextDecoder().decode(data2)).toBe('Hello from AtuaFS!');

      bridge.fdClose(fd);
      bridge.fdClose(fd2);
    });
  });

  describe('error handling', () => {
    it('should throw on bad file descriptor', async () => {
      await expect(bridge.fdRead(999, 10)).rejects.toThrow('EBADF');
    });

    it('should throw on unmounted path', async () => {
      await expect(bridge.pathOpen('/nomount/file.txt', O_RDONLY)).rejects.toThrow('ENOENT');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ThreadBridge Tests
// ═══════════════════════════════════════════════════════════════
describe('ThreadBridge', () => {
  let bridge: ThreadBridge;

  beforeEach(() => {
    bridge = new ThreadBridge({ maxThreads: 8, stackSize: 2 * 1024 * 1024 });
  });

  it('should configure thread pool settings', () => {
    expect(bridge.maxThreads).toBe(8);
    const config = bridge.getWasixThreadConfig();
    expect(config.threadSpawnConfig.stackSize).toBe(2 * 1024 * 1024);
  });

  it('should use default concurrency when navigator is unavailable', () => {
    const defaultBridge = new ThreadBridge();
    expect(defaultBridge.maxThreads).toBeGreaterThan(0);
  });

  it('should track thread spawn and exit', () => {
    expect(bridge.activeThreadCount).toBe(0);
    expect(bridge.canSpawnThread).toBe(true);

    bridge.onThreadSpawned();
    bridge.onThreadSpawned();
    expect(bridge.activeThreadCount).toBe(2);

    bridge.onThreadExited();
    expect(bridge.activeThreadCount).toBe(1);
  });

  it('should respect max thread limit', () => {
    for (let i = 0; i < 8; i++) bridge.onThreadSpawned();
    expect(bridge.canSpawnThread).toBe(false);

    bridge.onThreadExited();
    expect(bridge.canSpawnThread).toBe(true);
  });

  it('should initialize shared memory', () => {
    const sab = bridge.initSharedMemory(4096);
    expect(sab).toBeDefined();
    expect(bridge.sharedMemory).toBe(sab);
  });

  it('should create mutex primitives', () => {
    const mutex = bridge.createMutex();
    expect(mutex.id).toBe(0);

    // Should be able to lock and unlock
    expect(mutex.tryLock()).toBe(true);
    mutex.unlock();
  });

  it('should create condvar primitives', () => {
    const condvar = bridge.createCondvar();
    expect(condvar.id).toBe(0);

    // notifyOne/notifyAll should not throw
    condvar.notifyOne();
    condvar.notifyAll();
  });
});

// ═══════════════════════════════════════════════════════════════
// ProcBridge Tests
// ═══════════════════════════════════════════════════════════════
describe('ProcBridge', () => {
  let bridge: ProcBridge;

  beforeEach(() => {
    bridge = new ProcBridge();
  });

  it('should exec a new process and assign a PID', () => {
    const handle = bridge.exec({ args: ['hello'] });
    expect(handle.pid).toBe(1);
    expect(bridge.activeProcessCount).toBe(1);
    expect(bridge.isAlive(handle.pid)).toBe(true);
  });

  it('should fork a process', () => {
    const handle = bridge.fork();
    expect(handle.pid).toBe(1);
    expect(bridge.isAlive(handle.pid)).toBe(true);
  });

  it('should kill a process', () => {
    const handle = bridge.exec({});
    expect(bridge.isAlive(handle.pid)).toBe(true);

    handle.kill();
    expect(bridge.isAlive(handle.pid)).toBe(false);
  });

  it('should handle IPC via MessageChannel', async () => {
    const handle = bridge.exec({});

    const received: unknown[] = [];
    handle.onMessage((data) => {
      received.push(data);
    });

    // Simulate a message from child to parent
    bridge._simulateMessage(handle.pid, { greeting: 'hello from child' });

    // Give MessageChannel time to deliver
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(received).toEqual([{ greeting: 'hello from child' }]);
  });

  it('should resolve wait() on process exit', async () => {
    const handle = bridge.exec({});

    // Simulate exit
    bridge._simulateExit(handle.pid, {
      exitCode: 0,
      stdout: 'output',
      stderr: '',
    });

    const result = await handle.wait();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('output');
  });

  it('should assign unique PIDs', () => {
    const h1 = bridge.exec({});
    const h2 = bridge.exec({});
    expect(h1.pid).not.toBe(h2.pid);
  });
});

// ═══════════════════════════════════════════════════════════════
// NetBridge Tests
// ═══════════════════════════════════════════════════════════════
describe('NetBridge', () => {
  describe('AtuaNetBridge', () => {
    let bridge: AtuaNetBridge;

    beforeEach(() => {
      bridge = new AtuaNetBridge();
    });

    it('should establish a connection', async () => {
      const handle = await bridge.connect('example.com', 443, true);
      expect(handle.id).toBe(1);
      expect(handle.host).toBe('example.com');
      expect(handle.port).toBe(443);
      expect(handle.tls).toBe(true);
      expect(handle.closed).toBe(false);
    });

    it('should send data over a stream', async () => {
      const handle = await bridge.connect('example.com', 80);
      const data = new TextEncoder().encode('GET / HTTP/1.1\r\n\r\n');
      const sent = await bridge.send(handle, data);
      expect(sent).toBe(data.length);
    });

    it('should close a stream', async () => {
      const handle = await bridge.connect('example.com', 80);
      expect(bridge.activeStreamCount).toBe(1);

      bridge.close(handle);
      expect(handle.closed).toBe(true);
      expect(bridge.activeStreamCount).toBe(0);
    });

    it('should throw when sending on closed stream', async () => {
      const handle = await bridge.connect('example.com', 80);
      bridge.close(handle);
      await expect(bridge.send(handle, new Uint8Array(1))).rejects.toThrow('Stream is closed');
    });

    it('should handle multiple concurrent streams', async () => {
      const h1 = await bridge.connect('a.com', 80);
      const h2 = await bridge.connect('b.com', 443, true);
      expect(bridge.activeStreamCount).toBe(2);
      expect(h1.id).not.toBe(h2.id);

      bridge.close(h1);
      expect(bridge.activeStreamCount).toBe(1);
    });
  });

  describe('NetBridge (swap interface)', () => {
    it('should use AtuaNetBridge by default', async () => {
      const bridge = new NetBridge();
      const handle = await bridge.connect('example.com', 80);
      expect(handle.host).toBe('example.com');
    });

    it('should allow swapping the implementation', async () => {
      const mockImpl: INetBridge = {
        connect: vi.fn().mockResolvedValue({ id: 99, host: 'mock.com', port: 80, tls: false, closed: false }),
        send: vi.fn().mockResolvedValue(10),
        recv: vi.fn().mockResolvedValue(new Uint8Array(0)),
        close: vi.fn(),
        fetch: vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, body: new Uint8Array(0) }),
      };

      const bridge = new NetBridge();
      bridge.setImplementation(mockImpl);

      const handle = await bridge.connect('mock.com', 80);
      expect(handle.host).toBe('mock.com');
      expect(handle.id).toBe(99);
      expect(mockImpl.connect).toHaveBeenCalledWith('mock.com', 80, undefined);
    });

    it('should accept custom implementation via constructor', async () => {
      const mockImpl: INetBridge = {
        connect: vi.fn().mockResolvedValue({ id: 1, host: 'custom.com', port: 443, tls: true, closed: false }),
        send: vi.fn(),
        recv: vi.fn(),
        close: vi.fn(),
        fetch: vi.fn(),
      };

      const bridge = new NetBridge(mockImpl);
      const handle = await bridge.connect('custom.com', 443, true);
      expect(handle.host).toBe('custom.com');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Integration test: bridges working together
// ═══════════════════════════════════════════════════════════════
describe('Bridge integration', () => {
  it('should coordinate fs-bridge read with net-bridge connect and thread-bridge spawn', async () => {
    // Set up fs-bridge with a file
    const fsBridge = new FsBridge();
    const mockFs = createMockFs({
      '/config.json': new TextEncoder().encode('{"host":"example.com","port":443}'),
    });
    fsBridge.mount({ guestPath: '/app', hostFs: mockFs });

    // Read config file via fs-bridge
    const fd = await fsBridge.pathOpen('/app/config.json', O_RDONLY);
    const configData = await fsBridge.fdRead(fd, 4096);
    const config = JSON.parse(new TextDecoder().decode(configData));
    fsBridge.fdClose(fd);

    // Use config to connect via net-bridge
    const netBridge = new AtuaNetBridge();
    const stream = await netBridge.connect(config.host, config.port, true);
    expect(stream.host).toBe('example.com');
    expect(stream.port).toBe(443);

    // Track thread for the network operation
    const threadBridge = new ThreadBridge();
    threadBridge.onThreadSpawned();
    expect(threadBridge.activeThreadCount).toBe(1);

    // Clean up
    netBridge.close(stream);
    threadBridge.onThreadExited();
    expect(threadBridge.activeThreadCount).toBe(0);
  });
});
