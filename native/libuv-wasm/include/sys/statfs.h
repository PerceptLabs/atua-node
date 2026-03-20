/* sys/statfs.h stub for WASI — provides struct statfs with real defaults */
#ifndef _SYS_STATFS_H
#define _SYS_STATFS_H

struct statfs {
  unsigned long f_type;
  unsigned long f_bsize;
  unsigned long f_blocks;
  unsigned long f_bfree;
  unsigned long f_bavail;
  unsigned long f_files;
  unsigned long f_ffree;
  unsigned long f_namelen;
};

static inline int statfs(const char *path, struct statfs *buf) {
  (void)path;
  if (buf) {
    buf->f_type = 0;
    buf->f_bsize = 65536;   /* WASM page size */
    buf->f_blocks = 65536;  /* ~4GB at 64KB pages */
    buf->f_bfree = 32768;
    buf->f_bavail = 32768;
    buf->f_files = 1024;
    buf->f_ffree = 512;
    buf->f_namelen = 255;
  }
  return 0;
}

#endif /* _SYS_STATFS_H */
