#!/usr/bin/env bash
# Build a C/C++ project in native/<name> to wasm/<name>.wasm
#
# Usage:
#   scripts/build-wasm.sh hello          # builds native/hello → wasm/hello.wasm
#   scripts/build-wasm.sh zlib           # builds native/zlib  → wasm/zlib.wasm
#   scripts/build-wasm.sh --all          # builds all projects in native/
#
# Prerequisites:
#   - wasi-sdk installed at $WASI_SDK_PATH (default: /opt/wasi-sdk)
#   - wasix-libc sysroot at $WASIX_SYSROOT (default: /opt/wasix-sysroot)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLCHAIN_FILE="$PROJECT_ROOT/toolchain/wasix.cmake"
NATIVE_DIR="$PROJECT_ROOT/native"
WASM_DIR="$PROJECT_ROOT/wasm"
BUILD_DIR="$PROJECT_ROOT/build"

# ── Pinned versions ────────────────────────────────────────────
WASI_SDK_VERSION="24"
WASIX_LIBC_COMMIT="main"  # Pin to specific commit in CI

# ── Validate environment ───────────────────────────────────────
WASI_SDK_PATH="${WASI_SDK_PATH:-/opt/wasi-sdk}"
WASIX_SYSROOT="${WASIX_SYSROOT:-/opt/wasix-sysroot}"

validate_toolchain() {
  if [ ! -f "$WASI_SDK_PATH/bin/clang" ]; then
    echo "ERROR: wasi-sdk not found at $WASI_SDK_PATH"
    echo "Install: https://github.com/aspect-build/aspect-workflows/blob/main/docs/wasi-sdk.md"
    echo ""
    echo "Quick install (Linux/macOS):"
    echo "  export WASI_SDK_VERSION=$WASI_SDK_VERSION"
    echo "  curl -sL https://github.com/aspect-build/aspect-workflows/releases/download/wasi-sdk-\${WASI_SDK_VERSION}/wasi-sdk-\${WASI_SDK_VERSION}.0-linux.tar.gz | tar xz -C /opt"
    echo "  mv /opt/wasi-sdk-\${WASI_SDK_VERSION}.0 /opt/wasi-sdk"
    exit 1
  fi

  if [ ! -d "$WASIX_SYSROOT" ]; then
    echo "ERROR: wasix-libc sysroot not found at $WASIX_SYSROOT"
    echo "Clone: git clone https://github.com/aspect-build/aspect-workflows wasix-libc && cd wasix-libc && make"
    exit 1
  fi

  echo "✓ wasi-sdk: $WASI_SDK_PATH"
  echo "✓ wasix-libc: $WASIX_SYSROOT"
}

# ── Build a single project ─────────────────────────────────────
build_project() {
  local name="$1"
  local src_dir="$NATIVE_DIR/$name"
  local build_dir="$BUILD_DIR/$name"
  local output="$WASM_DIR/$name.wasm"

  if [ ! -d "$src_dir" ]; then
    echo "ERROR: Project directory not found: $src_dir"
    exit 1
  fi

  echo "── Building $name ──────────────────────────────"

  # Simple single-file builds (no CMakeLists.txt)
  if [ ! -f "$src_dir/CMakeLists.txt" ]; then
    local c_files=("$src_dir"/*.c)
    if [ ${#c_files[@]} -eq 0 ]; then
      echo "ERROR: No .c files found in $src_dir"
      exit 1
    fi

    mkdir -p "$WASM_DIR"
    "$WASI_SDK_PATH/bin/clang" \
      --target=wasm32-wasi \
      --sysroot="$WASIX_SYSROOT" \
      -D_WASI_EMULATED_SIGNAL \
      -D_WASI_EMULATED_PROCESS_CLOCKS \
      -D_WASI_EMULATED_MMAN \
      -O2 \
      -o "$output" \
      "${c_files[@]}"

    echo "✓ $output ($(wc -c < "$output") bytes)"
    return
  fi

  # CMake-based builds
  mkdir -p "$build_dir"
  cmake -S "$src_dir" -B "$build_dir" \
    -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN_FILE" \
    -DCMAKE_BUILD_TYPE=Release \
    -DWASI_SDK_PATH="$WASI_SDK_PATH" \
    -DWASIX_SYSROOT="$WASIX_SYSROOT"

  cmake --build "$build_dir" --parallel

  # Copy output to wasm/
  mkdir -p "$WASM_DIR"
  find "$build_dir" -name "*.wasm" -exec cp {} "$output" \;

  echo "✓ $output"
}

# ── Main ────────────────────────────────────────────────────────
if [ $# -eq 0 ]; then
  echo "Usage: $0 <project-name|--all>"
  exit 1
fi

validate_toolchain

if [ "$1" = "--all" ]; then
  for dir in "$NATIVE_DIR"/*/; do
    name="$(basename "$dir")"
    [ "$name" = ".git" ] && continue
    build_project "$name"
  done
else
  build_project "$1"
fi

echo ""
echo "Build complete."
