# End-to-End Validation — Vitest, Vite, Bun Bench

## Overview

Validate `@aspect/atua-node` against real-world Node.js toolchains and benchmarks. This is the proof that the entire system works — not unit tests of individual modules, but full applications running inside the browser with the WASIX-backed compat layer.

**Specs:** `spec:a7839341-19b5-40cd-999f-4fc68df128e4/e8d6adc2-f1f5-41ba-9b3b-f72a74dd337c` (Epic Brief — "running real-world Node.js toolchains (Vite, Vitest, Express)"), `spec:a7839341-19b5-40cd-999f-4fc68df128e4/032c3d97-9350-4506-a685-36f6891f8212` (Tech Plan — §1.4 Phases 9-11)

**Dependencies:** `ticket:a7839341-19b5-40cd-999f-4fc68df128e4/d3c59e60-42d9-4f5c-b0c5-f6cb719278e9` (AtuaFS Extensions + Buffer + Signals — all components must be complete)

## Scope

### In Scope

**Vitest Validation (Phase 9):**
- Run a Vitest test suite inside Atua with `@aspect/atua-node` enabled
- Test suite should exercise: `describe`/`it`/`expect`, async tests, mocking (`vi.fn()`, `vi.mock()`), `beforeEach`/`afterEach`, snapshot testing
- Vitest uses `vm` module for test isolation, `crypto` for random IDs, `fs` for reading test files, `path`/`url` for module resolution, streams for output
- Target: 90%+ of a standard Vitest suite passes

**Vite Dev Server Validation (Phase 10):**
- In an Atua host that provides the preview/server adapter, run Vite's development server inside Atua with `@aspect/atua-node`
- Vite uses: `fs` (read source files), `http` (dev server), `crypto` (etag generation), `path` / `url` (module resolution), `zlib` (response compression), `stream` (HMR SSE)
- Validate: project loads, HMR works, module resolution works, imports resolve correctly
- Note: Vite's HTTP server runs through the host preview adapter + browser networking, not a real WASIX `listen()` socket

**Bun Compatibility Bench (Phase 11):**
- Run a subset of Bun's Node.js compatibility benchmark snippets
- Focus areas: crypto operations (hash, cipher, DH), zlib (compress/decompress), HTTP parsing (request throughput), URL parsing, Buffer operations, stream throughput
- Measure: pass rate (target 95%+), performance relative to expectations (not vs native — just "does it work and complete in reasonable time")

**Regression test suite:**
- Create a permanent regression suite that covers the specific gaps called out in the Epic Brief:
  - Legacy cipher test (DES, RC4, Blowfish)
  - DiffieHellman with custom primes
  - zlib flush modes (Z_SYNC_FLUSH, Z_FULL_FLUSH)
  - `deflateParams` mid-stream
  - `vm.runInNewContext` with timeout
  - HTTP malformed request parsing (exact error codes)
  - URL parsing edge cases (IDN, backslash, opaque)
  - Event loop phase ordering (nextTick → setImmediate → setTimeout)
  - `process.versions.node` / `process.platform` checks

### Out of Scope
- Performance optimization (this phase validates correctness, not speed)
- Express/Fastify full app testing (future validation)
- Production deployment testing

## Acceptance Criteria

1. Vitest: A 50+ test suite runs inside Atua, 90%+ tests pass
2. Vitest: `vm.createContext()` works for test isolation (the `wasix-required` module)
3. In a host that provides the preview/server adapter, a sample Vite project loads in Atua's browser runtime and HMR updates apply
4. Vite: Module resolution (bare imports, relative imports, virtual modules) works correctly
5. Bun bench: 95%+ of selected compatibility snippets pass
6. Regression suite: All 10 specific gap tests from the Epic Brief pass
7. Graceful degradation smoke coverage runs at the 96% base when COOP/COEP headers are removed, and features depending on `wasix-required` modules fail descriptively rather than crashing
8. Performance: No single operation takes >10x longer than expected (flag regressions for future optimization)
