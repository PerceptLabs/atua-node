#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
CC="$WASI_SDK/bin/clang"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"
mkdir -p build/llhttp

for f in src/llhttp.c src/api.c src/http.c; do
  "$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
    -I native/llhttp/include \
    -c "native/llhttp/$f" \
    -o "build/llhttp/$(basename $f .c).o"
done

"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -I native/llhttp/include \
  -c native/llhttp-wasm/shim.c \
  -o build/llhttp/shim.o

"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" \
  -mexec-model=reactor -Wl,--export-all \
  -o wasm/llhttp.wasm \
  build/llhttp/*.o

echo "OK wasm/llhttp.wasm"
ls -lh wasm/llhttp.wasm
