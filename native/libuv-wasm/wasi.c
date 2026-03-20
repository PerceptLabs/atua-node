/*
 * libuv WASI platform backend.
 *
 * Provides the per-platform query functions that each OS file
 * (linux.c, darwin.c, etc.) implements. Returns real values
 * that user code (process.*, os.*) will observe.
 */
#include "uv.h"
#include "unix/internal.h"

#include <string.h>
#include <time.h>
#include <stdlib.h>

int uv_exepath(char* buffer, size_t* size) {
  static const char path[] = "/usr/local/bin/node";

  if (buffer == NULL || size == NULL || *size == 0)
    return UV_EINVAL;

  if (*size <= sizeof(path) - 1) {
    memcpy(buffer, path, *size);
    return UV_EINVAL;
  }

  memcpy(buffer, path, sizeof(path));
  *size = sizeof(path) - 1;
  return 0;
}

int uv_resident_set_memory(size_t* rss) {
  /* Query actual WASM linear memory size */
  *rss = (size_t)__builtin_wasm_memory_size(0) * 65536;
  return 0;
}

uint64_t uv_get_free_memory(void) {
  /* WASM has a 4GB address space; report 2GB free as a sensible default */
  return (uint64_t)2 * 1024 * 1024 * 1024;
}

uint64_t uv_get_total_memory(void) {
  /* WASM32 has a 4GB address space */
  return (uint64_t)4 * 1024 * 1024 * 1024;
}

uint64_t uv_get_constrained_memory(void) {
  /* No memory constraint known in WASM — 0 means "no constraint" per libuv docs */
  return 0;
}

uint64_t uv_get_available_memory(void) {
  return uv_get_free_memory();
}

void uv_loadavg(double avg[3]) {
  /* Single-threaded WASM has no meaningful load average */
  avg[0] = 0.0;
  avg[1] = 0.0;
  avg[2] = 0.0;
}

int uv_uptime(double* uptime) {
  struct timespec ts;
  if (clock_gettime(CLOCK_MONOTONIC, &ts))
    return UV__ERR(errno);
  *uptime = ts.tv_sec + ts.tv_nsec / 1e9;
  return 0;
}

int uv_cpu_info(uv_cpu_info_t** cpu_infos, int* count) {
  uv_cpu_info_t* info;

  info = uv__calloc(1, sizeof(*info));
  if (info == NULL)
    return UV_ENOMEM;

  info->model = uv__strdup("wasm32");
  if (info->model == NULL) {
    uv__free(info);
    return UV_ENOMEM;
  }
  info->speed = 1000; /* 1 GHz nominal */
  /* cpu_times left zeroed by calloc — correct for WASM */

  *cpu_infos = info;
  *count = 1;
  return 0;
}

int uv_interface_addresses(uv_interface_address_t** addresses, int* count) {
  /* Networking is genuinely handled by net-bridge in TypeScript */
  *addresses = NULL;
  *count = 0;
  return UV_ENOSYS;
}

void uv_free_interface_addresses(uv_interface_address_t* addresses, int count) {
  int i;
  for (i = 0; i < count; i++) {
    uv__free(addresses[i].name);
  }
  if (count > 0)
    uv__free(addresses);
}
