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
  'semver', 'dotenv', 'commander', 'chalk', 'ms',
  'uuid', 'validator', 'minimatch', 'debug', 'lru-cache',
];

const TIER_2 = [
  'jsonwebtoken', 'ejs', 'pug', 'dotenv-expand', 'cookie',
  'qs', 'on-finished', 'content-type', 'accepts', 'type-is',
];

const TIER_3 = [
  'express', 'undici', 'pino', 'archiver', 'ws',
  'readable-stream', 'tar', 'formidable', 'nodemailer', 'glob',
];

// ── CLI argument parsing ────────────────────────────────────

const args = process.argv.slice(2);
let tierFilter: number | null = null;
let packageFilter: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) {
    tierFilter = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--package' && args[i + 1]) {
    packageFilter = args[i + 1];
    i++;
  }
}

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
    if (!tierFilter || tierFilter === 1) {
      packages.push(...TIER_1.map(name => ({ name, tier: 1 })));
    }
    if (!tierFilter || tierFilter === 2) {
      packages.push(...TIER_2.map(name => ({ name, tier: 2 })));
    }
    if (!tierFilter || tierFilter === 3) {
      packages.push(...TIER_3.map(name => ({ name, tier: 3 })));
    }
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
