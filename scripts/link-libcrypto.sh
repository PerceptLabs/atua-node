#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"

# Link libcrypto.a into a WASI reactor module
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" \
  -mexec-model=reactor -Wl,--export-all \
  -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS \
  -lwasi-emulated-mman -lwasi-emulated-signal -lwasi-emulated-process-clocks \
  native/openssl-wasm/stubs.c \
  -Wl,--whole-archive -Lnative/openssl -lcrypto -Wl,--no-whole-archive \
  -o wasm/libcrypto.wasm

echo "OK wasm/libcrypto.wasm"
ls -lh wasm/libcrypto.wasm
