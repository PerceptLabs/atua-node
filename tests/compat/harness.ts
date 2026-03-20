/**
 * Package Compatibility Test Harness.
 *
 * Installs real npm packages, runs their actual test suites,
 * captures pass/fail counts, and produces a compatibility matrix.
 *
 * Usage:
 *   import { runPackageTests, PackageResult } from './harness.js';
 *   const result = await runPackageTests('semver');
 */
import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

export interface PackageResult {
  package: string;
  version: string;
  tier: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  rate: string;
  failures: FailureDetail[];
  error?: string;
}

export interface FailureDetail {
  testName: string;
  errorMessage: string;
  nodeApi: string;
  category: 'compat-bug' | 'browser-ceiling' | 'preview-adapter' | 'env-dependent';
}

const PACKAGES_DIR = resolve(import.meta.dirname, '.packages');

/** Override test commands for packages where scripts.test doesn't work directly */
const TEST_CMD_OVERRIDES: Record<string, string> = {
  'chalk':        'ava',
  'debug':        'mocha test.js test.node.js',
  'jsonwebtoken': 'mocha --timeout 10000',
  'ejs':          'mocha --reporter spec',
  'qs':           'tape "test/**/*.js"',
  'ws':           'mocha --throw-deprecation test/*.test.js',
  'express':      'mocha --require test/support/env --reporter spec --bail test/ test/acceptance/',
  'nodemailer':   'node --test test/**/*.test.js test/**/*-test.js',
  'undici':       'node --test test/*.js',
  'dotenv':       'mocha tests --recursive --reporter spec --timeout 10000',
  'ms':           'jest --no-coverage',
};

/** Known git repos + version tags for packages (npm tarballs strip test files) */
const GIT_REPOS: Record<string, { repo: string; tag: string }> = {
  'ms': { repo: 'vercel/ms', tag: 'v2.1.3' },
  'semver': { repo: 'npm/node-semver', tag: 'v7.7.1' },
  'dotenv': { repo: 'motdotla/dotenv', tag: 'v16.4.7' },
  'commander': { repo: 'tj/commander.js', tag: 'v12.1.0' },
  'chalk': { repo: 'chalk/chalk', tag: 'v5.4.1' },
  'uuid': { repo: 'uuidjs/uuid', tag: 'v9.0.1' },
  'validator': { repo: 'validatorjs/validator.js', tag: '13.12.0' },
  'minimatch': { repo: 'isaacs/minimatch', tag: 'v9.0.5' },
  'debug': { repo: 'debug-js/debug', tag: '4.3.7' },
  'lru-cache': { repo: 'isaacs/node-lru-cache', tag: 'v10.4.3' },
  'jsonwebtoken': { repo: 'auth0/node-jsonwebtoken', tag: 'v9.0.2' },
  'ejs': { repo: 'mde/ejs', tag: 'v3.1.10' },
  'pug': { repo: 'pugjs/pug', tag: 'pug@3.0.3' },
  'dotenv-expand': { repo: 'motdotla/dotenv-expand', tag: 'v11.0.7' },
  'cookie': { repo: 'jshttp/cookie', tag: 'v0.7.2' },
  'qs': { repo: 'ljharb/qs', tag: 'v6.13.1' },
  'on-finished': { repo: 'jshttp/on-finished', tag: 'v2.4.1' },
  'content-type': { repo: 'jshttp/content-type', tag: 'v1.0.5' },
  'accepts': { repo: 'jshttp/accepts', tag: '1.3.8' },
  'type-is': { repo: 'jshttp/type-is', tag: '1.6.18' },
  'express': { repo: 'expressjs/express', tag: 'v4.21.2' },
  'undici': { repo: 'nodejs/undici', tag: 'v6.21.1' },
  'pino': { repo: 'pinojs/pino', tag: 'v9.6.0' },
  'archiver': { repo: 'archiverjs/node-archiver', tag: '7.0.1' },
  'ws': { repo: 'websockets/ws', tag: '8.18.1' },
  'readable-stream': { repo: 'nodejs/readable-stream', tag: 'v4.7.0' },
  'tar': { repo: 'isaacs/node-tar', tag: 'v7.4.3' },
  'formidable': { repo: 'node-formidable/formidable', tag: 'v3.5.2' },
  'nodemailer': { repo: 'nodemailer/nodemailer', tag: 'v6.9.16' },
  'glob': { repo: 'isaacs/node-glob', tag: 'v10.4.5' },
};

/**
 * Install a package by cloning from git (to get test files)
 * and running npm install (to get dependencies including devDeps).
 */
export function installPackage(name: string): { version: string; dir: string } {
  const pkgDir = join(PACKAGES_DIR, name);

  if (!existsSync(PACKAGES_DIR)) {
    mkdirSync(PACKAGES_DIR, { recursive: true });
  }

  if (!existsSync(join(pkgDir, 'package.json'))) {
    const repoInfo = GIT_REPOS[name];
    if (repoInfo) {
      // Clone from git with version tag to get test files
      try {
        execSync(`git clone --depth 1 --branch ${repoInfo.tag} https://github.com/${repoInfo.repo}.git "${pkgDir}"`, {
          stdio: 'pipe',
          timeout: 60000,
        });
      } catch {
        // Fallback: npm pack + extract
        mkdirSync(pkgDir, { recursive: true });
        try {
          execSync(`npm pack ${name} --pack-destination "${pkgDir}"`, { stdio: 'pipe', timeout: 60000 });
          const tarball = readdirSync(pkgDir).find(f => f.endsWith('.tgz'));
          if (tarball) {
            execSync(`tar xzf "${tarball}" --strip-components=1`, { cwd: pkgDir, stdio: 'pipe' });
          }
        } catch {
          return { version: 'install-failed', dir: pkgDir };
        }
      }
    } else {
      // No known repo — use npm pack
      mkdirSync(pkgDir, { recursive: true });
      try {
        execSync(`npm pack ${name} --pack-destination "${pkgDir}"`, { stdio: 'pipe', timeout: 60000 });
        const tarball = readdirSync(pkgDir).find(f => f.endsWith('.tgz'));
        if (tarball) {
          execSync(`tar xzf "${tarball}" --strip-components=1`, { cwd: pkgDir, stdio: 'pipe' });
        }
      } catch {
        return { version: 'install-failed', dir: pkgDir };
      }
    }

    // Install all dependencies (including devDeps for testing)
    try {
      execSync('npm install --ignore-scripts 2>&1 || true', {
        cwd: pkgDir,
        stdio: 'pipe',
        timeout: 180000,
      });
    } catch {
      // Non-fatal — some deps may fail but tests might still work
    }

    // Run build step if needed (TypeScript compilation, etc.)
    try {
      const scripts = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).scripts ?? {};
      if (scripts.prepare) {
        execSync('npm run prepare --ignore-scripts 2>&1 || true', { cwd: pkgDir, stdio: 'pipe', timeout: 120000 });
      } else if (scripts.build) {
        execSync('npm run build 2>&1 || true', { cwd: pkgDir, stdio: 'pipe', timeout: 120000 });
      } else if (scripts.pretest) {
        execSync('npm run pretest 2>&1 || true', { cwd: pkgDir, stdio: 'pipe', timeout: 120000 });
      }
    } catch {
      // Non-fatal — build step might not exist or might fail
    }
  }

  // Read version
  try {
    const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    return { version: pkgJson.version ?? 'unknown', dir: pkgDir };
  } catch {
    return { version: 'unknown', dir: pkgDir };
  }
}

/**
 * Find the test command for a package.
 * Looks at package.json scripts.test, falls back to common patterns.
 */
export function findTestCommand(name: string, pkgDir: string): string | null {
  // Check overrides first — corrected commands for packages with complex test setups
  if (TEST_CMD_OVERRIDES[name]) {
    return TEST_CMD_OVERRIDES[name];
  }

  try {
    const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

    if (pkgJson.scripts?.test) {
      let cmd = pkgJson.scripts.test;
      // Skip commands that just echo or exit
      if (/^echo\b|no test specified/.test(cmd)) return null;
      // Strip coverage wrappers (nyc, c8, istanbul)
      cmd = cmd.replace(/^(nyc\s+|c8\s+|istanbul\s+cover\s+)/, '');
      // Strip lint-first chains: "npm run lint && <actual test>"
      cmd = cmd.replace(/^npm run lint\s*&&\s*/, '');
      return cmd;
    }
  } catch {}

  // Fallback: common test patterns
  if (existsSync(join(pkgDir, 'test'))) return 'mocha test --recursive --timeout 10000';
  if (existsSync(join(pkgDir, 'tests'))) return 'mocha tests --recursive --timeout 10000';
  if (existsSync(join(pkgDir, '__tests__'))) return 'jest --no-coverage';

  return null;
}

/**
 * Parse test output to extract pass/fail counts.
 * Supports mocha, tap, jest, and generic patterns.
 */
export function parseTestOutput(stdout: string, stderr: string): { total: number; passed: number; failed: number; skipped: number; failures: string[] } {
  const output = stdout + '\n' + stderr;
  const failures: string[] = [];

  // Mocha pattern: "N passing", "N failing"
  const mochaPass = output.match(/(\d+)\s+passing/);
  const mochaFail = output.match(/(\d+)\s+failing/);
  const mochaPend = output.match(/(\d+)\s+pending/);
  if (mochaPass) {
    const passed = parseInt(mochaPass[1]);
    const failed = mochaFail ? parseInt(mochaFail[1]) : 0;
    const skipped = mochaPend ? parseInt(mochaPend[1]) : 0;

    // Extract failure names
    const failMatches = output.matchAll(/^\s+\d+\)\s+(.+)$/gm);
    for (const m of failMatches) failures.push(m[1].trim());

    return { total: passed + failed + skipped, passed, failed, skipped, failures };
  }

  // Jest pattern: "Tests: N passed, N failed, N total"
  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    const failed = parseInt(jestMatch[1] ?? '0');
    const skipped = parseInt(jestMatch[2] ?? '0');
    const passed = parseInt(jestMatch[3]);
    const total = parseInt(jestMatch[4]);
    return { total, passed, failed, skipped, failures };
  }

  // TAP v13/v14 pattern: "1..N" at end, count "ok" and "not ok" at top level
  const tapPlan = output.match(/^1\.\.(\d+)\s*$/m);
  if (tapPlan) {
    const total = parseInt(tapPlan[1]);
    // Count top-level "ok N" and "not ok N" lines (not indented = not subtests)
    const okLines = output.match(/^ok \d+/gm) ?? [];
    const notOkLines = output.match(/^not ok \d+/gm) ?? [];
    const passed = okLines.length;
    const failed = notOkLines.length;
    for (const line of notOkLines) failures.push(line.trim());
    return { total, passed, failed, skipped: total - passed - failed, failures };
  }

  // TAP summary pattern: "# tests N", "# pass N", "# fail N"
  const tapTests = output.match(/# tests\s+(\d+)/);
  const tapPass = output.match(/# pass\s+(\d+)/);
  const tapFail = output.match(/# fail\s+(\d+)/);
  if (tapTests || tapPass) {
    const total = tapTests ? parseInt(tapTests[1]) : 0;
    const passed = tapPass ? parseInt(tapPass[1]) : 0;
    const failed = tapFail ? parseInt(tapFail[1]) : 0;
    return { total, passed, failed, skipped: 0, failures };
  }

  // node:test / node --test pattern: "# tests N", "# pass N", "# fail N"
  const nodePass = output.match(/# pass (\d+)/);
  const nodeFail = output.match(/# fail (\d+)/);
  if (nodePass) {
    const passed = parseInt(nodePass[1]);
    const failed = nodeFail ? parseInt(nodeFail[1]) : 0;
    return { total: passed + failed, passed, failed, skipped: 0, failures };
  }

  // Ava pattern: "N tests passed", "N tests failed"
  const avaPass = output.match(/(\d+)\s+tests?\s+passed/);
  const avaFail = output.match(/(\d+)\s+tests?\s+failed/);
  if (avaPass) {
    const passed = parseInt(avaPass[1]);
    const failed = avaFail ? parseInt(avaFail[1]) : 0;
    return { total: passed + failed, passed, failed, skipped: 0, failures };
  }

  // Generic: count "✓" and "✗" or "PASS" and "FAIL"
  const checkmarks = (output.match(/✓|✔/g) ?? []).length;
  const crosses = (output.match(/✗|✘/g) ?? []).length;
  if (checkmarks > 0 || crosses > 0) {
    return { total: checkmarks + crosses, passed: checkmarks, failed: crosses, skipped: 0, failures };
  }

  // Last resort: count bare "ok N" / "not ok N" lines (tape format without 1..N)
  const bareOk = (output.match(/^ok \d+/gm) ?? []).length;
  const bareNotOk = (output.match(/^not ok \d+/gm) ?? []).length;
  if (bareOk > 0 || bareNotOk > 0) {
    for (const line of (output.match(/^not ok \d+.*/gm) ?? [])) failures.push(line.trim());
    return { total: bareOk + bareNotOk, passed: bareOk, failed: bareNotOk, skipped: 0, failures };
  }

  // Couldn't parse — return zero
  return { total: 0, passed: 0, failed: 0, skipped: 0, failures };
}

/**
 * Run a package's test suite and capture results.
 */
export async function runPackageTests(
  name: string,
  tier: number
): Promise<PackageResult> {
  console.log(`\n[${name}] Installing...`);
  const { version, dir } = installPackage(name);

  if (version === 'install-failed') {
    return {
      package: name, version, tier,
      total: 0, passed: 0, failed: 0, skipped: 0,
      rate: '0%', failures: [],
      error: 'npm install failed',
    };
  }

  const testCmd = findTestCommand(name, dir);
  if (!testCmd) {
    return {
      package: name, version, tier,
      total: 0, passed: 0, failed: 0, skipped: 0,
      rate: 'N/A', failures: [],
      error: 'No test command found',
    };
  }

  console.log(`[${name}@${version}] Running: ${testCmd}`);

  try {
    // Run the test command via shell from the package's cloned directory
    const sep = process.platform === 'win32' ? ';' : ':';
    const result = spawnSync(testCmd, {
      cwd: dir,
      stdio: 'pipe',
      timeout: 120000,
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PATH: join(dir, 'node_modules', '.bin') + sep + process.env.PATH,
      },
    });

    const stdout = result.stdout?.toString('utf8') ?? '';
    const stderr = result.stderr?.toString('utf8') ?? '';

    const parsed = parseTestOutput(stdout, stderr);
    const rate = parsed.total > 0 ? `${Math.round((parsed.passed / parsed.total) * 100)}%` : '0%';

    const failures: FailureDetail[] = parsed.failures.map(f => ({
      testName: f,
      errorMessage: '',
      nodeApi: 'unknown',
      category: 'compat-bug' as const,
    }));

    console.log(`[${name}] ${parsed.passed}/${parsed.total} passed (${rate})`);

    return {
      package: name, version, tier,
      total: parsed.total, passed: parsed.passed,
      failed: parsed.failed, skipped: parsed.skipped,
      rate, failures,
    };
  } catch (err: any) {
    return {
      package: name, version, tier,
      total: 0, passed: 0, failed: 0, skipped: 0,
      rate: '0%', failures: [],
      error: `Test execution error: ${err.message}`,
    };
  }
}

/**
 * Generate RESULTS.md from test results.
 */
export function generateResultsMd(results: PackageResult[]): string {
  let md = '# Package Compatibility Matrix\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += '| Package | Version | Total | Passed | Failed | Rate | Tier |\n';
  md += '|---------|---------|-------|--------|--------|------|------|\n';

  for (const r of results) {
    md += `| ${r.package} | ${r.version} | ${r.total} | ${r.passed} | ${r.failed} | ${r.rate} | ${r.tier} |\n`;
  }

  // Tier summaries
  for (const tier of [1, 2, 3]) {
    const tierResults = results.filter(r => r.tier === tier);
    const totalTests = tierResults.reduce((s, r) => s + r.total, 0);
    const totalPassed = tierResults.reduce((s, r) => s + r.passed, 0);
    const rate = totalTests > 0 ? `${Math.round((totalPassed / totalTests) * 100)}%` : 'N/A';
    md += `| **Tier ${tier} Total** | | **${totalTests}** | **${totalPassed}** | **${totalTests - totalPassed}** | **${rate}** | **${tier}** |\n`;
  }

  // Failure details
  const allFailures = results.flatMap(r => r.failures.map(f => ({ ...f, package: r.package })));
  if (allFailures.length > 0) {
    md += '\n## Failures\n\n';
    md += '| Package | Test | Error | Node API | Category |\n';
    md += '|---------|------|-------|----------|----------|\n';
    for (const f of allFailures) {
      md += `| ${(f as any).package} | ${f.testName} | ${f.errorMessage || '-'} | ${f.nodeApi} | ${f.category} |\n`;
    }
  }

  // Errors (install failures, no test command, etc.)
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    md += '\n## Errors\n\n';
    for (const r of errors) {
      md += `- **${r.package}**: ${r.error}\n`;
    }
  }

  return md;
}
