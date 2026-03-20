# SUPERSEDED

This file has been superseded by the refined specification documents:

- **Epic Brief** → `Epic_Brief_—_@aspect_atua-node.md`
- **Tech Plan** → `Tech_Plan_—_@aspect_atua-node.md`
- **Core Flows** → `Core_Flows_—_@aspect_atua-node.md`

Do NOT reference this file. It contains stale information including:
- Incorrect build toolchain (says `emcc`, should be `wasi-sdk` + `wasix-libc`)
- Incorrect WASIX socket bridges (browser `@wasmer/sdk` doesn't expose `sock_*`)
- µSockets/uWebSockets listed as in-scope (deferred)
- emnapi/napi-rs FFI pattern (replaced with direct C ABI via `runWasix()`)

The per-phase ticket files are the implementation plan.
