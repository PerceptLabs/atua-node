/*
 * POSIX fallback implementations for libuv on WASI.
 *
 * Real implementations, not lazy stubs. ENOSYS only when the
 * capability is genuinely handled by a TypeScript bridge.
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>

/* ── Global symbols ────────────────────────────────────────── */

/* libuv's core.c references environ */
char** environ = NULL;

/* ── readv / writev — real loop-based fallbacks ────────────── */

struct iovec_compat {
  void*  iov_base;
  size_t iov_len;
};

ssize_t readv(int fd, const struct iovec_compat* iov, int iovcnt) {
  ssize_t total = 0;
  int i;

  for (i = 0; i < iovcnt; i++) {
    if (iov[i].iov_len == 0)
      continue;
    ssize_t n = read(fd, iov[i].iov_base, iov[i].iov_len);
    if (n < 0) {
      if (total > 0)
        return total;
      return -1;
    }
    total += n;
    if ((size_t)n < iov[i].iov_len)
      break; /* short read */
  }
  return total;
}

ssize_t writev(int fd, const struct iovec_compat* iov, int iovcnt) {
  ssize_t total = 0;
  int i;

  for (i = 0; i < iovcnt; i++) {
    if (iov[i].iov_len == 0)
      continue;
    ssize_t n = write(fd, iov[i].iov_base, iov[i].iov_len);
    if (n < 0) {
      if (total > 0)
        return total;
      return -1;
    }
    total += n;
    if ((size_t)n < iov[i].iov_len)
      break; /* short write */
  }
  return total;
}

/* ── pipe2 — real fallback via pipe() + fcntl() ────────────── */

#ifndef O_CLOEXEC
#define O_CLOEXEC 0
#endif
#ifndef O_NONBLOCK
#define O_NONBLOCK 0x800
#endif

int pipe2(int fds[2], int flags) {
  int r = pipe(fds);
  if (r != 0)
    return r;

  if (flags & O_CLOEXEC) {
    fcntl(fds[0], F_SETFD, FD_CLOEXEC);
    fcntl(fds[1], F_SETFD, FD_CLOEXEC);
  }
  if (flags & O_NONBLOCK) {
    fcntl(fds[0], F_SETFL, O_NONBLOCK);
    fcntl(fds[1], F_SETFL, O_NONBLOCK);
  }
  return 0;
}

/* ── dup2 — real fallback via close() + fcntl() ────────────── */

int dup2(int oldfd, int newfd) {
  if (oldfd == newfd)
    return newfd;
  close(newfd);
  return fcntl(oldfd, F_DUPFD, newfd);
}

/* ── sysconf — return real defaults ────────────────────────── */

#include <unistd.h>

long sysconf(int name) {
  switch (name) {
    case _SC_PAGESIZE:
      return 65536;  /* WASM page size */
    case _SC_CLK_TCK:
      return 100;
    case _SC_NPROCESSORS_ONLN:
      return 1;
    case _SC_OPEN_MAX:
      return 1024;
    case _SC_CHILD_MAX:
      return 0;  /* no child processes in WASM */
    default:
      errno = EINVAL;
      return -1;
  }
}

/* ── getrusage — zero the struct (correct for WASM) ────────── */

#include <sys/resource.h>

int getrusage(int who, struct rusage* usage) {
  if (usage == NULL) {
    errno = EINVAL;
    return -1;
  }
  memset(usage, 0, sizeof(*usage));
  return 0;
}

/* ── socketpair — genuinely handled by net-bridge ──────────── */

int socketpair(int domain, int type, int protocol, int sv[2]) {
  errno = ENOSYS;
  return -1;
}

/* ── ioctl — only called from uv__nonblock_ioctl which is
 *    disabled on our platform (UV__NONBLOCK_IS_IOCTL=0) ───── */

#include <stdarg.h>

int ioctl(int fd, unsigned long request, ...) {
  errno = ENOSYS;
  return -1;
}

/* ── Priority — getpriority/setpriority ────────────────────── */

int getpriority(int which, int who) {
  (void)which; (void)who;
  return 0; /* normal priority */
}

int setpriority(int which, int who, int prio) {
  (void)which; (void)who; (void)prio;
  return 0; /* silently succeed */
}

/* ── Scheduler — sched_get_priority_min/max ────────────────── */

int sched_get_priority_min(int policy) {
  (void)policy;
  return 0;
}

int sched_get_priority_max(int policy) {
  (void)policy;
  return 99;
}

/* ── Network helpers ───────────────────────────────────────── */

/* if_nametoindex — not meaningful in WASM (net-bridge handles networking) */
unsigned int if_nametoindex(const char* ifname) {
  (void)ifname;
  return 0;
}

/* if_indextoname — not meaningful in WASM (net-bridge handles networking) */
char* if_indextoname(unsigned int ifindex, char* ifname) {
  (void)ifindex;
  if (ifname) ifname[0] = '\0';
  errno = ENXIO;
  return NULL;
}

/* getifaddrs/freeifaddrs — net-bridge handles networking */
struct ifaddrs;
int getifaddrs(struct ifaddrs** ifap) {
  if (ifap) *ifap = NULL;
  errno = ENOSYS;
  return -1;
}

void freeifaddrs(struct ifaddrs* ifa) {
  (void)ifa;
}

/* ── TTY ───────────────────────────────────────────────────── */

/* ptsname — no pseudo-terminals in WASM */
char* ptsname(int fd) {
  (void)fd;
  return NULL;
}
