#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$HOME/wasix-sysroot/wasix-sysroot/sysroot"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"
mkdir -p build/libuv

CFLAGS="--target=wasm32-wasi --sysroot=$SYSROOT -O2"
CFLAGS="$CFLAGS -I native/libuv-wasm/include -I native/libuv/include -I native/libuv/src"
CFLAGS="$CFLAGS -include native/libuv-wasm/wasi-compat.h"
CFLAGS="$CFLAGS -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE"
CFLAGS="$CFLAGS -D_WASI_EMULATED_SIGNAL"
CFLAGS="$CFLAGS -D_WASI_EMULATED_PROCESS_CLOCKS"
CFLAGS="$CFLAGS -D_WASI_EMULATED_MMAN"
CFLAGS="$CFLAGS -Wno-implicit-function-declaration"
CFLAGS="$CFLAGS -Wno-int-conversion"
CFLAGS="$CFLAGS -pthread -matomics -mbulk-memory"

compile_file() {
  local src="$1"
  local out="build/libuv/$(basename "$src" .c).o"
  echo "  CC $src"
  $CC $CFLAGS -c "$src" -o "$out"
}

# --- Core (platform-independent) ---
echo "=== Core sources ==="
for f in fs-poll.c idna.c inet.c random.c strscpy.c strtok.c \
         thread-common.c threadpool.c timer.c uv-common.c \
         uv-data-getter-setters.c version.c; do
  compile_file "native/libuv/src/$f"
done

# --- Unix base (process.c excluded — replaced by process-stub.c) ---
echo "=== Unix base sources ==="
for f in async.c core.c dl.c fs.c getaddrinfo.c getnameinfo.c \
         loop-watcher.c loop.c pipe.c poll.c random-devurandom.c \
         signal.c stream.c tcp.c thread.c tty.c udp.c; do
  compile_file "native/libuv/src/unix/$f"
done

# --- Platform selection (same as Haiku/QNX/GNU) ---
echo "=== Platform sources ==="
for f in posix-poll.c posix-hrtime.c no-fsevents.c no-proctitle.c; do
  compile_file "native/libuv/src/unix/$f"
done

# --- WASI backend ---
echo "=== WASI backend ==="
compile_file "native/libuv-wasm/wasi.c"
compile_file "native/libuv-wasm/process-stub.c"
compile_file "native/libuv-wasm/stubs.c"

# --- Link ---
echo "=== Linking libuv.wasm ==="
$CC --target=wasm32-wasi "--sysroot=$SYSROOT" \
  -pthread -mexec-model=reactor -Wl,--export-all \
  -Wl,--shared-memory -Wl,--import-memory -Wl,--export-memory \
  -lwasi-emulated-process-clocks \
  -lwasi-emulated-mman \
  -lpthread \
  -o wasm/libuv.wasm \
  build/libuv/*.o

echo "OK wasm/libuv.wasm"
ls -lh wasm/libuv.wasm
