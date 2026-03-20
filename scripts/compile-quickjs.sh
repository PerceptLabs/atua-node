#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
PROJECT="/mnt/c/Users/v1sua/atua-node"

cd "$PROJECT"
mkdir -p build/quickjs

# QuickJS source files for reactor mode
# qjs-wasi-reactor.c includes qjs.c which includes quickjs-libc.c
# quickjs.c = core engine, qjs.c = CLI frontend (included by qjs-wasi-reactor.c)
QJS_SRCS="quickjs.c libregexp.c libunicode.c dtoa.c"

# Compile each source file
for f in $QJS_SRCS; do
  "$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
    -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS \
    -DCONFIG_VERSION=\"2024-02-14\" \
    -DCONFIG_BIGNUM \
    -I native/quickjs \
    -c "native/quickjs/$f" \
    -o "build/quickjs/$(basename $f .c).o" 2>&1
done

# Compile quickjs-libc.c with extra stubs for WASI
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS \
  -DCONFIG_VERSION=\"2024-02-14\" \
  -DCONFIG_BIGNUM \
  -Wno-implicit-function-declaration \
  -include native/quickjs-wasm/wasi-compat.h \
  -I native/quickjs \
  -c "native/quickjs/quickjs-libc.c" \
  -o build/quickjs/quickjs-libc.o 2>&1

# Compile the reactor entry point
# qjs-wasi-reactor.c does #include "qjs.c", so DON'T compile qjs.c separately
# Remove the qjs.o we compiled above to avoid duplicate symbols
rm -f build/quickjs/qjs.o 2>/dev/null || true
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS \
  -DCONFIG_VERSION=\"2024-02-14\" \
  -DCONFIG_BIGNUM \
  -Wno-implicit-function-declaration \
  -include native/quickjs-wasm/wasi-compat.h \
  -I native/quickjs \
  -c "native/quickjs/qjs-wasi-reactor.c" \
  -o build/quickjs/qjs-wasi-reactor.o 2>&1

# Compile stubs
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -c native/quickjs-wasm/stubs.c \
  -o build/quickjs/stubs.o 2>&1

# Link into WASI reactor
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" \
  -mexec-model=reactor -Wl,--export-all \
  -lwasi-emulated-signal -lwasi-emulated-process-clocks \
  -o wasm/quickjs.wasm \
  build/quickjs/*.o 2>&1

echo "OK wasm/quickjs.wasm"
ls -lh wasm/quickjs.wasm
