#!/bin/bash
WASI_SDK="$HOME/wasi-sdk"
CC="$WASI_SDK/bin/clang"
SYSROOT="$WASI_SDK/share/wasi-sysroot"
cd /mnt/c/Users/v1sua/atua-node

echo "=== Checking if OpenSSL Configure accepts wasm32-wasi ==="
cd native/openssl
perl Configure LIST 2>/dev/null | grep -i wasm || echo "No wasm target found"

echo ""
echo "=== Trying to compile a simple OpenSSL file ==="
"$CC" --target=wasm32-wasi "--sysroot=$SYSROOT" -O2 \
  -I include -I . \
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN \
  -DOPENSSL_NO_ASM -DOPENSSL_NO_ASYNC \
  -c crypto/evp/evp_enc.c -o /dev/null 2>&1 | head -20
