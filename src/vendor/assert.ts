// TODO(browser): Replace with browser-native implementation
/**
 * Node.js assert module re-export.
 * Pure JS — works in any environment.
 */
import assert from 'assert';

export const {
  ok, fail, equal, notEqual, deepEqual, deepStrictEqual,
  notDeepEqual, notDeepStrictEqual, strictEqual, notStrictEqual,
  throws, doesNotThrow, rejects, doesNotReject, ifError,
  match, doesNotMatch, AssertionError,
} = assert as any;

export { strict } from 'assert';
export default assert;
