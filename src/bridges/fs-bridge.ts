/**
 * FsBridge — Maps WASIX filesystem syscalls to AtuaFS (OPFS-backed).
 *
 * Uses @wasmer/sdk Directory mounts to share AtuaFS directories with WASIX modules.
 * WASIX modules see a POSIX-like filesystem: fd_read, fd_write, path_open,
 * fd_stat, fd_readdir, fd_dup — all routed through AtuaFS.
 */

/** Represents a file descriptor in the WASIX filesystem */
export interface FileDescriptor {
  fd: number;
  path: string;
  flags: number;
  offset: number;
}

/** File stat information */
export interface FileStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  lastModified: number;
}

/** Directory entry from fd_readdir */
export interface DirEntry {
  name: string;
  type: 'file' | 'directory';
}

/** Abstract filesystem interface that AtuaFS implements */
export interface FileSystem {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  stat(path: string): Promise<FileStat>;
  readdir(path: string): Promise<DirEntry[]>;
  mkdir(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/** Mount configuration for WASIX modules */
export interface MountConfig {
  /** WASIX mount path (e.g., '/data', '/home') */
  guestPath: string;
  /** Host filesystem to mount */
  hostFs: FileSystem;
}

// Open file flags (POSIX-compatible)
export const O_RDONLY = 0;
export const O_WRONLY = 1;
export const O_RDWR = 2;
export const O_CREAT = 64;
export const O_TRUNC = 512;
export const O_APPEND = 1024;

export class FsBridge {
  private _mounts = new Map<string, FileSystem>();
  private _fds = new Map<number, FileDescriptor>();
  private _nextFd = 3; // 0=stdin, 1=stdout, 2=stderr

  /** Mount a filesystem at a guest path */
  mount(config: MountConfig): void {
    this._mounts.set(config.guestPath, config.hostFs);
  }

  /** Unmount a filesystem */
  unmount(guestPath: string): boolean {
    return this._mounts.delete(guestPath);
  }

  /** Get all current mounts */
  getMounts(): Map<string, FileSystem> {
    return new Map(this._mounts);
  }

  /**
   * Build the mount config object for @wasmer/sdk runWasix().
   * Returns a Record<string, Directory> suitable for the `mount` option.
   */
  buildWasixMounts(): Record<string, FileSystem> {
    const mounts: Record<string, FileSystem> = {};
    for (const [guestPath, hostFs] of this._mounts) {
      mounts[guestPath] = hostFs;
    }
    return mounts;
  }

  /** Resolve a guest path to a mount point and relative path */
  private _resolvePath(guestPath: string): { fs: FileSystem; relativePath: string } | null {
    for (const [mountPoint, fs] of this._mounts) {
      if (guestPath === mountPoint || guestPath.startsWith(mountPoint + '/')) {
        const relativePath = guestPath === mountPoint ? '/' : guestPath.slice(mountPoint.length);
        return { fs, relativePath };
      }
    }
    return null;
  }

  /** path_open — Open a file and return a file descriptor */
  async pathOpen(path: string, flags: number): Promise<number> {
    const resolved = this._resolvePath(path);
    if (!resolved) {
      throw new Error(`ENOENT: no mount found for path '${path}'`);
    }

    // If creating, ensure parent directory exists
    if (flags & O_CREAT) {
      const dirPath = path.substring(0, path.lastIndexOf('/')) || '/';
      const dirResolved = this._resolvePath(dirPath);
      if (dirResolved) {
        try {
          await dirResolved.fs.exists(dirResolved.relativePath);
        } catch {
          // Parent doesn't exist — let it fail on write
        }
      }
    }

    const fd = this._nextFd++;
    this._fds.set(fd, { fd, path, flags, offset: 0 });
    return fd;
  }

  /** fd_read — Read from a file descriptor */
  async fdRead(fd: number, length: number): Promise<Uint8Array> {
    const desc = this._fds.get(fd);
    if (!desc) throw new Error(`EBADF: bad file descriptor ${fd}`);

    const resolved = this._resolvePath(desc.path);
    if (!resolved) throw new Error(`ENOENT: path not found '${desc.path}'`);

    const data = await resolved.fs.readFile(resolved.relativePath);
    const slice = data.slice(desc.offset, desc.offset + length);
    desc.offset += slice.length;
    return slice;
  }

  /** fd_write — Write to a file descriptor */
  async fdWrite(fd: number, data: Uint8Array): Promise<number> {
    const desc = this._fds.get(fd);
    if (!desc) throw new Error(`EBADF: bad file descriptor ${fd}`);

    const resolved = this._resolvePath(desc.path);
    if (!resolved) throw new Error(`ENOENT: path not found '${desc.path}'`);

    if (desc.flags & O_APPEND) {
      // Append mode: read existing, concatenate, write back
      try {
        const existing = await resolved.fs.readFile(resolved.relativePath);
        const combined = new Uint8Array(existing.length + data.length);
        combined.set(existing);
        combined.set(data, existing.length);
        await resolved.fs.writeFile(resolved.relativePath, combined);
      } catch {
        // File may not exist — just write
        await resolved.fs.writeFile(resolved.relativePath, data);
      }
    } else {
      await resolved.fs.writeFile(resolved.relativePath, data);
    }

    desc.offset += data.length;
    return data.length;
  }

  /** fd_stat — Get file stat from a file descriptor */
  async fdStat(fd: number): Promise<FileStat> {
    const desc = this._fds.get(fd);
    if (!desc) throw new Error(`EBADF: bad file descriptor ${fd}`);

    const resolved = this._resolvePath(desc.path);
    if (!resolved) throw new Error(`ENOENT: path not found '${desc.path}'`);

    return resolved.fs.stat(resolved.relativePath);
  }

  /** fd_readdir — List directory entries */
  async fdReaddir(fd: number): Promise<DirEntry[]> {
    const desc = this._fds.get(fd);
    if (!desc) throw new Error(`EBADF: bad file descriptor ${fd}`);

    const resolved = this._resolvePath(desc.path);
    if (!resolved) throw new Error(`ENOENT: path not found '${desc.path}'`);

    return resolved.fs.readdir(resolved.relativePath);
  }

  /** fd_dup — Duplicate a file descriptor */
  fdDup(fd: number): number {
    const desc = this._fds.get(fd);
    if (!desc) throw new Error(`EBADF: bad file descriptor ${fd}`);

    const newFd = this._nextFd++;
    this._fds.set(newFd, { ...desc, fd: newFd });
    return newFd;
  }

  /** fd_close — Close a file descriptor */
  fdClose(fd: number): void {
    if (!this._fds.has(fd)) throw new Error(`EBADF: bad file descriptor ${fd}`);
    this._fds.delete(fd);
  }

  /** Get the number of open file descriptors */
  get openFdCount(): number {
    return this._fds.size;
  }
}
