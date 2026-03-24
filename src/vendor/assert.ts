/**
 * Node.js assert module — browser-compatible via assert npm package.
 */
export const __atua = true;

import assert from 'assert';

export const ok = assert.ok;
export const fail = assert.fail;
export const equal = assert.equal;
export const notEqual = assert.notEqual;
export const deepEqual = assert.deepEqual;
export const deepStrictEqual = assert.deepStrictEqual;
export const notDeepEqual = assert.notDeepEqual;
export const notDeepStrictEqual = assert.notDeepStrictEqual;
export const strictEqual = assert.strictEqual;
export const notStrictEqual = assert.notStrictEqual;
export const throws = assert.throws;
export const doesNotThrow = assert.doesNotThrow;
export const rejects = assert.rejects;
export const doesNotReject = assert.doesNotReject;
export const ifError = assert.ifError;
export const match = assert.match;
export const doesNotMatch = assert.doesNotMatch;
export const AssertionError = (assert as any).AssertionError;
export const strict = assert.strict;

export default assert;
