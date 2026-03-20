/**
 * AtuaFS extensions: symlinks, hardlinks, permissions.
 *
 * Metadata layer stored in-memory (Maps). Emulates POSIX
 * filesystem features not supported by OPFS.
 */

// ── Symlink metadata ────────────────────────────────────────
const _symlinks = new Map<string, string>(); // path → target

export function createSymlink(linkPath: string, target: string): void {
  _symlinks.set(normalize(linkPath), target);
}

export function readSymlink(linkPath: string): string {
  const target = _symlinks.get(normalize(linkPath));
  if (!target) {
    throw Object.assign(new Error(`EINVAL: not a symlink, readlink '${linkPath}'`), { code: 'EINVAL' });
  }
  return target;
}

export function isSymlink(path: string): boolean {
  return _symlinks.has(normalize(path));
}

export function removeSymlink(path: string): void {
  _symlinks.delete(normalize(path));
}

// ── Hardlink metadata (reference counting) ──────────────────
const _hardlinks = new Map<string, { target: string; refcount: number }>();
const _inodePaths = new Map<string, Set<string>>(); // target → set of paths

export function createHardlink(newPath: string, existingPath: string): void {
  const np = normalize(newPath);
  const ep = normalize(existingPath);

  // Track the link
  _hardlinks.set(np, { target: ep, refcount: 1 });

  // Update inode tracking
  const paths = _inodePaths.get(ep) ?? new Set<string>();
  paths.add(np);
  paths.add(ep);
  _inodePaths.set(ep, paths);
}

export function getHardlinkCount(path: string): number {
  const p = normalize(path);
  // Check if this path IS a hardlink target
  const paths = _inodePaths.get(p);
  if (paths) return paths.size;
  // Check if this path is linked to another
  const link = _hardlinks.get(p);
  if (link) {
    const targetPaths = _inodePaths.get(link.target);
    return targetPaths?.size ?? 1;
  }
  return 1;
}

export function removeHardlink(path: string): void {
  const p = normalize(path);
  const link = _hardlinks.get(p);
  if (link) {
    const paths = _inodePaths.get(link.target);
    if (paths) {
      paths.delete(p);
      if (paths.size === 0) _inodePaths.delete(link.target);
    }
    _hardlinks.delete(p);
  }
}

// ── Permission metadata ─────────────────────────────────────
const _permissions = new Map<string, number>(); // path → mode (e.g., 0o755)
const _ownership = new Map<string, { uid: number; gid: number }>();

export function setPermissions(path: string, mode: number): void {
  _permissions.set(normalize(path), mode);
}

export function getPermissions(path: string): number {
  return _permissions.get(normalize(path)) ?? 0o644; // default file mode
}

export function setOwnership(path: string, uid: number, gid: number): void {
  _ownership.set(normalize(path), { uid, gid });
}

export function getOwnership(path: string): { uid: number; gid: number } {
  return _ownership.get(normalize(path)) ?? { uid: 1000, gid: 1000 };
}

// ── Helper ──────────────────────────────────────────────────

function normalize(p: string): string {
  if (!p.startsWith('/')) p = '/' + p;
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}
