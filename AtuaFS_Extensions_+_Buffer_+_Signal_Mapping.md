# AtuaFS Extensions + Buffer + Signal Mapping

## Overview

Polish the filesystem, memory, and signal layers. Extend AtuaFS with POSIX metadata (symlinks, hardlinks, permission modes), implement a full Node-compatible `Buffer` backed by WASM memory, and map POSIX signals to browser-compatible events.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §1.4 Phase 8)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/6db5018d-0eef-4444-b097-ecbff9612404` (Module Router Full — need the complete module system to wire these into)

## Scope

### In Scope

**AtuaFS Extensions:**
- Symlinks: `fs.symlink()`, `fs.readlink()`, `fs.lstat()` — stored as metadata in AtuaFS (OPFS doesn't support real symlinks, so these are emulated via metadata)
- Hardlinks: `fs.link()` — emulated via reference counting in AtuaFS metadata
- Permission modes: `fs.chmod()`, `fs.chown()`, `fs.stat().mode` — stored as metadata, enforced at the fs-bridge level
- `fs.watch()` / `fs.watchFile()` — polling-based implementation (no real `inotify`/`kqueue`) with configurable interval

**Buffer:**
- Full Node `Buffer` implementation backed by WASM linear memory for zero-copy interop with C libraries
- `Buffer.alloc()`, `Buffer.allocUnsafe()`, `Buffer.from()`, `Buffer.concat()`
- All encoding support: `utf8`, `ascii`, `base64`, `base64url`, `hex`, `binary`/`latin1`, `utf16le`/`ucs2`
- `buffer.copy()`, `buffer.slice()`, `buffer.compare()`, `buffer.equals()`
- Zero-copy path: when a Buffer is passed to a C library (e.g., `crypto.createCipheriv`), the data is shared via WASM memory without copying

**Signal Mapping:**
- `process.on('SIGTERM', handler)` → `window.onbeforeunload` / Worker termination
- `process.on('SIGINT', handler)` → custom event (no browser equivalent, but packages check for the handler)
- `process.kill(pid, signal)` → Worker termination via `worker.terminate()`
- `process.exit(code)` → clean shutdown with exit handlers
- Best-effort mapping: signals that have no browser equivalent fire the handler but can't actually "signal" a process

### Out of Scope
- Real POSIX signals (SIGUSR1, SIGHUP, etc.) — no browser equivalent
- Real `inotify`/`kqueue` for `fs.watch()` — polling only
- Extended file attributes (xattr)

## Acceptance Criteria

1. `fs.symlink('target', 'link')` creates a symlink, `fs.readlink('link')` returns `'target'`
2. `fs.lstat('link')` returns stats with `isSymbolicLink() === true`
3. `fs.chmod('file', 0o755)` stores permissions, `fs.stat('file').mode` reflects them
4. `fs.watch('file')` fires `'change'` event when the file is modified
5. `Buffer.from('hello')` creates a Buffer backed by WASM memory
6. `Buffer.from(base64String, 'base64')` decodes correctly for all encoding types
7. Zero-copy: Buffer passed to `crypto.update(buf)` doesn't copy data between JS and WASM
8. `process.on('SIGTERM', fn)` registers a handler, `process.kill(process.pid, 'SIGTERM')` fires it
9. `process.exit(0)` runs all exit handlers and cleans up WASM instances
