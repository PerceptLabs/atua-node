#!/bin/bash
WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
cd /mnt/c/Users/v1sua/atua-node/native/openssl

# Try configuring OpenSSL for a generic 32-bit target with WASI cross-compilation
perl Configure linux-generic32 \
  no-ssl no-tls no-dtls no-engine no-afalgeng no-async \
  no-asm no-threads no-dso no-shared no-sock no-dgram \
  no-posix-io no-ui-console no-stdio \
  --cross-compile-prefix= \
  CC="$CC --target=wasm32-wasi --sysroot=$SYSROOT" \
  AR="$WASI_SDK/bin/llvm-ar" \
  RANLIB="$WASI_SDK/bin/llvm-ranlib" 2>&1 | tail -20

echo ""
echo "=== Check if configuration.h was generated ==="
ls -la include/openssl/configuration.h 2>/dev/null || echo "configuration.h NOT generated"
