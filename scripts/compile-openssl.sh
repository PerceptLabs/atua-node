#!/bin/bash
set -euo pipefail

WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
PROJECT="/mnt/c/Users/v1sua/atua-node"
cd "$PROJECT/native/openssl"

# Reconfigure with relaxed warnings to get past implicit function declarations
perl Configure linux-generic32 \
  no-ssl no-tls no-dtls no-engine no-afalgeng no-async \
  no-asm no-threads no-dso no-shared no-sock no-dgram \
  no-posix-io no-ui-console no-stdio \
  --cross-compile-prefix= \
  CC="$CC --target=wasm32-wasi --sysroot=$SYSROOT -Wno-error=implicit-function-declaration -Dtimegm=mktime -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS" \
  AR="$WASI_SDK/bin/llvm-ar" \
  RANLIB="$WASI_SDK/bin/llvm-ranlib" 2>&1 | tail -5

# Try building - capture errors to understand remaining blockers
make -j4 build_libs 2>&1 | grep "error:" | sort -u | head -30

echo ""
echo "=== Check if libcrypto.a was built ==="
ls -lh libcrypto.a 2>/dev/null || echo "libcrypto.a NOT built"
