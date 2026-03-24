/**
 * Vitest config for compat-vendor tests.
 *
 * Aliases Node built-in module names to atua-node vendor implementations.
 * The 8 npm-package-based modules (path, events, stream, assert, util, querystring,
 * string_decoder, punycode) are NOT aliased to avoid circular imports — they import
 * from their npm packages which vitest resolves naturally.
 * sys is also excluded (re-exports util).
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const vendorDir = resolve(__dirname, 'src/vendor');

// Modules with original implementations (no circular import risk)
const aliasedModules = [
  'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'perf_hooks', 'process', 'readline', 'repl', 'sea',
  'test', 'timers', 'tls', 'trace_events', 'tty', 'url',
  'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
];

const aliases: Record<string, string> = {};
for (const name of aliasedModules) {
  aliases[name] = resolve(vendorDir, `${name}.ts`);
  aliases[`node:${name}`] = resolve(vendorDir, `${name}.ts`);
}

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/compat-vendor/**/*.test.ts'],
  },
  resolve: {
    alias: aliases,
  },
});
