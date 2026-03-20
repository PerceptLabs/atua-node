import { describe, it, expect } from 'vitest';
import {
  createSymlink, readSymlink, isSymlink, removeSymlink,
  createHardlink, getHardlinkCount, removeHardlink,
  setPermissions, getPermissions, setOwnership, getOwnership,
} from '../../src/vendor/fs-extensions.js';

describe('AtuaFS Extensions', () => {
  describe('Symlinks', () => {
    it('should create and read a symlink', () => {
      createSymlink('/link', '/target/file.txt');
      expect(readSymlink('/link')).toBe('/target/file.txt');
    });

    it('should detect symlinks', () => {
      createSymlink('/is-link', '/some/target');
      expect(isSymlink('/is-link')).toBe(true);
      expect(isSymlink('/not-link')).toBe(false);
    });

    it('should remove symlinks', () => {
      createSymlink('/temp-link', '/temp/target');
      removeSymlink('/temp-link');
      expect(isSymlink('/temp-link')).toBe(false);
    });

    it('should throw on readlink for non-symlink', () => {
      expect(() => readSymlink('/nonexistent')).toThrow('EINVAL');
    });
  });

  describe('Hardlinks', () => {
    it('should create a hardlink and track refcount', () => {
      createHardlink('/hard-link', '/original-file');
      expect(getHardlinkCount('/original-file')).toBe(2); // original + link
    });

    it('should decrement refcount on remove', () => {
      createHardlink('/hl-remove', '/hl-orig');
      expect(getHardlinkCount('/hl-orig')).toBeGreaterThanOrEqual(2);
      removeHardlink('/hl-remove');
    });

    it('should report 1 for files without hardlinks', () => {
      expect(getHardlinkCount('/no-links')).toBe(1);
    });
  });

  describe('Permissions', () => {
    it('should set and get permissions', () => {
      setPermissions('/chmod-test', 0o755);
      expect(getPermissions('/chmod-test')).toBe(0o755);
    });

    it('should default to 0o644', () => {
      expect(getPermissions('/no-chmod')).toBe(0o644);
    });

    it('should round-trip permissions', () => {
      setPermissions('/perm-roundtrip', 0o700);
      expect(getPermissions('/perm-roundtrip')).toBe(0o700);
      setPermissions('/perm-roundtrip', 0o644);
      expect(getPermissions('/perm-roundtrip')).toBe(0o644);
    });
  });

  describe('Ownership', () => {
    it('should set and get ownership', () => {
      setOwnership('/chown-test', 0, 0);
      expect(getOwnership('/chown-test')).toEqual({ uid: 0, gid: 0 });
    });

    it('should default to uid=1000 gid=1000', () => {
      expect(getOwnership('/no-chown')).toEqual({ uid: 1000, gid: 1000 });
    });
  });
});
