/**
 * FFI Bridge: binding-uv — Marshals JS calls to libuv C functions.
 *
 * Phase A: This module re-exports the TypeScript phase-ordering shim
 * which provides correct libuv phase ordering without the full C library.
 *
 * Phase B (future): Will marshal to libuv.wasm via WASM FFI.
 */

export { EventLoop, type EventLoopPhase } from '../libuv/phase-shim.js';

export const bindingUv = {
  phase: 'A' as const,
  description: 'TypeScript phase-ordering shim',
};
