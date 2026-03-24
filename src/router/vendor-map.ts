/**
 * Static vendor module map.
 *
 * All 26 registered Node.js modules mapped to their vendor implementations.
 * Static imports ensure synchronous availability — the Deno pattern where
 * all compat modules are loaded at startup.
 *
 * WASM bindings in vendor files (crypto, fs, os, etc.) are lazy — WASM
 * loads at method call time, not at import time.
 */

// ── Modules with real vendor implementations ──
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

// ── Re-export modules (Node builtins, browser implementations later) ──
import * as vendorPath from '../vendor/path.js';
import * as vendorUtil from '../vendor/util.js';
import * as vendorEvents from '../vendor/events.js';
import * as vendorAssert from '../vendor/assert.js';
import * as vendorQuerystring from '../vendor/querystring.js';
import * as vendorStringDecoder from '../vendor/string_decoder.js';
import * as vendorPunycode from '../vendor/punycode.js';
import * as vendorStream from '../vendor/stream.js';

/**
 * Prefer default export (mimics require() semantics).
 * Node's require('fs') returns the module's default export shape,
 * not the ESM namespace with { default, namedExport1, ... }.
 */
function resolveDefault(mod: Record<string, unknown>): unknown {
  return ('default' in mod) ? mod.default : mod;
}

export const vendorModules: ReadonlyMap<string, () => unknown> = new Map([
  // unenv
  ['path', () => resolveDefault(vendorPath as any)],
  ['util', () => resolveDefault(vendorUtil as any)],
  ['events', () => resolveDefault(vendorEvents as any)],
  ['assert', () => resolveDefault(vendorAssert as any)],
  ['querystring', () => resolveDefault(vendorQuerystring as any)],
  ['string_decoder', () => resolveDefault(vendorStringDecoder as any)],
  ['punycode', () => resolveDefault(vendorPunycode as any)],
  // vendored-js
  ['stream', () => resolveDefault(vendorStream as any)],
  ['timers', () => resolveDefault(vendorTimers as any)],
  ['process', () => resolveDefault(vendorProcess as any)],
  ['console', () => resolveDefault(vendorConsole as any)],
  // wasix
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
  // wasix-required
  ['vm', () => resolveDefault(vendorVm as any)],
  ['child_process', () => resolveDefault(vendorChildProcess as any)],
  ['worker_threads', () => resolveDefault(vendorWorkerThreads as any)],
  ['cluster', () => resolveDefault(vendorCluster as any)],
]);
