/*
 * WASI compatibility header for libuv.
 *
 * Included via -include before all libuv source files.
 * Makes uv/unix.h include uv/posix.h (which defines UV_PLATFORM_LOOP_FIELDS
 * with poll_fds fields needed by posix-poll.c).
 */
#ifndef LIBUV_WASI_COMPAT_H
#define LIBUV_WASI_COMPAT_H

/* Trigger the posix.h include path in uv/unix.h line 69.
 * GNU/Hurd uses the same platform backend (posix-poll + posix-hrtime)
 * that we use for WASI. We only need this for the header selection —
 * we do NOT compile hurd.c. */
#ifndef __GNU__
#define __GNU__ 1
#endif

/* Constants that wasix-libc may not define */
#ifndef PATH_MAX
#define PATH_MAX 4096
#endif

#ifndef IOV_MAX
#define IOV_MAX 1024
#endif

#ifndef MAXHOSTNAMELEN
#define MAXHOSTNAMELEN 256
#endif

#ifndef NI_MAXHOST
#define NI_MAXHOST 1025
#endif

#ifndef NI_MAXSERV
#define NI_MAXSERV 32
#endif

/* Process priority constants from sys/resource.h */
#ifndef PRIO_PROCESS
#define PRIO_PROCESS 0
#endif

/* SCM_RIGHTS for cmsg file-descriptor passing (used by core.c) */
#ifndef SCM_RIGHTS
#define SCM_RIGHTS 1
#endif

/* struct cmsghdr — wasix-libc's WASI path omits this (it's inside an
 * __wasilibc_unmodified_upstream block along with the CMSG macros).
 * We define the struct and macros here for libuv's core.c and stream.c. */
#include <__typedef_socklen_t.h>
#ifndef __wasilibc_cmsghdr_defined
#define __wasilibc_cmsghdr_defined
struct cmsghdr {
  socklen_t cmsg_len;
  int cmsg_level;
  int cmsg_type;
};
#endif

/* CMSG macros — also skipped by wasix-libc's WASI path */
#ifndef CMSG_ALIGN
#define CMSG_ALIGN(len) (((len) + sizeof(size_t) - 1) & (size_t)~(sizeof(size_t) - 1))
#endif
#ifndef CMSG_SPACE
#define CMSG_SPACE(len) (CMSG_ALIGN(len) + CMSG_ALIGN(sizeof(struct cmsghdr)))
#endif
#ifndef CMSG_LEN
#define CMSG_LEN(len) (CMSG_ALIGN(sizeof(struct cmsghdr)) + (len))
#endif
#ifndef CMSG_DATA
#define CMSG_DATA(cmsg) ((unsigned char *)((struct cmsghdr *)(cmsg) + 1))
#endif
#ifndef CMSG_FIRSTHDR
#define CMSG_FIRSTHDR(mhdr) \
  ((size_t)(mhdr)->msg_controllen >= sizeof(struct cmsghdr) \
   ? (struct cmsghdr *)(mhdr)->msg_control : (struct cmsghdr *)0)
#endif
#ifndef CMSG_NXTHDR
#define CMSG_NXTHDR(mhdr, cmsg) \
  ((cmsg)->cmsg_len < sizeof(struct cmsghdr) || \
   CMSG_ALIGN((cmsg)->cmsg_len) + sizeof(struct cmsghdr) > \
   (size_t)((char *)(mhdr)->msg_control + (mhdr)->msg_controllen - (char *)(cmsg)) \
   ? (struct cmsghdr *)0 \
   : (struct cmsghdr *)((char *)(cmsg) + CMSG_ALIGN((cmsg)->cmsg_len)))
#endif

#endif /* LIBUV_WASI_COMPAT_H */
