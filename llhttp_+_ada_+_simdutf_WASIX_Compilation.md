# llhttp + ada + simdutf WASIX Compilation

## Overview

Compile three smaller C libraries to WASIX — llhttp (HTTP parsing), ada (URL parsing), and simdutf (string encoding validation). These are lower-risk, self-contained compilations that each produce a focused `.wasm` module with a thin FFI bridge. Together they close Node's parsing fidelity gaps: exact HTTP error codes, spec-compliant URL handling, and high-performance string transcoding.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/e8d6adc2-f1f5-41ba-9b3b-f72a74dd337c` (Epic Brief — HTTP parsing gap, URL parsing gap), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/9d8e95a2-8fa6-4df2-95e6-2f7c23480ac5` (Core Flows — Flow 4: llhttp for HTTP parsing), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §3.2 FFI Bridge Stubs)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/b6ce84ad-f2be-4b2d-a10a-12a971bef635` (WASIX Bridges — needed for filesystem mounts during testing)

## Scope

### In Scope

**llhttp** — Node's HTTP parser (maintained by Node.js team):
- Clone from git submodule, compile to WASIX via wasi-sdk
- FFI bridge `binding-http-parser` (~50 LOC): `llhttp_init`, `llhttp_execute`, `llhttp_finish`, callback registration for `on_url`, `on_header_field`, `on_header_value`, `on_body`, `on_message_complete`
- Produces exact Node-compatible error codes (`HPE_INVALID_HEADER_TOKEN`, `HPE_UNEXPECTED_CONTENT_LENGTH`, etc.)
- Used by the vendored Node `http` module for request/response parsing (actual I/O goes through atua-net)

**ada** — WHATWG URL parser used by Node.js:
- Clone from git submodule, compile to WASIX (C++ — uses wasi-sdk's clang++)
- FFI bridge `binding-url` (~50 LOC): `ada_parse`, `ada_get_href`, `ada_get_hostname`, `ada_get_pathname`, `ada_get_search`, etc.
- Handles IDN normalization, backslash-to-slash, opaque paths — matching Node's exact behavior

**simdutf** — String encoding validation/transcoding:
- Clone from git submodule, compile to WASIX (C++)
- FFI bridge `binding-encoding` (~50 LOC): `validate_utf8`, `convert_utf8_to_utf16`, `convert_utf16_to_utf8`, encoding detection
- Note: SIMD instructions may not be available in WASM — simdutf has scalar fallback paths. Verify scalar codepath compiles cleanly to WASIX

### Out of Scope
- HTTP server (request handling, routing) — that's vendored Node JS (T8) + atua-net
- Full `url` module implementation — that's vendored Node JS (T8). This ticket just compiles the C parser

## Acceptance Criteria

1. llhttp compiles to `wasm/llhttp.wasm` and loads via `runWasix()`
2. llhttp parses a valid HTTP/1.1 request and returns correct method, URL, headers, body
3. llhttp returns exact Node error codes for malformed requests (e.g., `HPE_INVALID_HEADER_TOKEN`)
4. ada compiles to `wasm/ada.wasm` and loads via `runWasix()`
5. ada parses URLs matching Node's behavior: IDN, backslash normalization, opaque paths all correct
6. simdutf compiles to `wasm/simdutf.wasm` (scalar fallback path) and loads via `runWasix()`
7. simdutf validates UTF-8 and converts between UTF-8/UTF-16 correctly
8. All three FFI bridges marshal data cleanly between JS and WASM linear memory
