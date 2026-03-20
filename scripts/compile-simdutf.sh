#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
CXX="$WASI_SDK/bin/clang++"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"
mkdir -p build/simdutf

# Use the single-header amalgamation (scalar fallback — no SIMD in WASM)
"$CXX" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 -std=c++17 \
    -fno-exceptions -fno-rtti \
    -I native/simdutf/singleheader \
    -c native/simdutf/singleheader/simdutf.cpp \
    -o build/simdutf/simdutf.o 2>&1

# Compile our shim
"$CXX" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 -std=c++17 \
    -fno-exceptions -fno-rtti \
    -I native/simdutf/singleheader \
    -c native/simdutf-wasm/shim.cpp \
    -o build/simdutf/shim.o 2>&1

# Link into a WASI reactor
"$CXX" --target=wasm32-wasi "--sysroot=$SYSROOT" \
    -fno-exceptions \
    -mexec-model=reactor -Wl,--export-all \
    -o wasm/simdutf.wasm \
    build/simdutf/simdutf.o build/simdutf/shim.o 2>&1

echo "OK wasm/simdutf.wasm"
ls -lh wasm/simdutf.wasm
