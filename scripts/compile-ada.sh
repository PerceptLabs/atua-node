#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
CXX="$WASI_SDK/bin/clang++"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"
mkdir -p build/ada

# Create a modified ada.cpp that excludes the C API section (ada_c.cpp)
# The C API starts at "/* begin file src/ada_c.cpp */" around line 14896
sed '/\/\* begin file src\/ada_c\.cpp \*\//,$ d' native/ada-wasm/ada.cpp > build/ada/ada_no_capi.cpp

# Compile the ada C++ library (without C API)
"$CXX" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 -std=c++17 \
    -fno-exceptions -fno-rtti \
    -I native/ada-wasm \
    -c build/ada/ada_no_capi.cpp \
    -o build/ada/ada.o 2>&1

# Compile our shim (provides C API with TS-compatible signatures)
"$CXX" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 -std=c++17 \
    -fno-exceptions -fno-rtti \
    -I native/ada-wasm \
    -c native/ada-wasm/shim.cpp \
    -o build/ada/shim.o 2>&1

# Link into a WASI reactor
"$CXX" --target=wasm32-wasi "--sysroot=$SYSROOT" \
    -fno-exceptions \
    -mexec-model=reactor -Wl,--export-all \
    -o wasm/ada.wasm \
    build/ada/ada.o build/ada/shim.o 2>&1

echo "OK wasm/ada.wasm"
ls -lh wasm/ada.wasm
