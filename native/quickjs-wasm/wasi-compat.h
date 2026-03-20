/* WASI compatibility for QuickJS */
#ifndef WASI_COMPAT_H
#define WASI_COMPAT_H

extern char **environ;

#ifndef sighandler_t
typedef void (*sighandler_t)(int);
#endif

#endif
