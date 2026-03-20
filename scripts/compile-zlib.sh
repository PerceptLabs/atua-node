#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
CC="$WASI_SDK/bin/clang"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"
mkdir -p build/zlib

# Core zlib only — exclude gz* files which use lseek (not available in WASI)
ZLIB_SRCS="adler32.c compress.c crc32.c deflate.c infback.c inffast.c inflate.c inftrees.c trees.c uncompr.c zutil.c"

for f in $ZLIB_SRCS; do
  "$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 -I native/zlib -c "native/zlib/$f" -o "build/zlib/$(basename $f .c).o"
done

# Compile the shim
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 -I native/zlib -c native/zlib-wasm/shim.c -o build/zlib/shim.o

# Link into a WASI reactor
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" \
  -mexec-model=reactor -Wl,--export-all \
  -o wasm/zlib.wasm \
  build/zlib/*.o

echo "✓ wasm/zlib.wasm"
ls -lh wasm/zlib.wasm
