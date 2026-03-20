/*
 * libuv WASI process stubs.
 *
 * Replaces src/unix/process.c which uses fork(), execvp(), waitpid().
 * Process management is genuinely handled by proc-bridge in TypeScript,
 * so UV_ENOSYS is correct here.
 */
#include "uv.h"
#include "unix/internal.h"

#include <string.h>

int uv__process_init(uv_loop_t* loop) {
  memset(&loop->child_watcher, 0, sizeof(loop->child_watcher));
  return 0;
}

int uv_spawn(uv_loop_t* loop,
             uv_process_t* process,
             const uv_process_options_t* options) {
  /* Process spawning is handled by proc-bridge in TypeScript */
  return UV_ENOSYS;
}

void uv__wait_children(uv_loop_t* loop) {
  /* No child processes in WASM — proc-bridge handles this */
}

void uv__process_close(uv_process_t* handle) {
  uv__handle_stop(handle);
}

int uv_process_kill(uv_process_t* process, int signum) {
  return UV_ENOSYS;
}

int uv_kill(int pid, int signum) {
  return UV_ENOSYS;
}
