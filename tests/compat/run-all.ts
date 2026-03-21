#!/usr/bin/env npx tsx
/**
 * Run all 30 package compatibility tests and produce RESULTS.md.
 *
 * Usage:
 *   npx tsx tests/compat/run-all.ts
 *   npx tsx tests/compat/run-all.ts --tier 1     # Run Tier 1 only
 *   npx tsx tests/compat/run-all.ts --package ms  # Run single package
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { runPackageTests, generateResultsMd, type PackageResult } from './harness.js';

// ── Package lists by tier ───────────────────────────────────

const TIER_1 = [
  // Original 10 (ms replaced with bytes)
  'semver', 'dotenv', 'commander', 'chalk', 'bytes',
  'uuid', 'validator', 'minimatch', 'debug', 'lru-cache',
  // Batch 2 (10)
  'minimist', 'camelcase', 'escape-string-regexp', 'balanced-match',
  'once', 'wrappy', 'inherits', 'isarray', 'safe-buffer', 'depd',
  // Batch 3 (10) — Step 7 expansion
  'lodash', 'yargs', 'p-limit', 'strip-ansi', 'string-width',
  'supports-color', 'has-flag', 'resolve', 'path-parse', 'object-assign',
];

const TIER_2 = [
  // Original 10
  'jsonwebtoken', 'ejs', 'pug', 'dotenv-expand', 'cookie',
  'qs', 'on-finished', 'content-type', 'accepts', 'type-is',
  // Batch 2 (10)
  'which', 'normalize-path', 'is-number', 'yallist', 'signal-exit',
  'destroy', 'etag', 'fresh', 'range-parser', 'mime',
  // Batch 3 (10) — Step 7 expansion
  'mkdirp', 'rimraf', 'picomatch', 'micromatch', 'fast-glob',
  'anymatch', 'fill-range', 'to-regex-range', 'merge2', 'run-parallel',
];

const TIER_3 = [
  // Original 10
  'express', 'undici', 'pino', 'archiver', 'ws',
  'readable-stream', 'tar', 'formidable', 'nodemailer', 'glob',
  // Batch 2 (6)
  'body-parser', 'raw-body', 'serve-static', 'finalhandler', 'send', 'compression',
  // Batch 3 (24) — Step 7 expansion
  'axios', 'node-fetch', 'form-data', 'tough-cookie',
  'follow-redirects', 'mime-types', 'mime-db',
  'proxy-addr', 'forwarded', 'ipaddr.js', 'statuses',
  'toidentifier', 'merge-descriptors', 'utils-merge',
  'path-to-regexp', 'methods', 'vary', 'encodeurl',
  'escape-html', 'parseurl', 'on-headers',
  // Skipped: http-proxy-agent, https-proxy-agent, agent-base (shared monorepo with complex setup)
];

// ── CLI argument parsing ────────────────────────────────────

const args = process.argv.slice(2);
let packageFilter: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--package' && args[i + 1]) {
    packageFilter = args[i + 1];
    i++;
  }
}
// NOTE: --tier flag removed. RESULTS.md must always run ALL tiers in one invocation.

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  @aspect/atua-node Package Compatibility Test');
  console.log('═══════════════════════════════════════════════════');

  const results: PackageResult[] = [];

  // Determine which packages to run
  let packages: Array<{ name: string; tier: number }> = [];

  if (packageFilter) {
    const tier = TIER_1.includes(packageFilter) ? 1 :
                 TIER_2.includes(packageFilter) ? 2 :
                 TIER_3.includes(packageFilter) ? 3 : 0;
    packages = [{ name: packageFilter, tier }];
  } else {
    // Always run ALL tiers — RESULTS.md must be complete
    packages.push(...TIER_1.map(name => ({ name, tier: 1 })));
    packages.push(...TIER_2.map(name => ({ name, tier: 2 })));
    packages.push(...TIER_3.map(name => ({ name, tier: 3 })));
  }

  console.log(`\nRunning ${packages.length} packages...`);

  for (const { name, tier } of packages) {
    const result = await runPackageTests(name, tier);
    results.push(result);
  }

  // Generate and save RESULTS.md
  const md = generateResultsMd(results);
  const resultsPath = join(import.meta.dirname, 'RESULTS.md');
  writeFileSync(resultsPath, md);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Package'.padEnd(20) + 'Version'.padEnd(12) + 'Pass'.padEnd(8) + 'Fail'.padEnd(8) + 'Rate'.padEnd(8) + 'Tier');
  console.log('-'.repeat(64));

  for (const r of results) {
    console.log(
      r.package.padEnd(20) +
      r.version.padEnd(12) +
      String(r.passed).padEnd(8) +
      String(r.failed).padEnd(8) +
      r.rate.padEnd(8) +
      String(r.tier)
    );
  }

  // Tier totals
  for (const tier of [1, 2, 3]) {
    const tierResults = results.filter(r => r.tier === tier);
    if (tierResults.length === 0) continue;
    const totalTests = tierResults.reduce((s, r) => s + r.total, 0);
    const totalPassed = tierResults.reduce((s, r) => s + r.passed, 0);
    const rate = totalTests > 0 ? `${Math.round((totalPassed / totalTests) * 100)}%` : 'N/A';
    console.log(`\nTier ${tier}: ${totalPassed}/${totalTests} (${rate})`);
  }

  console.log(`\nResults written to: ${resultsPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
