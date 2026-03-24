/**
 * Node.js test module — pure JS test runner implementation.
 *
 * Provides test, describe, it, before/after hooks, and mock utilities.
 */
export const __atua = true;

interface TestContext {
  name: string;
  fn: (t: TestHandle) => void | Promise<void>;
  only?: boolean;
  skip?: boolean | string;
  todo?: boolean | string;
}

interface TestHandle {
  name: string;
  diagnostic(msg: string): void;
  skip(msg?: string): void;
  todo(msg?: string): void;
  assert: {
    ok(value: any, msg?: string): void;
    strictEqual(a: any, b: any, msg?: string): void;
    deepStrictEqual(a: any, b: any, msg?: string): void;
  };
}

interface Suite {
  name: string;
  tests: TestContext[];
  befores: Array<() => void | Promise<void>>;
  afters: Array<() => void | Promise<void>>;
  beforeEaches: Array<() => void | Promise<void>>;
  afterEaches: Array<() => void | Promise<void>>;
  suites: Suite[];
}

const _rootSuite: Suite = {
  name: '<root>',
  tests: [],
  befores: [],
  afters: [],
  beforeEaches: [],
  afterEaches: [],
  suites: [],
};

let _currentSuite: Suite = _rootSuite;

function createHandle(name: string): TestHandle {
  return {
    name,
    diagnostic(msg: string) { console.log(`# ${msg}`); },
    skip(msg?: string) { throw { __skip: true, message: msg }; },
    todo(msg?: string) { throw { __todo: true, message: msg }; },
    assert: {
      ok(value: any, msg?: string) { if (!value) throw new Error(msg ?? `Expected truthy, got ${value}`); },
      strictEqual(a: any, b: any, msg?: string) { if (a !== b) throw new Error(msg ?? `Expected ${a} === ${b}`); },
      deepStrictEqual(a: any, b: any, msg?: string) {
        if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg ?? `Expected deep equal`);
      },
    },
  };
}

type TestFn = (t: TestHandle) => void | Promise<void>;
type TestOptions = { only?: boolean; skip?: boolean | string; todo?: boolean | string; concurrency?: number; timeout?: number; signal?: AbortSignal };

export function test(name: string, fnOrOptions?: TestFn | TestOptions, fn?: TestFn): void {
  let testFn: TestFn;
  let opts: TestOptions = {};
  if (typeof fnOrOptions === 'function') {
    testFn = fnOrOptions;
  } else {
    opts = fnOrOptions ?? {};
    testFn = fn ?? (() => {});
  }
  _currentSuite.tests.push({ name, fn: testFn, only: opts.only, skip: opts.skip, todo: opts.todo });
}

export function describe(name: string, fn: () => void): void {
  const suite: Suite = {
    name,
    tests: [],
    befores: [],
    afters: [],
    beforeEaches: [],
    afterEaches: [],
    suites: [],
  };
  _currentSuite.suites.push(suite);
  const prev = _currentSuite;
  _currentSuite = suite;
  fn();
  _currentSuite = prev;
}

export function it(name: string, fnOrOptions?: TestFn | TestOptions, fn?: TestFn): void {
  test(name, fnOrOptions as any, fn);
}

export function before(fn: () => void | Promise<void>): void {
  _currentSuite.befores.push(fn);
}

export function after(fn: () => void | Promise<void>): void {
  _currentSuite.afters.push(fn);
}

export function beforeEach(fn: () => void | Promise<void>): void {
  _currentSuite.beforeEaches.push(fn);
}

export function afterEach(fn: () => void | Promise<void>): void {
  _currentSuite.afterEaches.push(fn);
}

// ── Mock utilities ─────────────────────────────────────────
interface SpyFn<F extends (...args: any[]) => any = (...args: any[]) => any> {
  (...args: Parameters<F>): ReturnType<F>;
  mock: {
    calls: Array<{ arguments: any[]; result?: any; error?: any }>;
    callCount(): number;
    resetCalls(): void;
    restore?: () => void;
  };
}

function createSpy<F extends (...args: any[]) => any>(original?: F): SpyFn<F> {
  const calls: Array<{ arguments: any[]; result?: any; error?: any }> = [];
  const spy = function (this: any, ...args: any[]) {
    const entry: { arguments: any[]; result?: any; error?: any } = { arguments: args };
    calls.push(entry);
    if (original) {
      try {
        const result = original.apply(this, args);
        entry.result = result;
        return result;
      } catch (err) {
        entry.error = err;
        throw err;
      }
    }
    return undefined;
  } as SpyFn<F>;
  spy.mock = {
    calls,
    callCount() { return calls.length; },
    resetCalls() { calls.length = 0; },
  };
  return spy;
}

const _mocked: Array<{ obj: any; key: string; original: any }> = [];

export const mock = {
  fn<F extends (...args: any[]) => any>(original?: F): SpyFn<F> {
    return createSpy(original);
  },
  method(obj: any, methodName: string, implementation?: (...args: any[]) => any): SpyFn {
    const original = obj[methodName];
    const spy = createSpy(implementation ?? original);
    spy.mock.restore = () => { obj[methodName] = original; };
    _mocked.push({ obj, key: methodName, original });
    obj[methodName] = spy;
    return spy;
  },
  reset() {
    // Reset call counts on all spies but keep mocks in place
  },
  restoreAll() {
    for (const { obj, key, original } of _mocked) {
      obj[key] = original;
    }
    _mocked.length = 0;
  },
};

// ── Runner ─────────────────────────────────────────────────
interface RunResult {
  pass: number;
  fail: number;
  skip: number;
  todo: number;
  errors: Array<{ name: string; error: any }>;
}

async function runSuite(suite: Suite, indent: number = 0): Promise<RunResult> {
  const result: RunResult = { pass: 0, fail: 0, skip: 0, todo: 0, errors: [] };
  const prefix = '  '.repeat(indent);

  if (suite.name !== '<root>') console.log(`${prefix}# ${suite.name}`);

  for (const hook of suite.befores) await hook();

  for (const t of suite.tests) {
    if (t.skip) {
      console.log(`${prefix}ok - ${t.name} # SKIP ${typeof t.skip === 'string' ? t.skip : ''}`);
      result.skip++;
      continue;
    }
    if (t.todo) {
      console.log(`${prefix}ok - ${t.name} # TODO ${typeof t.todo === 'string' ? t.todo : ''}`);
      result.todo++;
      continue;
    }
    for (const hook of suite.beforeEaches) await hook();
    try {
      await t.fn(createHandle(t.name));
      console.log(`${prefix}ok - ${t.name}`);
      result.pass++;
    } catch (err: any) {
      if (err?.__skip) {
        console.log(`${prefix}ok - ${t.name} # SKIP ${err.message ?? ''}`);
        result.skip++;
      } else if (err?.__todo) {
        console.log(`${prefix}ok - ${t.name} # TODO ${err.message ?? ''}`);
        result.todo++;
      } else {
        console.log(`${prefix}not ok - ${t.name}`);
        console.log(`${prefix}  ${err?.message ?? err}`);
        result.fail++;
        result.errors.push({ name: t.name, error: err });
      }
    }
    for (const hook of suite.afterEaches) await hook();
  }

  for (const sub of suite.suites) {
    const subResult = await runSuite(sub, indent + 1);
    result.pass += subResult.pass;
    result.fail += subResult.fail;
    result.skip += subResult.skip;
    result.todo += subResult.todo;
    result.errors.push(...subResult.errors);
  }

  for (const hook of suite.afters) await hook();

  return result;
}

export async function run(_options?: any): Promise<RunResult> {
  const result = await runSuite(_rootSuite);
  const total = result.pass + result.fail + result.skip + result.todo;
  console.log(`\n1..${total}`);
  console.log(`# pass ${result.pass}`);
  console.log(`# fail ${result.fail}`);
  console.log(`# skip ${result.skip}`);
  console.log(`# todo ${result.todo}`);
  // Reset for next run
  _rootSuite.tests = [];
  _rootSuite.suites = [];
  _rootSuite.befores = [];
  _rootSuite.afters = [];
  _rootSuite.beforeEaches = [];
  _rootSuite.afterEaches = [];
  return result;
}

// test.only, test.skip, test.todo
test.only = function (name: string, fn: TestFn): void { test(name, { only: true }, fn); };
test.skip = function (name: string, fn?: TestFn): void { test(name, { skip: true }, fn ?? (() => {})); };
test.todo = function (name: string, fn?: TestFn): void { test(name, { todo: true }, fn ?? (() => {})); };

const testModule = {
  test, describe, it, before, after, beforeEach, afterEach, mock, run, __atua,
};
export default testModule;
