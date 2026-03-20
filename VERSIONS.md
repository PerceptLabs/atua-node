# Pinned Dependency Versions

All native C/C++ library versions and toolchain versions are pinned
for reproducible builds.

## Toolchain

| Component     | Version  | Source                                          |
|---------------|----------|-------------------------------------------------|
| wasi-sdk      | 24       | https://github.com/aspect-build/aspect-workflows        |
| wasix-libc    | main     | https://github.com/aspect-build/aspect-workflows |
| CMake         | ≥3.20    | System                                          |

## Native Libraries

| Library  | Version       | Git Tag/Branch     |
|----------|---------------|--------------------|
| libuv    | 1.48.0        | v1.48.0            |
| OpenSSL  | 3.2.1         | openssl-3.2.1      |
| zlib     | 1.3.1         | v1.3.1             |
| llhttp   | 9.2.1         | release/v9.2.1     |
| ada      | 2.7.6         | v2.7.6             |
| simdutf  | 5.0.0         | v5.0.0             |
| QuickJS  | 2024-01-13    | 2024-01-13         |
