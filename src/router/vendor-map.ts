/**
 * Static vendor module map.
 *
 * All 44 Node.js built-in modules mapped to their vendor implementations.
 * Static imports ensure synchronous availability — the Deno pattern where
 * all compat modules are loaded at startup.
 *
 * WASM bindings in vendor files (crypto, fs, os, etc.) are lazy — WASM
 * loads at method call time, not at import time.
 */

// ── Original 18 vendor modules ──
import * as vendorBuffer from '../vendor/buffer.js';
import * as vendorChildProcess from '../vendor/child_process.js';
import * as vendorCluster from '../vendor/cluster.js';
import * as vendorConsole from '../vendor/console.js';
import * as vendorCrypto from '../vendor/crypto.js';
import * as vendorDns from '../vendor/dns.js';
import * as vendorFs from '../vendor/fs.js';
import * as vendorHttp from '../vendor/http.js';
import * as vendorHttps from '../vendor/https.js';
import * as vendorNet from '../vendor/net.js';
import * as vendorOs from '../vendor/os.js';
import * as vendorProcess from '../vendor/process.js';
import * as vendorTimers from '../vendor/timers.js';
import * as vendorTls from '../vendor/tls.js';
import * as vendorUrl from '../vendor/url.js';
import * as vendorVm from '../vendor/vm.js';
import * as vendorWorkerThreads from '../vendor/worker_threads.js';
import * as vendorZlib from '../vendor/zlib.js';

// ── Replaced 8 re-export modules (now browser-compatible via npm packages) ──
import * as vendorPath from '../vendor/path.js';
import * as vendorUtil from '../vendor/util.js';
import * as vendorEvents from '../vendor/events.js';
import * as vendorAssert from '../vendor/assert.js';
import * as vendorQuerystring from '../vendor/querystring.js';
import * as vendorStringDecoder from '../vendor/string_decoder.js';
import * as vendorPunycode from '../vendor/punycode.js';
import * as vendorStream from '../vendor/stream.js';

// ── 18 new modules ──
import * as vendorTty from '../vendor/tty.js';
import * as vendorReadline from '../vendor/readline.js';
import * as vendorModule from '../vendor/module.js';
import * as vendorAsyncHooks from '../vendor/async_hooks.js';
import * as vendorPerfHooks from '../vendor/perf_hooks.js';
import * as vendorDiagnosticsChannel from '../vendor/diagnostics_channel.js';
import * as vendorHttp2 from '../vendor/http2.js';
import * as vendorTest from '../vendor/test.js';
import * as vendorConstants from '../vendor/constants.js';
import * as vendorSys from '../vendor/sys.js';
import * as vendorDomain from '../vendor/domain.js';
import * as vendorV8 from '../vendor/v8.js';
import * as vendorInspector from '../vendor/inspector.js';
import * as vendorTraceEvents from '../vendor/trace_events.js';
import * as vendorWasi from '../vendor/wasi.js';
import * as vendorRepl from '../vendor/repl.js';
import * as vendorDgram from '../vendor/dgram.js';
import * as vendorSea from '../vendor/sea.js';

/**
 * Prefer default export (mimics require() semantics).
 * Node's require('fs') returns the module's default export shape,
 * not the ESM namespace with { default, namedExport1, ... }.
 */
function resolveDefault(mod: Record<string, unknown>): unknown {
  return ('default' in mod) ? mod.default : mod;
}

export const vendorModules: ReadonlyMap<string, () => unknown> = new Map([
  // ── unenv (passthrough category) ──
  ['path', () => resolveDefault(vendorPath as any)],
  ['util', () => resolveDefault(vendorUtil as any)],
  ['events', () => resolveDefault(vendorEvents as any)],
  ['assert', () => resolveDefault(vendorAssert as any)],
  ['querystring', () => resolveDefault(vendorQuerystring as any)],
  ['string_decoder', () => resolveDefault(vendorStringDecoder as any)],
  ['punycode', () => resolveDefault(vendorPunycode as any)],
  ['sys', () => resolveDefault(vendorSys as any)],

  // ── vendored-js ──
  ['stream', () => resolveDefault(vendorStream as any)],
  ['timers', () => resolveDefault(vendorTimers as any)],
  ['process', () => resolveDefault(vendorProcess as any)],
  ['console', () => resolveDefault(vendorConsole as any)],
  ['tty', () => resolveDefault(vendorTty as any)],
  ['readline', () => resolveDefault(vendorReadline as any)],
  ['module', () => resolveDefault(vendorModule as any)],
  ['async_hooks', () => resolveDefault(vendorAsyncHooks as any)],
  ['perf_hooks', () => resolveDefault(vendorPerfHooks as any)],
  ['diagnostics_channel', () => resolveDefault(vendorDiagnosticsChannel as any)],
  ['constants', () => resolveDefault(vendorConstants as any)],
  ['domain', () => resolveDefault(vendorDomain as any)],
  ['v8', () => resolveDefault(vendorV8 as any)],
  ['inspector', () => resolveDefault(vendorInspector as any)],
  ['trace_events', () => resolveDefault(vendorTraceEvents as any)],
  ['repl', () => resolveDefault(vendorRepl as any)],
  ['test', () => resolveDefault(vendorTest as any)],
  ['sea', () => resolveDefault(vendorSea as any)],

  // ── wasix (WASM-backed with JS fallback) ──
  ['crypto', () => resolveDefault(vendorCrypto as any)],
  ['fs', () => resolveDefault(vendorFs as any)],
  ['http', () => resolveDefault(vendorHttp as any)],
  ['https', () => resolveDefault(vendorHttps as any)],
  ['zlib', () => resolveDefault(vendorZlib as any)],
  ['net', () => resolveDefault(vendorNet as any)],
  ['tls', () => resolveDefault(vendorTls as any)],
  ['buffer', () => resolveDefault(vendorBuffer as any)],
  ['os', () => resolveDefault(vendorOs as any)],
  ['dns', () => resolveDefault(vendorDns as any)],
  ['url', () => resolveDefault(vendorUrl as any)],
  ['wasi', () => resolveDefault(vendorWasi as any)],

  // ── wasix-required ──
  ['vm', () => resolveDefault(vendorVm as any)],
  ['child_process', () => resolveDefault(vendorChildProcess as any)],
  ['worker_threads', () => resolveDefault(vendorWorkerThreads as any)],
  ['cluster', () => resolveDefault(vendorCluster as any)],
  ['http2', () => resolveDefault(vendorHttp2 as any)],
  ['dgram', () => resolveDefault(vendorDgram as any)],
]);
