/**
 * Proof-of-concept: bytes package tests running through vitest compat config.
 *
 * Imports `assert` (resolves to Node builtin) and `bytes` (from node_modules).
 * Covers all 30 original test cases from the upstream bytes test suite.
 */
import { describe, it } from 'vitest';
import assert from 'assert';
import bytes from 'bytes';

// ── Constructor tests (bytes.js) ──

describe('Test constructor', () => {
  it('Expect a function', () => {
    assert.equal(typeof bytes, 'function');
  });

  it('Should return null if input is invalid', () => {
    assert.strictEqual(bytes(undefined as any), null);
    assert.strictEqual(bytes(null as any), null);
    assert.strictEqual(bytes(true as any), null);
    assert.strictEqual(bytes(false as any), null);
    assert.strictEqual(bytes(NaN), null);
    assert.strictEqual(bytes((() => {}) as any), null);
    assert.strictEqual(bytes({} as any), null);
    assert.strictEqual(bytes('foobar'), null);
  });

  it('Should be able to parse a string into a number', () => {
    assert.equal(bytes('1KB'), 1024);
  });

  it('Should convert a number into a string', () => {
    assert.equal(bytes(1024), '1KB');
  });

  it('Should convert a number into a string with options', () => {
    assert.equal(bytes(1000, { thousandsSeparator: ' ' }), '1 000B');
  });
});

// ── Parse tests (byte-parse.js) ──

describe('Test byte parse function', () => {
  it('Should return null if input is invalid', () => {
    assert.strictEqual(bytes.parse(undefined as any), null);
    assert.strictEqual(bytes.parse(null as any), null);
    assert.strictEqual(bytes.parse(true as any), null);
    assert.strictEqual(bytes.parse(false as any), null);
    assert.strictEqual(bytes.parse(NaN as any), null);
    assert.strictEqual(bytes.parse((() => {}) as any), null);
    assert.strictEqual(bytes.parse({} as any), null);
    assert.strictEqual(bytes.parse('foobar'), null);
  });

  it('Should parse raw number', () => {
    assert.strictEqual(bytes.parse(0 as any), 0);
    assert.strictEqual(bytes.parse(-1 as any), -1);
    assert.strictEqual(bytes.parse(1 as any), 1);
    assert.strictEqual(bytes.parse(10.5 as any), 10.5);
  });

  it('Should parse KB', () => {
    assert.equal(bytes.parse('1kb'), 1 * Math.pow(1024, 1));
    assert.equal(bytes.parse('1KB'), 1 * Math.pow(1024, 1));
    assert.equal(bytes.parse('0.5kb'), 0.5 * Math.pow(1024, 1));
    assert.equal(bytes.parse('1.5kb'), 1.5 * Math.pow(1024, 1));
  });

  it('Should parse MB', () => {
    assert.equal(bytes.parse('1mb'), 1 * Math.pow(1024, 2));
    assert.equal(bytes.parse('1MB'), 1 * Math.pow(1024, 2));
  });

  it('Should parse GB', () => {
    assert.equal(bytes.parse('1gb'), 1 * Math.pow(1024, 3));
    assert.equal(bytes.parse('1GB'), 1 * Math.pow(1024, 3));
  });

  it('Should parse TB', () => {
    assert.equal(bytes.parse('1tb'), 1 * Math.pow(1024, 4));
    assert.equal(bytes.parse('1TB'), 1 * Math.pow(1024, 4));
    assert.equal(bytes.parse('0.5tb'), 0.5 * Math.pow(1024, 4));
    assert.equal(bytes.parse('1.5tb'), 1.5 * Math.pow(1024, 4));
  });

  it('Should parse PB', () => {
    assert.equal(bytes.parse('1pb'), 1 * Math.pow(1024, 5));
    assert.equal(bytes.parse('1PB'), 1 * Math.pow(1024, 5));
    assert.equal(bytes.parse('0.5pb'), 0.5 * Math.pow(1024, 5));
    assert.equal(bytes.parse('1.5pb'), 1.5 * Math.pow(1024, 5));
  });

  it('Should assume bytes when no units', () => {
    assert.equal(bytes.parse('0'), 0);
    assert.equal(bytes.parse('-1'), -1);
    assert.equal(bytes.parse('1024'), 1024);
    assert.equal(bytes.parse('0x11'), 0);
  });

  it('Should accept negative values', () => {
    assert.equal(bytes.parse('-1'), -1);
    assert.equal(bytes.parse('-1024'), -1024);
    assert.equal(bytes.parse('-1.5TB'), -1.5 * Math.pow(1024, 4));
  });

  it('Should drop partial bytes', () => {
    assert.equal(bytes.parse('1.1b'), 1);
    assert.equal(bytes.parse('1.0001kb'), 1024);
  });

  it('Should allow whitespace', () => {
    assert.equal(bytes.parse('1 TB'), 1 * Math.pow(1024, 4));
  });
});

// ── Format tests (byte-format.js) ──

describe('Test byte format function', () => {
  const pb = Math.pow(1024, 5);
  const tb = (1 << 30) * 1024;
  const gb = 1 << 30;
  const mb = 1 << 20;
  const kb = 1 << 10;

  it('Should return null if input is invalid', () => {
    assert.strictEqual(bytes.format(undefined as any), null);
    assert.strictEqual(bytes.format(null as any), null);
    assert.strictEqual(bytes.format(true as any), null);
    assert.strictEqual(bytes.format(false as any), null);
    assert.strictEqual(bytes.format(NaN), null);
    assert.strictEqual(bytes.format(Infinity), null);
    assert.strictEqual(bytes.format('' as any), null);
    assert.strictEqual(bytes.format('string' as any), null);
    assert.strictEqual(bytes.format((() => {}) as any), null);
    assert.strictEqual(bytes.format({} as any), null);
  });

  it('Should convert numbers < 1024 to bytes string', () => {
    assert.equal(bytes.format(0)!.toLowerCase(), '0b');
    assert.equal(bytes.format(100)!.toLowerCase(), '100b');
    assert.equal(bytes.format(-100)!.toLowerCase(), '-100b');
  });

  it('Should convert numbers >= 1024 to kb string', () => {
    assert.equal(bytes.format(kb)!.toLowerCase(), '1kb');
    assert.equal(bytes.format(-kb)!.toLowerCase(), '-1kb');
    assert.equal(bytes.format(2 * kb)!.toLowerCase(), '2kb');
  });

  it('Should convert numbers >= 1048576 to mb string', () => {
    assert.equal(bytes.format(mb)!.toLowerCase(), '1mb');
    assert.equal(bytes.format(-mb)!.toLowerCase(), '-1mb');
    assert.equal(bytes.format(2 * mb)!.toLowerCase(), '2mb');
  });

  it('Should convert numbers >= (1 << 30) to gb string', () => {
    assert.equal(bytes.format(gb)!.toLowerCase(), '1gb');
    assert.equal(bytes.format(-gb)!.toLowerCase(), '-1gb');
    assert.equal(bytes.format(2 * gb)!.toLowerCase(), '2gb');
  });

  it('Should convert numbers >= ((1 << 30) * 1024) to tb string', () => {
    assert.equal(bytes.format(tb)!.toLowerCase(), '1tb');
    assert.equal(bytes.format(-tb)!.toLowerCase(), '-1tb');
    assert.equal(bytes.format(2 * tb)!.toLowerCase(), '2tb');
  });

  it('Should convert numbers >= 1125899906842624 to pb string', () => {
    assert.equal(bytes.format(pb)!.toLowerCase(), '1pb');
    assert.equal(bytes.format(-pb)!.toLowerCase(), '-1pb');
    assert.equal(bytes.format(2 * pb)!.toLowerCase(), '2pb');
  });

  it('Should return standard case', () => {
    assert.equal(bytes.format(10), '10B');
    assert.equal(bytes.format(kb), '1KB');
    assert.equal(bytes.format(mb), '1MB');
    assert.equal(bytes.format(gb), '1GB');
    assert.equal(bytes.format(tb), '1TB');
    assert.equal(bytes.format(pb), '1PB');
  });

  it('Should support custom thousands separator', () => {
    assert.equal(bytes.format(1000)!.toLowerCase(), '1000b');
    assert.equal(bytes.format(1000, { thousandsSeparator: '' })!.toLowerCase(), '1000b');
    assert.equal(bytes.format(1000, { thousandsSeparator: '.' })!.toLowerCase(), '1.000b');
    assert.equal(bytes.format(1000, { thousandsSeparator: ',' })!.toLowerCase(), '1,000b');
    assert.equal(bytes.format(1000, { thousandsSeparator: ' ' })!.toLowerCase(), '1 000b');
  });

  it('Should support custom unit separator', () => {
    assert.equal(bytes.format(1024), '1KB');
    assert.equal(bytes.format(1024, { unitSeparator: '' }), '1KB');
    assert.equal(bytes.format(1024, { unitSeparator: ' ' }), '1 KB');
    assert.equal(bytes.format(1024, { unitSeparator: '\t' }), '1\tKB');
  });

  it('Should support custom number of decimal places', () => {
    assert.equal(bytes.format(kb - 1, { decimalPlaces: 0 })!.toLowerCase(), '1023b');
    assert.equal(bytes.format(kb, { decimalPlaces: 0 })!.toLowerCase(), '1kb');
    assert.equal(bytes.format(1.4 * kb, { decimalPlaces: 0 })!.toLowerCase(), '1kb');
    assert.equal(bytes.format(1.5 * kb, { decimalPlaces: 0 })!.toLowerCase(), '2kb');
    assert.equal(bytes.format(1.1005 * kb, { decimalPlaces: 4 })!.toLowerCase(), '1.1005kb');
  });

  it('Should support fixed decimal places', () => {
    assert.equal(bytes.format(kb, { decimalPlaces: 3, fixedDecimals: true })!.toLowerCase(), '1.000kb');
  });

  it('Should support floats', () => {
    assert.equal(bytes.format(1.2 * mb)!.toLowerCase(), '1.2mb');
    assert.equal(bytes.format(-1.2 * mb)!.toLowerCase(), '-1.2mb');
    assert.equal(bytes.format(1.2 * kb)!.toLowerCase(), '1.2kb');
  });

  it('Should support custom unit', () => {
    assert.equal(bytes.format(12 * mb, { unit: 'b' })!.toLowerCase(), '12582912b');
    assert.equal(bytes.format(12 * mb, { unit: 'kb' })!.toLowerCase(), '12288kb');
    assert.equal(bytes.format(12 * gb, { unit: 'mb' })!.toLowerCase(), '12288mb');
    assert.equal(bytes.format(12 * tb, { unit: 'gb' })!.toLowerCase(), '12288gb');
  });
});
