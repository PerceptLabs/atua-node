#!/bin/bash
WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
cd /mnt/c/Users/v1sua/atua-node

echo "=== Attempting libuv core.c compilation ==="
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -I native/libuv/include -I native/libuv/src \
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN \
  -c native/libuv/src/unix/core.c -o /dev/null 2>&1 | head -30

echo ""
echo "=== Attempting libuv uv-common.c compilation ==="
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -I native/libuv/include -I native/libuv/src \
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN \
  -c native/libuv/src/uv-common.c -o /dev/null 2>&1 | head -10
