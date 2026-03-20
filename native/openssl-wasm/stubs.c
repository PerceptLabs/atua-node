/* POSIX stubs for OpenSSL on WASI.
 * These functions are not available in the WASI sysroot but are
 * called by OpenSSL's memory security and threading code. */
#include <stddef.h>
#include <errno.h>

int mlock(const void *addr, size_t len) {
    (void)addr; (void)len;
    errno = ENOSYS;
    return -1;
}

int madvise(void *addr, size_t len, int advice) {
    (void)addr; (void)len; (void)advice;
    return 0;
}

int getpid(void) {
    return 1;
}
