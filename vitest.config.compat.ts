/**
 * Vitest config for compat-vendor tests.
 *
 * Aliases Node built-in module names to atua-node vendor implementations.
 * Only aliases the 18 modules with real vendor code — the 8 re-export modules
 * (path, util, events, assert, querystring, string_decoder, punycode, stream)
 * resolve to Node builtins naturally in vitest, avoiding circular aliases.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const vendorDir = resolve(__dirname, 'src/vendor');

// Modules with real atua-node vendor implementations
const vendoredModules = [
  'buffer', 'child_process', 'cluster', 'console', 'crypto',
  'dns', 'fs', 'http', 'https', 'net', 'os', 'process',
  'timers', 'tls', 'url', 'vm', 'worker_threads', 'zlib',
];

const aliases: Record<string, string> = {};
for (const name of vendoredModules) {
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
