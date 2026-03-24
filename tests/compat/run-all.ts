#!/usr/bin/env npx tsx
/**
 * Run the package compatibility battery and continuously checkpoint progress.
 *
 * Usage:
 *   npx tsx tests/compat/run-all.ts
 *   npx tsx tests/compat/run-all.ts --package semver
 *   npx tsx tests/compat/run-all.ts --reset
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
import { generateResolvedPackagesJson, generateResultsMd, runPackageTests, type PackageResult } from './harness.js';

const TIER_1 = [
  'semver', 'dotenv', 'commander', 'chalk', 'bytes',
  'uuid', 'validator', 'minimatch', 'debug', 'lru-cache',
  'minimist', 'camelcase', 'escape-string-regexp', 'balanced-match',
  'once', 'wrappy', 'inherits', 'isarray', 'safe-buffer', 'depd',
  'lodash', 'yargs', 'p-limit', 'strip-ansi', 'string-width',
  'supports-color', 'has-flag', 'resolve', 'path-parse', 'object-assign',
];

const TIER_2 = [
  'jsonwebtoken', 'ejs', 'pug', 'dotenv-expand', 'cookie',
  'qs', 'on-finished', 'content-type', 'accepts', 'type-is',
  'which', 'normalize-path', 'is-number', 'yallist', 'signal-exit',
  'destroy', 'etag', 'fresh', 'range-parser', 'mime',
  'mkdirp', 'rimraf', 'picomatch', 'micromatch', 'fast-glob',
  'anymatch', 'fill-range', 'to-regex-range', 'merge2', 'run-parallel',
];

const TIER_3 = [
  'express', 'undici', 'pino', 'archiver', 'ws',
  'readable-stream', 'tar', 'formidable', 'nodemailer', 'glob',
  'body-parser', 'raw-body', 'serve-static', 'finalhandler', 'send', 'compression',
  'axios', 'node-fetch', 'form-data', 'tough-cookie',
  'follow-redirects', 'mime-types', 'mime-db',
  'proxy-addr', 'forwarded', 'ipaddr.js', 'statuses',
  'toidentifier', 'merge-descriptors', 'utils-merge',
  'path-to-regexp', 'methods', 'vary', 'encodeurl',
  'escape-html', 'parseurl', 'on-headers',
];

const TIER_4 = [
  'fastify', 'koa', 'hapi', 'supertest', 'nock', 'got',
  'mocha-pkg', 'tape-pkg',
  'jose', 'bcryptjs',
  'through2', 'pump',
  'jsdom', 'execa',
];

const ALL_PACKAGES: Array<{ name: string; tier: number }> = [
  ...TIER_1.map(name => ({ name, tier: 1 })),
  ...TIER_2.map(name => ({ name, tier: 2 })),
  ...TIER_3.map(name => ({ name, tier: 3 })),
  ...TIER_4.map(name => ({ name, tier: 4 })),
];

type CompatCheckpoint = {
  formatVersion: number;
  runId: string;
  results: PackageResult[];
};

const CHECKPOINT_FORMAT_VERSION = 2;
const compatDir = fileURLToPath(new URL('.', import.meta.url));
const checkpointPath = join(compatDir, 'RESULTS.checkpoint.json');
const resultsPath = join(compatDir, 'RESULTS.md');
const fullReportPath = join(compatDir, 'RESULTS_FULL.md');
const resolvedPath = join(compatDir, 'RESOLVED_PACKAGES.json');
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);

const args = process.argv.slice(2);
let packageFilter: string | null = null;
let resetCheckpoint = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--package' && args[i + 1]) {
    packageFilter = args[i + 1];
    i++;
  } else if (args[i] === '--reset') {
    resetCheckpoint = true;
  }
}

function sortResults(results: PackageResult[]): PackageResult[] {
  const index = new Map(ALL_PACKAGES.map((pkg, i) => [pkg.name, i]));
  return [...results].sort((a, b) => (index.get(a.package) ?? 9999) - (index.get(b.package) ?? 9999));
}

function loadCheckpoint(): CompatCheckpoint | null {
  if (!existsSync(checkpointPath)) return null;
  try {
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8')) as CompatCheckpoint;
    return checkpoint.formatVersion === CHECKPOINT_FORMAT_VERSION ? checkpoint : null;
  } catch {
    return null;
  }
}

function writeResults(runId: string, results: PackageResult[]): void {
  const sorted = sortResults(results);
  const report = generateResultsMd(sorted);
  writeFileSync(checkpointPath, JSON.stringify({
    formatVersion: CHECKPOINT_FORMAT_VERSION,
    runId,
    results: sorted,
  }, null, 2));
  writeFileSync(resultsPath, report);
  writeFileSync(fullReportPath, report);
  writeFileSync(resolvedPath, generateResolvedPackagesJson(sorted));
}

function summarize(results: PackageResult[]) {
  const statusCounts = {
    pass: results.filter(result => result.status === 'pass').length,
    runtimeFail: results.filter(result => result.status === 'runtime-fail').length,
    harnessFail: results.filter(result => result.status === 'harness-fail').length,
    noRuntimeTest: results.filter(result => result.status === 'no-runtime-test').length,
  };
  const counted = results.filter(result => result.countAvailable).reduce(
    (acc, result) => ({
      total: acc.total + result.total,
      passed: acc.passed + result.passed,
      failed: acc.failed + result.failed,
      skipped: acc.skipped + result.skipped,
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );
  return { statusCounts, counted };
}

async function main() {
  console.log('Compatibility battery');

  if (resetCheckpoint && existsSync(checkpointPath)) {
    rmSync(checkpointPath, { force: true });
  }

  const checkpoint = packageFilter || resetCheckpoint ? null : loadCheckpoint();
  const runId = checkpoint?.runId ?? process.env.ATUA_COMPAT_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
  process.env.ATUA_COMPAT_RUN_ID = runId;

  const results: PackageResult[] = checkpoint?.results ?? [];
  const completed = new Set(results.map(r => r.package));

  let packages: Array<{ name: string; tier: number }>;
  if (packageFilter) {
    const tier = TIER_1.includes(packageFilter) ? 1
      : TIER_2.includes(packageFilter) ? 2
      : TIER_3.includes(packageFilter) ? 3
      : TIER_4.includes(packageFilter) ? 4
      : 0;
    packages = [{ name: packageFilter, tier }];
  } else {
    packages = ALL_PACKAGES.filter(({ name }) => !completed.has(name));
  }

  console.log(`Run ID: ${runId}`);
  console.log(`Remaining packages: ${packages.length}`);

  for (let i = 0; i < packages.length; i++) {
    const { name, tier } = packages[i];
    const result = await runPackageTests(name, tier);
    const idx = results.findIndex(r => r.package === name);
    if (idx === -1) {
      results.push(result);
    } else {
      results[idx] = result;
    }
    writeResults(runId, results);
    const summary = summarize(results);
    console.log(
      `[${i + 1}/${packages.length}] ${name}: ${result.status} ` +
      `| packages pass=${summary.statusCounts.pass} runtime-fail=${summary.statusCounts.runtimeFail} ` +
      `harness-fail=${summary.statusCounts.harnessFail} no-runtime-test=${summary.statusCounts.noRuntimeTest} ` +
      `| counted tests ${summary.counted.passed}/${summary.counted.total}`,
    );
  }

  if (!packageFilter && existsSync(checkpointPath)) {
    rmSync(checkpointPath, { force: true });
  }

  const sorted = sortResults(results);
  console.log('');
  console.log('Package'.padEnd(20) + 'Version'.padEnd(14) + 'Pass'.padEnd(8) + 'Fail'.padEnd(8) + 'Rate'.padEnd(8) + 'Tier');
  console.log('-'.repeat(70));
  for (const result of sorted) {
    console.log(
      result.package.padEnd(20) +
      result.version.padEnd(14) +
      String(result.passed).padEnd(8) +
      String(result.failed).padEnd(8) +
      result.rate.padEnd(8) +
      String(result.tier)
    );
  }
  const finalSummary = summarize(sorted);
  console.log(`\nPackage summary: pass=${finalSummary.statusCounts.pass} runtime-fail=${finalSummary.statusCounts.runtimeFail} harness-fail=${finalSummary.statusCounts.harnessFail} no-runtime-test=${finalSummary.statusCounts.noRuntimeTest}`);
  console.log(`Counted tests: ${finalSummary.counted.passed}/${finalSummary.counted.total} passed, ${finalSummary.counted.failed} failed, ${finalSummary.counted.skipped} skipped`);
  console.log(`\nResults written to: ${resultsPath}`);
  console.log(`Full report written to: ${fullReportPath}`);
}

if (isDirectRun) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
