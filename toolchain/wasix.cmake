# CMake toolchain file for cross-compiling C/C++ to WASIX
# Requires: wasi-sdk (clang) + wasix-libc sysroot
#
# Usage:
#   cmake -DCMAKE_TOOLCHAIN_FILE=toolchain/wasix.cmake ..
#
# Environment variables:
#   WASI_SDK_PATH  - Path to wasi-sdk installation (default: /opt/wasi-sdk)
#   WASIX_SYSROOT  - Path to wasix-libc sysroot (default: /opt/wasix-sysroot)

set(CMAKE_SYSTEM_NAME WASI)
set(CMAKE_SYSTEM_VERSION 1)
set(CMAKE_SYSTEM_PROCESSOR wasm32)

# ── wasi-sdk paths ──────────────────────────────────────────────
if(NOT DEFINED ENV{WASI_SDK_PATH})
  set(WASI_SDK_PATH "/opt/wasi-sdk" CACHE PATH "Path to wasi-sdk")
else()
  set(WASI_SDK_PATH "$ENV{WASI_SDK_PATH}" CACHE PATH "Path to wasi-sdk")
endif()

if(NOT DEFINED ENV{WASIX_SYSROOT})
  set(WASIX_SYSROOT "/opt/wasix-sysroot" CACHE PATH "Path to wasix-libc sysroot")
else()
  set(WASIX_SYSROOT "$ENV{WASIX_SYSROOT}" CACHE PATH "Path to wasix-libc sysroot")
endif()

# ── Compiler ────────────────────────────────────────────────────
set(CMAKE_C_COMPILER "${WASI_SDK_PATH}/bin/clang")
set(CMAKE_CXX_COMPILER "${WASI_SDK_PATH}/bin/clang++")
set(CMAKE_AR "${WASI_SDK_PATH}/bin/llvm-ar")
set(CMAKE_RANLIB "${WASI_SDK_PATH}/bin/llvm-ranlib")
set(CMAKE_C_COMPILER_TARGET "wasm32-wasi")
set(CMAKE_CXX_COMPILER_TARGET "wasm32-wasi")

# ── Sysroot ─────────────────────────────────────────────────────
set(CMAKE_SYSROOT "${WASIX_SYSROOT}")
set(CMAKE_FIND_ROOT_PATH "${WASIX_SYSROOT}")

# ── Flags ───────────────────────────────────────────────────────
set(CMAKE_C_FLAGS_INIT "-D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN")
set(CMAKE_CXX_FLAGS_INIT "${CMAKE_C_FLAGS_INIT} -fno-exceptions")
set(CMAKE_EXE_LINKER_FLAGS_INIT
  "-Wl,--export-all -Wl,--no-entry -Wl,--allow-undefined"
)

# ── Search behavior ─────────────────────────────────────────────
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

# ── Output settings ─────────────────────────────────────────────
set(CMAKE_EXECUTABLE_SUFFIX ".wasm")
