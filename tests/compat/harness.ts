/**
 * Package Compatibility Test Harness.
 *
 * Installs real npm packages (via git clone to get test files),
 * runs their actual test suites in WSL (Linux semantics — symlinks work),
 * captures pass/fail counts with actual error messages,
 * and produces a compatibility matrix.
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
/** Convert Windows path to WSL path */
function toWslPath(winPath: string): string {
  return winPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}

const WSL_SCRIPT = toWslPath(resolve(import.meta.dirname, 'wsl-run.sh'));

/** Run the wsl-run.sh helper script with given action */
function wslRun(action: string, pkgDir: string, ...args: string[]): { stdout: string; stderr: string; status: number } {
  const wslDir = toWslPath(pkgDir);
  const result = spawnSync('wsl', ['bash', WSL_SCRIPT, action, wslDir, ...args], {
    stdio: 'pipe',
    timeout: 300000,
  });
  return {
    stdout: result.stdout?.toString('utf8') ?? '',
    stderr: result.stderr?.toString('utf8') ?? '',
    status: result.status ?? 1,
  };
}

/** Override test commands for packages with complex/broken test scripts */
const TEST_CMD_OVERRIDES: Record<string, string> = {
  // Tier 1
  'chalk':        'ava',
  'debug':        'mocha test.js test.node.js',
  'dotenv':       'node --test tests/*.js',             // tap v18 has TS config issues
  'uuid':         'npx jest test/unit/ --no-coverage --verbose',  // verbose for parseable output
  'validator':    'mocha --reporter dot --recursive test/',
  'escape-string-regexp': 'ava',
  'bytes':        'mocha --reporter spec test/',
  'inherits':     'node -e "require(\'./test/browser\');require(\'./test/old\')"',
  'safe-buffer':  'tape test/*.js',                     // skip standard linter
  'lru-cache':    'node --test test/*.js',              // skip tap (plugin issues)
  // Tier 2
  'jsonwebtoken': 'mocha --timeout 10000',
  'ejs':          'mocha --recursive --reporter spec test/',
  'qs':           'tape "test/**/*.js"',
  'ws':           'mocha --throw-deprecation test/*.test.js',
  'pino':         'npm run transpile 2>/dev/null; node --test test/*.test.js',  // build first, then node:test
  // Tier 3
  'express':      'mocha --require test/support/env --reporter dot test/ test/acceptance/',
  'nodemailer':   'node --test test/**/*.test.js test/**/*-test.js',
  'undici':       'node --test test/*.js',
};

/** Git repos + version tags (npm tarballs strip test files) */
const GIT_REPOS: Record<string, { repo: string; tag: string }> = {
  // ── Tier 1 (original) ──
  'semver': { repo: 'npm/node-semver', tag: 'v7.7.1' },
  'dotenv': { repo: 'motdotla/dotenv', tag: 'v16.4.7' },
  'commander': { repo: 'tj/commander.js', tag: 'v12.1.0' },
  'chalk': { repo: 'chalk/chalk', tag: 'v5.4.1' },
  'bytes': { repo: 'visionmedia/bytes.js', tag: '3.1.2' },
  'uuid': { repo: 'uuidjs/uuid', tag: 'v9.0.1' },
  'validator': { repo: 'validatorjs/validator.js', tag: '13.12.0' },
  'minimatch': { repo: 'isaacs/minimatch', tag: 'v9.0.5' },
  'debug': { repo: 'debug-js/debug', tag: '4.3.7' },
  'lru-cache': { repo: 'isaacs/node-lru-cache', tag: 'v10.4.3' },
  // ── Tier 1 (new) ──
  'minimist': { repo: 'minimistjs/minimist', tag: 'v1.2.8' },
  'camelcase': { repo: 'sindresorhus/camelcase', tag: 'v8.0.0' },
  'escape-string-regexp': { repo: 'sindresorhus/escape-string-regexp', tag: 'v5.0.0' },
  'balanced-match': { repo: 'juliangruber/balanced-match', tag: 'v2.0.0' },
  'once': { repo: 'isaacs/once', tag: 'v1.4.0' },
  'wrappy': { repo: 'npm/wrappy', tag: 'v1.0.2' },
  'inherits': { repo: 'isaacs/inherits', tag: 'v2.0.4' },
  'isarray': { repo: 'juliangruber/isarray', tag: 'v2.0.5' },
  'safe-buffer': { repo: 'feross/safe-buffer', tag: 'v5.2.1' },
  'depd': { repo: 'dougwilson/nodejs-depd', tag: '2.0.0' },
  // ── Tier 2 (original) ──
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
  // ── Tier 2 (new) ──
  'which': { repo: 'npm/node-which', tag: 'v4.0.0' },
  'normalize-path': { repo: 'jonschlinkert/normalize-path', tag: '3.0.0' },
  'is-number': { repo: 'jonschlinkert/is-number', tag: '7.0.0' },
  'yallist': { repo: 'isaacs/yallist', tag: 'v4.0.0' },
  'signal-exit': { repo: 'tapjs/signal-exit', tag: 'v4.1.0' },
  'destroy': { repo: 'stream-utils/destroy', tag: 'v1.2.0' },
  'etag': { repo: 'jshttp/etag', tag: '1.8.1' },
  'fresh': { repo: 'jshttp/fresh', tag: '0.5.2' },
  'range-parser': { repo: 'jshttp/range-parser', tag: '1.2.1' },
  'mime': { repo: 'broofa/mime', tag: 'v4.0.6' },
  // ── Tier 3 (original) ──
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
  // ── Tier 3 (new) ──
  'body-parser': { repo: 'expressjs/body-parser', tag: 'v1.20.3' },
  'raw-body': { repo: 'stream-utils/raw-body', tag: 'v2.5.2' },
  'serve-static': { repo: 'expressjs/serve-static', tag: 'v1.16.2' },
  'finalhandler': { repo: 'pillarjs/finalhandler', tag: '1.3.1' },
  'send': { repo: 'pillarjs/send', tag: 'v0.19.0' },
  'compression': { repo: 'expressjs/compression', tag: 'v1.7.5' },
  // ── Tier 1 expansion (Step 7) ──
  'lodash': { repo: 'lodash/lodash', tag: '4.17.21' },
  'yargs': { repo: 'yargs/yargs', tag: 'v17.7.2' },
  'p-limit': { repo: 'sindresorhus/p-limit', tag: 'v5.0.0' },
  'strip-ansi': { repo: 'chalk/strip-ansi', tag: 'v7.1.0' },
  'string-width': { repo: 'sindresorhus/string-width', tag: 'v7.2.0' },
  'supports-color': { repo: 'chalk/supports-color', tag: 'v9.4.0' },
  'has-flag': { repo: 'sindresorhus/has-flag', tag: 'v5.0.1' },
  'resolve': { repo: 'browserify/resolve', tag: 'v1.22.10' },
  'path-parse': { repo: 'jbgutierrez/path-parse', tag: 'v1.0.7' },
  'object-assign': { repo: 'sindresorhus/object-assign', tag: 'v4.1.1' },
  // ── Tier 2 expansion (Step 7) ──
  'mkdirp': { repo: 'isaacs/node-mkdirp', tag: 'v3.0.1' },
  'rimraf': { repo: 'isaacs/rimraf', tag: 'v5.0.10' },
  'picomatch': { repo: 'micromatch/picomatch', tag: '2.3.1' },
  'micromatch': { repo: 'micromatch/micromatch', tag: '4.0.8' },
  'fast-glob': { repo: 'mrmlnc/fast-glob', tag: '3.3.3' },
  'anymatch': { repo: 'micromatch/anymatch', tag: 'v3.1.3' },
  'fill-range': { repo: 'jonschlinkert/fill-range', tag: '7.1.1' },
  'to-regex-range': { repo: 'micromatch/to-regex-range', tag: '5.0.1' },
  'merge2': { repo: 'teambition/merge2', tag: 'v1.4.1' },
  'run-parallel': { repo: 'feross/run-parallel', tag: 'v1.2.0' },
  // ── Tier 3 expansion (Step 7) ──
  'axios': { repo: 'axios/axios', tag: 'v1.7.9' },
  'node-fetch': { repo: 'node-fetch/node-fetch', tag: 'v3.3.2' },
  'form-data': { repo: 'form-data/form-data', tag: 'v4.0.1' },
  'tough-cookie': { repo: 'salesforce/tough-cookie', tag: 'v5.1.2' },
  'follow-redirects': { repo: 'follow-redirects/follow-redirects', tag: 'v1.15.9' },
  'mime-types': { repo: 'jshttp/mime-types', tag: 'v2.1.35' },
  'mime-db': { repo: 'jshttp/mime-db', tag: 'v1.52.0' },
  'proxy-addr': { repo: 'jshttp/proxy-addr', tag: 'v2.0.7' },
  'forwarded': { repo: 'jshttp/forwarded', tag: 'v0.2.0' },
  'ipaddr.js': { repo: 'whitequark/ipaddr.js', tag: 'v2.2.0' },
  'statuses': { repo: 'jshttp/statuses', tag: 'v2.0.1' },
  'toidentifier': { repo: 'component/toidentifier', tag: '1.0.1' },
  'merge-descriptors': { repo: 'component/merge-descriptors', tag: '2.0.0' },
  'utils-merge': { repo: 'jaredhanson/utils-merge', tag: 'v1.0.1' },
  'path-to-regexp': { repo: 'pillarjs/path-to-regexp', tag: 'v6.3.0' },
  'methods': { repo: 'jshttp/methods', tag: 'v1.1.2' },
  'vary': { repo: 'jshttp/vary', tag: 'v1.1.2' },
  'encodeurl': { repo: 'pillarjs/encodeurl', tag: 'v2.0.0' },
  'escape-html': { repo: 'component/escape-html', tag: 'v1.0.3' },
  'parseurl': { repo: 'pillarjs/parseurl', tag: 'v1.3.3' },
  'on-headers': { repo: 'jshttp/on-headers', tag: 'v1.0.2' },
};

/**
 * Install a package via git clone (in WSL for Linux semantics).
 */
export function installPackage(name: string): { version: string; dir: string } {
  const pkgDir = join(PACKAGES_DIR, name);
  const wslPkgDir = toWslPath(pkgDir);

  if (!existsSync(PACKAGES_DIR)) {
    mkdirSync(PACKAGES_DIR, { recursive: true });
  }

  if (!existsSync(join(pkgDir, 'package.json'))) {
    const repoInfo = GIT_REPOS[name];
    if (repoInfo) {
      wslRun('clone', pkgDir, repoInfo.repo, repoInfo.tag, toWslPath(pkgDir));
    }

    if (!existsSync(join(pkgDir, 'package.json'))) {
      return { version: 'clone-failed', dir: pkgDir };
    }

    // npm install in WSL
    wslRun('install', pkgDir);

    // Build step if needed
    try {
      const scripts = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).scripts ?? {};
      if (scripts.prepare || scripts.build || scripts.pretest) {
        wslRun('build', pkgDir);
      }
    } catch {}
  }

  try {
    const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    return { version: pkgJson.version ?? 'unknown', dir: pkgDir };
  } catch {
    return { version: 'unknown', dir: pkgDir };
  }
}

/**
 * Find the test command for a package.
 */
export function findTestCommand(name: string, pkgDir: string): string | null {
  if (TEST_CMD_OVERRIDES[name]) return TEST_CMD_OVERRIDES[name];

  try {
    const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    if (pkgJson.scripts?.test) {
      let cmd = pkgJson.scripts.test;
      if (/^echo\b|no test specified/.test(cmd)) return null;
      cmd = cmd.replace(/^(nyc\s+|c8\s+|istanbul\s+cover\s+)/, '');
      cmd = cmd.replace(/^npm run lint\s*&&\s*/, '');
      return cmd;
    }
  } catch {}

  if (existsSync(join(pkgDir, 'test'))) return 'mocha test --recursive --timeout 10000';
  if (existsSync(join(pkgDir, 'tests'))) return 'mocha tests --recursive --timeout 10000';
  return null;
}

/** Classify error messages by Node API */
function classifyError(msg: string): string {
  if (/crypto|cipher|hash|hmac|sign|verify|random/i.test(msg)) return 'crypto';
  if (/ENOENT|EACCES|readFile|writeFile|stat|readdir|mkdir|unlink/i.test(msg)) return 'fs';
  if (/socket|connect|listen|ECONNREFUSED|ECONNRESET|EPIPE/i.test(msg)) return 'net';
  if (/stream|pipe|readable|writable|transform|duplex/i.test(msg)) return 'stream';
  if (/ERR_INVALID_ARG|TypeError.*argument/i.test(msg)) return 'validation';
  if (/zlib|deflate|inflate|gzip|gunzip/i.test(msg)) return 'zlib';
  if (/vm|sandbox|context|Script/i.test(msg)) return 'vm';
  if (/child_process|spawn|exec|fork/i.test(msg)) return 'child_process';
  if (/Buffer|encoding|decode|encode/i.test(msg)) return 'buffer';
  if (/process|env|cwd|exit/i.test(msg)) return 'process';
  if (/url|URL|parse|href|hostname/i.test(msg)) return 'url';
  if (/http|request|response|header/i.test(msg)) return 'http';
  if (/path|resolve|join|dirname/i.test(msg)) return 'path';
  if (/timer|timeout|setTimeout|setInterval/i.test(msg)) return 'timers';
  return 'unknown';
}

/** Classify failure category */
function classifyCategory(msg: string): FailureDetail['category'] {
  if (/listen|EADDRINUSE|server\.listen|createServer/i.test(msg)) return 'preview-adapter';
  if (/fork|spawn|exec|child_process/i.test(msg)) return 'browser-ceiling';
  if (/ENOENT.*\/usr|ENOENT.*\/etc|ENOENT.*\/tmp/i.test(msg)) return 'env-dependent';
  return 'compat-bug';
}

/**
 * Parse test output with actual error extraction.
 */
export function parseTestOutput(stdout: string, stderr: string): {
  total: number; passed: number; failed: number; skipped: number;
  failures: Array<{ name: string; error: string }>;
} {
  const output = stdout + '\n' + stderr;
  const failures: Array<{ name: string; error: string }> = [];

  // Mocha: "N passing", "N failing"
  const mochaPass = output.match(/(\d+)\s+passing/);
  const mochaFail = output.match(/(\d+)\s+failing/);
  const mochaPend = output.match(/(\d+)\s+pending/);
  if (mochaPass) {
    const passed = parseInt(mochaPass[1]);
    const failed = mochaFail ? parseInt(mochaFail[1]) : 0;
    const skipped = mochaPend ? parseInt(mochaPend[1]) : 0;
    // Extract mocha failures: "  N) test name\n      ErrorType: message\n        at ..."
    const failRegex = /^\s+(\d+)\)\s+(.+)$/gm;
    let failMatch;
    while ((failMatch = failRegex.exec(output)) !== null) {
      const testName = failMatch[2].trim();
      // Look for error message on the next indented line(s)
      const afterIdx = failMatch.index + failMatch[0].length;
      const afterText = output.substring(afterIdx, afterIdx + 500);
      const errLine = afterText.match(/\n\s{4,}(\S.+)/);
      failures.push({ name: testName, error: errLine ? errLine[1].trim() : '' });
    }
    return { total: passed + failed + skipped, passed, failed, skipped, failures };
  }

  // Jest: "Tests: N failed, N skipped, N passed, N total"
  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    return {
      total: parseInt(jestMatch[4]),
      passed: parseInt(jestMatch[3]),
      failed: parseInt(jestMatch[1] ?? '0'),
      skipped: parseInt(jestMatch[2] ?? '0'),
      failures,
    };
  }

  // TAP: "1..N"
  const tapPlan = output.match(/^1\.\.(\d+)\s*$/m);
  if (tapPlan) {
    const total = parseInt(tapPlan[1]);
    const okLines = output.match(/^ok \d+/gm) ?? [];
    const notOkLines = output.match(/^not ok \d+.*/gm) ?? [];
    for (const line of notOkLines) {
      const name = line.replace(/^not ok \d+\s*-?\s*/, '').trim();
      // Look for error in next lines
      const idx = output.indexOf(line);
      const after = output.substring(idx + line.length, idx + line.length + 500);
      const errMatch = after.match(/(?:message|Error|operator|expected|actual):\s*(.+)/);
      failures.push({ name, error: errMatch?.[1]?.trim() ?? '' });
    }
    return { total, passed: okLines.length, failed: notOkLines.length, skipped: total - okLines.length - notOkLines.length, failures };
  }

  // TAP summary: "# tests N", "# pass N", "# fail N"
  const tapTests = output.match(/# tests\s+(\d+)/);
  const tapPass = output.match(/# pass\s+(\d+)/);
  const tapFail = output.match(/# fail\s+(\d+)/);
  if (tapTests || tapPass) {
    return {
      total: tapTests ? parseInt(tapTests[1]) : 0,
      passed: tapPass ? parseInt(tapPass[1]) : 0,
      failed: tapFail ? parseInt(tapFail[1]) : 0,
      skipped: 0, failures,
    };
  }

  // node:test: "# pass N", "# fail N"
  const nodePass = output.match(/# pass (\d+)/);
  const nodeFail = output.match(/# fail (\d+)/);
  if (nodePass) {
    const passed = parseInt(nodePass[1]);
    const failed = nodeFail ? parseInt(nodeFail[1]) : 0;
    return { total: passed + failed, passed, failed, skipped: 0, failures };
  }

  // Ava: "N tests passed"
  const avaPass = output.match(/(\d+)\s+tests?\s+passed/);
  const avaFail = output.match(/(\d+)\s+tests?\s+failed/);
  if (avaPass) {
    return {
      total: parseInt(avaPass[1]) + (avaFail ? parseInt(avaFail[1]) : 0),
      passed: parseInt(avaPass[1]),
      failed: avaFail ? parseInt(avaFail[1]) : 0,
      skipped: 0, failures,
    };
  }

  // Generic checkmarks
  const checks = (output.match(/✓|✔/g) ?? []).length;
  const crosses = (output.match(/✗|✘/g) ?? []).length;
  if (checks > 0 || crosses > 0) {
    return { total: checks + crosses, passed: checks, failed: crosses, skipped: 0, failures };
  }

  // Bare ok/not ok (tape without plan)
  const bareOk = (output.match(/^ok \d+/gm) ?? []).length;
  const bareNotOk = (output.match(/^not ok \d+/gm) ?? []).length;
  if (bareOk > 0 || bareNotOk > 0) {
    for (const line of (output.match(/^not ok \d+.*/gm) ?? [])) {
      failures.push({ name: line.trim(), error: '' });
    }
    return { total: bareOk + bareNotOk, passed: bareOk, failed: bareNotOk, skipped: 0, failures };
  }

  return { total: 0, passed: 0, failed: 0, skipped: 0, failures };
}

/**
 * Run a package's test suite in WSL.
 */
export async function runPackageTests(name: string, tier: number): Promise<PackageResult> {
  console.log(`\n[${name}] Installing...`);
  const { version, dir } = installPackage(name);

  if (version === 'clone-failed' || version === 'install-failed') {
    return { package: name, version, tier, total: 0, passed: 0, failed: 0, skipped: 0, rate: '0%', failures: [], error: 'Install failed' };
  }

  const testCmd = findTestCommand(name, dir);
  if (!testCmd) {
    return { package: name, version, tier, total: 0, passed: 0, failed: 0, skipped: 0, rate: 'N/A', failures: [], error: 'No test command' };
  }

  console.log(`[${name}@${version}] Running: ${testCmd}`);

  // Run test command in WSL
  const { stdout, stderr } = wslRun('test', dir, testCmd);
  const parsed = parseTestOutput(stdout, stderr);
  // Rate = passed/(passed+failed) — skipped tests don't penalize
  const executed = parsed.passed + parsed.failed;
  const rate = executed > 0 ? `${Math.round((parsed.passed / executed) * 100)}%` : '0%';

  const failures: FailureDetail[] = parsed.failures.map(f => ({
    testName: f.name,
    errorMessage: f.error,
    nodeApi: classifyError(f.name + ' ' + f.error),
    category: classifyCategory(f.name + ' ' + f.error),
  }));

  console.log(`[${name}] ${parsed.passed}/${parsed.total} passed (${rate})`);

  return { package: name, version, tier, total: parsed.total, passed: parsed.passed, failed: parsed.failed, skipped: parsed.skipped, rate, failures };
}

/**
 * Generate RESULTS.md from test results.
 */
export function generateResultsMd(results: PackageResult[]): string {
  let md = '# Package Compatibility Matrix\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += '| Package | Version | Total | Passed | Failed | Skipped | Rate | Tier |\n';
  md += '|---------|---------|-------|--------|--------|---------|------|------|\n';

  for (const r of results) {
    md += `| ${r.package} | ${r.version} | ${r.total} | ${r.passed} | ${r.failed} | ${r.skipped} | ${r.rate} | ${r.tier} |\n`;
  }

  for (const tier of [1, 2, 3]) {
    const tr = results.filter(r => r.tier === tier);
    const tt = tr.reduce((s, r) => s + r.total, 0);
    const tp = tr.reduce((s, r) => s + r.passed, 0);
    const tf = tr.reduce((s, r) => s + r.failed, 0);
    const ts = tr.reduce((s, r) => s + r.skipped, 0);
    const executed = tp + tf;
    const rate = executed > 0 ? `${Math.round((tp / executed) * 100)}%` : 'N/A';
    md += `| **Tier ${tier} Total** | | **${tt}** | **${tp}** | **${tf}** | **${ts}** | **${rate}** | **${tier}** |\n`;
  }

  const allFailures = results.flatMap(r => r.failures.map(f => ({ ...f, pkg: r.package })));
  if (allFailures.length > 0) {
    md += '\n## Failures\n\n';
    md += '| Package | Test | Error | Node API | Category |\n';
    md += '|---------|------|-------|----------|----------|\n';
    for (const f of allFailures) {
      const err = (f.errorMessage || '-').replace(/\|/g, '\\|').substring(0, 100);
      md += `| ${f.pkg} | ${f.testName.substring(0, 60)} | ${err} | ${f.nodeApi} | ${f.category} |\n`;
    }
  }

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    md += '\n## Errors\n\n';
    for (const r of errors) md += `- **${r.package}**: ${r.error}\n`;
  }

  return md;
}
