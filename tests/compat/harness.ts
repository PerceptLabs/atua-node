import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

export type PackageStatus = 'pass' | 'runtime-fail' | 'harness-fail' | 'no-runtime-test';
export type InstallMode =
  | 'npm-ci'
  | 'npm-install'
  | 'npm-ci-legacy'
  | 'npm-install-legacy'
  | 'yarn-install'
  | 'pnpm-install';

export interface FailureDetail {
  testName: string;
  errorMessage: string;
  nodeApi: string;
  category: 'compat-bug' | 'browser-ceiling' | 'preview-adapter' | 'env-dependent';
}

export interface PackageResult {
  package: string;
  npmName: string;
  version: string;
  tier: number;
  status: PackageStatus;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  rate: string;
  countAvailable: boolean;
  failures: FailureDetail[];
  command?: string;
  exitCode?: number;
  installMode?: InstallMode;
  source?: string;
  sourceRef?: string;
  resolvedAt?: string;
  error?: string;
}

type ResolvedPackage = {
  alias: string;
  npmName: string;
  version: string;
  repoUrl: string;
  source: string;
  sourceRef: string;
  resolvedAt: string;
};

type WorkflowHints = {
  testCommands: string[];
  installCommands: string[];
};

type ParseResult = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  countAvailable: boolean;
  failures: Array<{ name: string; error: string }>;
};

const COMPAT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PACKAGES_DIR = resolve(COMPAT_DIR, '.packages');
const SOURCE_META_FILE = '.atua-source.json';
const INSTALL_META_FILE = '.atua-install.json';
const RESOLUTION_CACHE = new Map<string, ResolvedPackage>();

const NPM_NAME_OVERRIDES: Record<string, string> = {
  hapi: '@hapi/hapi',
  'mocha-pkg': 'mocha',
  'tape-pkg': 'tape',
};

const REPO_URL_OVERRIDES: Record<string, string> = {
  hapi: 'https://github.com/hapijs/hapi.git',
};

const COMMAND_OVERRIDES: Record<string, string> = {
  'mocha-pkg': 'npm run test-node',
  'lru-cache': 'test -d ./node_modules/@tapjs/clock || npm install --no-save --legacy-peer-deps @tapjs/clock@3.0.3; npm test',
};

function toWslPath(winPath: string): string {
  return winPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}

const WSL_SCRIPT = toWslPath(resolve(COMPAT_DIR, 'wsl-run.sh'));

function wslRun(
  action: string,
  pkgDir: string,
  ...args: string[]
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('wsl', ['bash', WSL_SCRIPT, action, toWslPath(pkgDir), ...args], {
    stdio: 'pipe',
    timeout: 30 * 60 * 1000,
  });
  return {
    stdout: result.stdout?.toString('utf8') ?? '',
    stderr: result.stderr?.toString('utf8') ?? '',
    status: result.status ?? 1,
  };
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function npmViewString(pkgName: string, field: string): string | null {
  let raw = '';
  try {
    raw = execSync(`npm view "${pkgName}" "${field}" --json`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    }).trim();
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  const parsed = safeJsonParse<unknown>(raw);
  if (typeof parsed === 'string') {
    return parsed;
  }
  if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
    return parsed[0];
  }
  return raw.replace(/^"|"$/g, '');
}

function normalizeRepoUrl(raw: string | null): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/^git\+/, '').replace(/^git:\/\//, 'https://');
  value = value.replace(/^git@github\.com:/, 'https://github.com/');
  value = value.replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/');
  value = value.replace(/#.*$/, '');
  if (!value.endsWith('.git')) {
    value += '.git';
  }
  if (!/^https:\/\/github\.com\//i.test(value)) {
    return null;
  }
  return value;
}

function readPackageJson(pkgDir: string): any | null {
  const path = join(pkgDir, 'package.json');
  if (!existsSync(path)) return null;
  return safeJsonParse<any>(readFileSync(path, 'utf8'));
}

function getPackageDir(alias: string): string {
  return join(PACKAGES_DIR, alias);
}

function ensurePackagesDir(): void {
  if (!existsSync(PACKAGES_DIR)) {
    mkdirSync(PACKAGES_DIR, { recursive: true });
  }
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return safeJsonParse<T>(readFileSync(path, 'utf8'));
}

function writeJsonFile(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function getGitTags(repoUrl: string): Set<string> {
  const output = execSync(`git ls-remote --tags --refs ${repoUrl}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 120_000,
  });
  const tags = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/refs\/tags\/(.+)$/);
    if (match) {
      tags.add(match[1]);
    }
  }
  return tags;
}

function resolveGitRef(alias: string, npmName: string, version: string, repoUrl: string): string {
  const tags = getGitTags(repoUrl);
  const repoBase = repoUrl.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').split('/').pop() ?? alias;
  const bareName = npmName.replace(/^@[^/]+\//, '');
  const candidates = [
    `v${version}`,
    version,
    `${npmName}@${version}`,
    `${bareName}@${version}`,
    `${alias}@${version}`,
    `${repoBase}@${version}`,
  ];
  for (const candidate of candidates) {
    if (tags.has(candidate)) {
      return candidate;
    }
  }
  return 'HEAD';
}

function resolvePackageSource(alias: string): ResolvedPackage {
  const cached = RESOLUTION_CACHE.get(alias);
  if (cached) return cached;

  const npmName = NPM_NAME_OVERRIDES[alias] ?? alias;
  const version = npmViewString(npmName, 'version');
  if (!version) {
    throw new Error(`Failed to resolve latest npm version for ${npmName}`);
  }
  const repoUrl =
    REPO_URL_OVERRIDES[alias] ??
    normalizeRepoUrl(npmViewString(npmName, 'repository.url'));
  if (!repoUrl) {
    throw new Error(`Failed to resolve GitHub repository for ${npmName}`);
  }
  const sourceRef = resolveGitRef(alias, npmName, version, repoUrl);
  const resolved: ResolvedPackage = {
    alias,
    npmName,
    version,
    repoUrl,
    source: sourceRef === 'HEAD' ? 'git-head' : 'git-tag',
    sourceRef,
    resolvedAt: new Date().toISOString(),
  };
  RESOLUTION_CACHE.set(alias, resolved);
  return resolved;
}

function syncPackageSource(resolved: ResolvedPackage): { pkgDir: string; error?: string } {
  ensurePackagesDir();
  const pkgDir = getPackageDir(resolved.alias);
  const sourceMeta = readJsonFile<{ repoUrl: string; sourceRef: string; version: string }>(
    join(pkgDir, SOURCE_META_FILE),
  );
  const needsSync =
    !existsSync(join(pkgDir, 'package.json')) ||
    !sourceMeta ||
    sourceMeta.repoUrl !== resolved.repoUrl ||
    sourceMeta.sourceRef !== resolved.sourceRef ||
    sourceMeta.version !== resolved.version;

  if (needsSync) {
    const sync = wslRun('sync', pkgDir, resolved.repoUrl, resolved.sourceRef);
    if (sync.status !== 0) {
      return { pkgDir, error: compactOutput(sync.stdout, sync.stderr) };
    }
    writeJsonFile(join(pkgDir, SOURCE_META_FILE), {
      repoUrl: resolved.repoUrl,
      sourceRef: resolved.sourceRef,
      version: resolved.version,
    });
  }

  return { pkgDir };
}

function extractWorkflowHints(pkgDir: string): WorkflowHints {
  const workflowsDir = join(pkgDir, '.github', 'workflows');
  const hints: WorkflowHints = { testCommands: [], installCommands: [] };
  if (!existsSync(workflowsDir)) {
    return hints;
  }

  for (const entry of readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/i.test(entry)) continue;
    const content = readFileSync(join(workflowsDir, entry), 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const single = line.match(/^\s*run:\s*(.+?)\s*$/);
      if (single && single[1] !== '|') {
        collectWorkflowCommand(single[1], hints);
        continue;
      }

      if (/^\s*run:\s*\|\s*$/.test(line)) {
        const blockIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
        i++;
        while (i < lines.length) {
          const blockLine = lines[i];
          const indent = blockLine.match(/^(\s*)/)?.[1].length ?? 0;
          if (blockLine.trim() && indent <= blockIndent) {
            i--;
            break;
          }
          if (blockLine.trim()) {
            collectWorkflowCommand(blockLine.trim(), hints);
          }
          i++;
        }
        continue;
      }

      const reusable = line.match(/^\s*npm-script:\s*(.+?)\s*$/);
      if (reusable) {
        collectWorkflowCommand(`npm run ${reusable[1].trim()}`, hints);
      }
    }
  }

  return hints;
}

function collectWorkflowCommand(command: string, hints: WorkflowHints): void {
  const normalized = command.trim().replace(/^['"]|['"]$/g, '');
  if (!normalized) return;
  if (/(^|[;&|])\s*(npm|pnpm|yarn)\s+(ci|install)\b/.test(normalized)) {
    hints.installCommands.push(normalized);
  }
  if (/(^|[;&|])\s*(npm|pnpm|yarn)\s+(run\s+)?test\b/.test(normalized)) {
    hints.testCommands.push(normalized);
  }
}

function selectInstallMode(pkgDir: string, runtimeCommand: string | null, hints: WorkflowHints): InstallMode {
  const installText = hints.installCommands.join('\n');
  if (/pnpm\s+install\b/.test(installText) || runtimeCommand?.startsWith('pnpm ')) {
    return 'pnpm-install';
  }
  if (/yarn\s+install\b/.test(installText) || runtimeCommand?.startsWith('yarn ')) {
    return 'yarn-install';
  }
  if (existsSync(join(pkgDir, 'package-lock.json')) || existsSync(join(pkgDir, 'npm-shrinkwrap.json'))) {
    return 'npm-ci';
  }
  return 'npm-install';
}

function chooseRuntimeCommand(alias: string, pkgDir: string): { command: string | null; hints: WorkflowHints } {
  if (COMMAND_OVERRIDES[alias]) {
    return { command: COMMAND_OVERRIDES[alias], hints: { testCommands: [], installCommands: [] } };
  }

  const pkgJson = readPackageJson(pkgDir);
  const hints = extractWorkflowHints(pkgDir);
  const scripts = pkgJson?.scripts ?? {};

  const exactMatches = [
    /^npm test(?:\s|$)/,
    /^npm run test(?:\s|$)/,
    /^npm run test-node(?:\s|$)/,
    /^npm run test:node(?:\s|$)/,
    /^yarn test(?:\s|$)/,
    /^pnpm test(?:\s|$)/,
    /^pnpm run test(?:\s|$)/,
  ];

  for (const regex of exactMatches) {
    const match = hints.testCommands.find(command => regex.test(command));
    if (match) {
      return { command: normalizeRuntimeCommand(match, scripts), hints };
    }
  }

  if (typeof scripts.test === 'string' && !/no test specified|^echo\b/i.test(scripts.test)) {
    return { command: 'npm test', hints };
  }
  if (typeof scripts['test-node'] === 'string') {
    return { command: 'npm run test-node', hints };
  }
  if (typeof scripts['test:node'] === 'string') {
    return { command: 'npm run test:node', hints };
  }

  return { command: null, hints };
}

function normalizeRuntimeCommand(command: string, scripts: Record<string, string>): string {
  let value = command.trim();
  const scriptInterpolation = value.match(/^npm run ([A-Za-z0-9:_-]+):\$\{\{/);
  if (scriptInterpolation && typeof scripts[scriptInterpolation[1]] === 'string') {
    value = `npm run ${scriptInterpolation[1]}`;
  }
  return value;
}

function installPackage(
  pkgDir: string,
  resolved: ResolvedPackage,
  installMode: InstallMode,
): { status: number; stdout: string; stderr: string; installMode: InstallMode } {
  const installMeta = readJsonFile<{ installMode: InstallMode; version: string; sourceRef: string }>(
    join(pkgDir, INSTALL_META_FILE),
  );
  if (
    existsSync(join(pkgDir, 'node_modules')) &&
    installMeta &&
    installMeta.installMode === installMode &&
    installMeta.version === resolved.version &&
    installMeta.sourceRef === resolved.sourceRef
  ) {
    return { status: 0, stdout: 'Reusing existing node_modules', stderr: '', installMode };
  }

  let result = wslRun('install', pkgDir, installMode);
  let finalMode = installMode;
  if (result.status !== 0 && installMode === 'npm-ci') {
    finalMode = 'npm-ci-legacy';
    result = wslRun('install', pkgDir, finalMode);
  } else if (result.status !== 0 && installMode === 'npm-install') {
    finalMode = 'npm-install-legacy';
    result = wslRun('install', pkgDir, finalMode);
  }

  if (result.status === 0) {
    writeJsonFile(join(pkgDir, INSTALL_META_FILE), {
      installMode: finalMode,
      version: resolved.version,
      sourceRef: resolved.sourceRef,
    });
  }

  return { ...result, installMode: finalMode };
}

function classifyHarnessFailure(output: string): boolean {
  return /command not found|Missing script:|ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND|Usage Error: Couldn't find a script|corepack|No such file or directory/i
    .test(output);
}

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

function classifyCategory(msg: string): FailureDetail['category'] {
  if (/listen|EADDRINUSE|server\.listen|createServer/i.test(msg)) return 'preview-adapter';
  if (/fork|spawn|exec|child_process/i.test(msg)) return 'browser-ceiling';
  if (/signal.*exit|SIGTERM|SIGINT|SIGHUP|SIGKILL/i.test(msg)) return 'browser-ceiling';
  if (/ENOENT.*\/usr|ENOENT.*\/etc|ENOENT.*\/tmp/i.test(msg)) return 'env-dependent';
  return 'compat-bug';
}

export function parseTestOutput(stdout: string, stderr: string): ParseResult {
  const output = `${stdout}\n${stderr}`;
  const failures: Array<{ name: string; error: string }> = [];

  const mochaPass = output.match(/(\d+)\s+passing/);
  if (mochaPass) {
    const passed = parseInt(mochaPass[1], 10);
    const failed = parseInt(output.match(/(\d+)\s+failing/)?.[1] ?? '0', 10);
    const skipped = parseInt(output.match(/(\d+)\s+pending/)?.[1] ?? '0', 10);
    const failRegex = /^\s+(\d+)\)\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = failRegex.exec(output)) !== null) {
      const after = output.slice(match.index + match[0].length, match.index + match[0].length + 400);
      failures.push({
        name: match[2].trim(),
        error: after.match(/\n\s{4,}(\S.+)/)?.[1]?.trim() ?? '',
      });
    }
    return { total: passed + failed + skipped, passed, failed, skipped, countAvailable: true, failures };
  }

  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    return {
      total: parseInt(jestMatch[4], 10),
      passed: parseInt(jestMatch[3], 10),
      failed: parseInt(jestMatch[1] ?? '0', 10),
      skipped: parseInt(jestMatch[2] ?? '0', 10),
      countAvailable: true,
      failures,
    };
  }

  const topLevelPlan = output.match(/^1\.\.(\d+)\s*$/m);
  const topLevelOk = output.match(/^ok \d+(?:\s+-\s+.*)?$/gm) ?? [];
  const topLevelNotOk = output.match(/^not ok \d+(?:\s+-\s+.*)?$/gm) ?? [];
  if (topLevelPlan || topLevelOk.length || topLevelNotOk.length) {
    for (const line of topLevelNotOk) {
      const idx = output.indexOf(line);
      const after = output.slice(idx + line.length, idx + line.length + 500);
      failures.push({
        name: line.replace(/^not ok \d+\s*-?\s*/, '').trim(),
        error: after.match(/(?:message|Error|operator|expected|actual):\s*(.+)/)?.[1]?.trim() ?? '',
      });
    }
    const total = topLevelPlan ? parseInt(topLevelPlan[1], 10) : topLevelOk.length + topLevelNotOk.length;
    const skipped = Math.max(0, total - topLevelOk.length - topLevelNotOk.length);
    return {
      total,
      passed: topLevelOk.length,
      failed: topLevelNotOk.length,
      skipped,
      countAvailable: true,
      failures,
    };
  }

  const tapTests = output.match(/# tests\s+(\d+)/);
  const tapPass = output.match(/# pass\s+(\d+)/);
  const tapFail = output.match(/# fail\s+(\d+)/);
  if (tapTests || tapPass || tapFail) {
    const passed = parseInt(tapPass?.[1] ?? '0', 10);
    const failed = parseInt(tapFail?.[1] ?? '0', 10);
    const total = parseInt(tapTests?.[1] ?? String(passed + failed), 10);
    return { total, passed, failed, skipped: Math.max(0, total - passed - failed), countAvailable: true, failures };
  }

  const nodePass = output.match(/# pass (\d+)/);
  const nodeFail = output.match(/# fail (\d+)/);
  if (nodePass || nodeFail) {
    const passed = parseInt(nodePass?.[1] ?? '0', 10);
    const failed = parseInt(nodeFail?.[1] ?? '0', 10);
    return { total: passed + failed, passed, failed, skipped: 0, countAvailable: true, failures };
  }

  const avaPass = output.match(/(\d+)\s+tests?\s+passed/);
  const avaFail = output.match(/(\d+)\s+tests?\s+failed/);
  if (avaPass || avaFail) {
    const passed = parseInt(avaPass?.[1] ?? '0', 10);
    const failed = parseInt(avaFail?.[1] ?? '0', 10);
    return { total: passed + failed, passed, failed, skipped: 0, countAvailable: true, failures };
  }

  const vitest = output.match(/Tests\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+failed)?(?:\s+\|\s+(\d+)\s+skipped)?/);
  if (vitest) {
    const passed = parseInt(vitest[1], 10);
    const failed = parseInt(vitest[2] ?? '0', 10);
    const skipped = parseInt(vitest[3] ?? '0', 10);
    return { total: passed + failed + skipped, passed, failed, skipped, countAvailable: true, failures };
  }

  return { total: 0, passed: 0, failed: 0, skipped: 0, countAvailable: false, failures };
}

function compactOutput(stdout: string, stderr: string): string {
  const text = `${stdout}\n${stderr}`
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-20)
    .join(' | ');
  return text.slice(0, 1200);
}

export async function runPackageTests(alias: string, tier: number): Promise<PackageResult> {
  console.log(`\n[${alias}] resolving source`);

  let resolved: ResolvedPackage;
  try {
    resolved = resolvePackageSource(alias);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      package: alias,
      npmName: NPM_NAME_OVERRIDES[alias] ?? alias,
      version: 'unknown',
      tier,
      status: 'harness-fail',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      rate: 'N/A',
      countAvailable: false,
      failures: [],
      error: message,
    };
  }

  const synced = syncPackageSource(resolved);
  if (synced.error) {
    return {
      package: alias,
      npmName: resolved.npmName,
      version: resolved.version,
      tier,
      status: 'harness-fail',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      rate: 'N/A',
      countAvailable: false,
      failures: [],
      source: resolved.source,
      sourceRef: resolved.sourceRef,
      resolvedAt: resolved.resolvedAt,
      error: synced.error,
    };
  }

  const { command, hints } = chooseRuntimeCommand(alias, synced.pkgDir);
  if (!command) {
    return {
      package: alias,
      npmName: resolved.npmName,
      version: resolved.version,
      tier,
      status: 'no-runtime-test',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      rate: 'N/A',
      countAvailable: false,
      failures: [],
      source: resolved.source,
      sourceRef: resolved.sourceRef,
      resolvedAt: resolved.resolvedAt,
      error: 'No upstream runtime test command found',
    };
  }

  const installMode = selectInstallMode(synced.pkgDir, command, hints);
  console.log(`[${alias}@${resolved.version}] install ${installMode}`);
  const install = installPackage(synced.pkgDir, resolved, installMode);
  if (install.status !== 0) {
    return {
      package: alias,
      npmName: resolved.npmName,
      version: resolved.version,
      tier,
      status: 'harness-fail',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      rate: 'N/A',
      countAvailable: false,
      failures: [],
      command,
      installMode: install.installMode,
      source: resolved.source,
      sourceRef: resolved.sourceRef,
      resolvedAt: resolved.resolvedAt,
      error: compactOutput(install.stdout, install.stderr),
    };
  }

  console.log(`[${alias}@${resolved.version}] test ${command}`);
  const test = wslRun('test', synced.pkgDir, command);
  const parsed = parseTestOutput(test.stdout, test.stderr);
  const executed = parsed.passed + parsed.failed;
  const rate = executed > 0 ? `${Math.round((parsed.passed / executed) * 100)}%` : test.status === 0 ? '100%' : '0%';
  const output = compactOutput(test.stdout, test.stderr);
  const status: PackageStatus =
    test.status === 0 ? 'pass' : classifyHarnessFailure(output) ? 'harness-fail' : 'runtime-fail';

  const failures: FailureDetail[] = parsed.failures.map(failure => ({
    testName: failure.name,
    errorMessage: failure.error,
    nodeApi: classifyError(`${failure.name} ${failure.error}`),
    category: classifyCategory(`${failure.name} ${failure.error}`),
  }));

  return {
    package: alias,
    npmName: resolved.npmName,
    version: resolved.version,
    tier,
    status,
    total: parsed.total,
    passed: parsed.passed,
    failed: parsed.failed,
    skipped: parsed.skipped,
    rate,
    countAvailable: parsed.countAvailable,
    failures,
    command,
    exitCode: test.status,
    installMode: install.installMode,
    source: resolved.source,
    sourceRef: resolved.sourceRef,
    resolvedAt: resolved.resolvedAt,
    error: test.status === 0 ? undefined : output,
  };
}

function aggregateCounts(results: PackageResult[]): { total: number; passed: number; failed: number; skipped: number } {
  const counted = results.filter(result => result.countAvailable);
  return counted.reduce(
    (acc, result) => ({
      total: acc.total + result.total,
      passed: acc.passed + result.passed,
      failed: acc.failed + result.failed,
      skipped: acc.skipped + result.skipped,
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );
}

function renderResultTable(results: PackageResult[]): string {
  let md = '| Package | npm | Version | Status | Total | Passed | Failed | Skipped | Rate | Counted | Tier |\n';
  md += '|---------|-----|---------|--------|-------|--------|--------|---------|------|---------|------|\n';
  for (const result of results) {
    md += `| ${result.package} | ${result.npmName} | ${result.version} | ${result.status} | ${result.total || '-'} | ${result.passed || '-'} | ${result.failed || '-'} | ${result.skipped || '-'} | ${result.rate} | ${result.countAvailable ? 'yes' : 'no'} | ${result.tier} |\n`;
  }
  return md;
}

export function generateResultsMd(results: PackageResult[]): string {
  const statuses = ['pass', 'runtime-fail', 'harness-fail', 'no-runtime-test'] as const;
  let md = '# Package Compatibility Matrix\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += '## Status Summary\n\n';
  for (const status of statuses) {
    md += `- ${status}: ${results.filter(result => result.status === status).length}\n`;
  }
  const counts = aggregateCounts(results);
  md += `- counted tests: ${counts.passed}/${counts.total} passed, ${counts.failed} failed, ${counts.skipped} skipped\n\n`;

  md += '## Results\n\n';
  md += renderResultTable(results);

  md += '\n## Tier Summaries\n\n';
  for (const tier of [1, 2, 3, 4]) {
    const tierResults = results.filter(result => result.tier === tier);
    const tierCounts = aggregateCounts(tierResults);
    md += `- Tier ${tier}: ${tierResults.filter(result => result.status === 'pass').length}/${tierResults.length} packages passing, counted tests ${tierCounts.passed}/${tierCounts.total}\n`;
  }

  const runtimeFailures = results.filter(result => result.status === 'runtime-fail');
  if (runtimeFailures.length) {
    md += '\n## Runtime Failures\n\n';
    for (const result of runtimeFailures) {
      md += `- **${result.package}** (${result.version}) via \`${result.command ?? 'unknown'}\`: ${result.error ?? 'No error captured'}\n`;
    }
  }

  const harnessFailures = results.filter(result => result.status === 'harness-fail');
  if (harnessFailures.length) {
    md += '\n## Harness Failures\n\n';
    for (const result of harnessFailures) {
      md += `- **${result.package}** (${result.version}) via \`${result.command ?? 'n/a'}\`: ${result.error ?? 'No error captured'}\n`;
    }
  }

  const noRuntimeTests = results.filter(result => result.status === 'no-runtime-test');
  if (noRuntimeTests.length) {
    md += '\n## No Runtime Test Command\n\n';
    for (const result of noRuntimeTests) {
      md += `- **${result.package}** (${result.version})\n`;
    }
  }

  const allFailures = results.flatMap(result => result.failures.map(failure => ({ package: result.package, failure })));
  if (allFailures.length) {
    md += '\n## Failure Details\n\n';
    md += '| Package | Test | Error | Node API | Category |\n';
    md += '|---------|------|-------|----------|----------|\n';
    for (const entry of allFailures) {
      const error = (entry.failure.errorMessage || '-').replace(/\|/g, '\\|').slice(0, 140);
      md += `| ${entry.package} | ${entry.failure.testName.replace(/\|/g, '\\|').slice(0, 80)} | ${error} | ${entry.failure.nodeApi} | ${entry.failure.category} |\n`;
    }
  }

  return md;
}

export function generateResolvedPackagesJson(results: PackageResult[]): string {
  return JSON.stringify(
    results.map(result => ({
      package: result.package,
      npmName: result.npmName,
      version: result.version,
      status: result.status,
      source: result.source,
      sourceRef: result.sourceRef,
      resolvedAt: result.resolvedAt,
      command: result.command,
      installMode: result.installMode,
      countAvailable: result.countAvailable,
      exitCode: result.exitCode,
    })),
    null,
    2,
  );
}
