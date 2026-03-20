/**
 * Node.js error code system.
 *
 * Provides exact error codes (ERR_INVALID_ARG_TYPE, ERR_MISSING_ARGS, etc.)
 * that packages parse. Based on Node.js lib/internal/errors.js.
 */

type ErrorCodeDef = [typeof Error | typeof TypeError | typeof RangeError, string | ((...args: any[]) => string)];

const codes = new Map<string, ErrorCodeDef>([
  ['ERR_INVALID_ARG_TYPE', [TypeError, (name: string, expected: string, actual: unknown) =>
    `The "${name}" argument must be of type ${expected}. Received ${typeof actual}`]],
  ['ERR_INVALID_ARG_VALUE', [TypeError, (name: string, value: unknown, reason?: string) =>
    `The argument '${name}' is invalid.${reason ? ' ' + reason : ''} Received ${String(value)}`]],
  ['ERR_MISSING_ARGS', [TypeError, (...args: string[]) =>
    `The ${args.map(a => `"${a}"`).join(', ')} argument${args.length > 1 ? 's' : ''} must be specified`]],
  ['ERR_OUT_OF_RANGE', [RangeError, (name: string, range: string, actual: unknown) =>
    `The value of "${name}" is out of range. It must be ${range}. Received ${actual}`]],
  ['ERR_INVALID_CALLBACK', [TypeError, 'Callback must be a function']],
  ['ERR_BUFFER_OUT_OF_BOUNDS', [RangeError, 'Attempt to access memory outside buffer bounds']],
  ['ERR_UNKNOWN_ENCODING', [TypeError, (encoding: string) => `Unknown encoding: ${encoding}`]],
  ['ERR_STREAM_PUSH_AFTER_EOF', [Error, 'stream.push() after EOF']],
  ['ERR_STREAM_DESTROYED', [Error, (method: string) => `Cannot call ${method} after a stream was destroyed`]],
  ['ERR_STREAM_NULL_VALUES', [TypeError, 'May not write null values to stream']],
  ['ERR_STREAM_WRITE_AFTER_END', [Error, 'write after end']],
  ['ERR_STREAM_ALREADY_FINISHED', [Error, 'Cannot call write after a stream was finished']],
  ['ERR_STREAM_PREMATURE_CLOSE', [Error, 'Premature close']],
  ['ERR_MULTIPLE_CALLBACK', [Error, 'Callback called multiple times']],
  ['ERR_METHOD_NOT_IMPLEMENTED', [Error, (method: string) => `The ${method} method is not implemented`]],
  ['ERR_SOCKET_CLOSED', [Error, 'Socket is closed']],
  ['ERR_SOCKET_BAD_PORT', [RangeError, (name: string, port: unknown) =>
    `${name} should be >= 0 and < 65536. Received ${port}`]],
  ['ERR_HTTP_HEADERS_SENT', [Error, (msg: string) => `Cannot ${msg} headers after they are sent to the client`]],
  ['ERR_HTTP_INVALID_HEADER_VALUE', [TypeError, (name: string, value: string) =>
    `Invalid value "${value}" for header "${name}"`]],
  ['ERR_UNHANDLED_ERROR', [Error, (err?: string) => `Unhandled error.${err ? ' (' + err + ')' : ''}`]],
  ['ERR_CRYPTO_INVALID_STATE', [Error, (msg: string) => `Invalid state for operation ${msg}`]],
  ['ERR_VM_MODULE_NOT_MODULE', [Error, 'Provided module is not an instance of Module']],
]);

interface NodeError extends Error {
  code: string;
}

function makeError(code: string): new (...args: any[]) => NodeError {
  const def = codes.get(code);
  if (!def) {
    throw new Error(`Unknown error code: ${code}`);
  }
  const [Base, messageFn] = def;

  return class extends (Base as any) {
    code: string;
    constructor(...args: any[]) {
      const message = typeof messageFn === 'function' ? messageFn(...args) : messageFn;
      super(message);
      this.code = code;
      this.name = `${Base.name} [${code}]`;
    }
  } as any;
}

// Pre-built error classes for common codes
export const ERR_INVALID_ARG_TYPE = makeError('ERR_INVALID_ARG_TYPE');
export const ERR_INVALID_ARG_VALUE = makeError('ERR_INVALID_ARG_VALUE');
export const ERR_MISSING_ARGS = makeError('ERR_MISSING_ARGS');
export const ERR_OUT_OF_RANGE = makeError('ERR_OUT_OF_RANGE');
export const ERR_INVALID_CALLBACK = makeError('ERR_INVALID_CALLBACK');
export const ERR_BUFFER_OUT_OF_BOUNDS = makeError('ERR_BUFFER_OUT_OF_BOUNDS');
export const ERR_UNKNOWN_ENCODING = makeError('ERR_UNKNOWN_ENCODING');
export const ERR_STREAM_PUSH_AFTER_EOF = makeError('ERR_STREAM_PUSH_AFTER_EOF');
export const ERR_STREAM_DESTROYED = makeError('ERR_STREAM_DESTROYED');
export const ERR_STREAM_NULL_VALUES = makeError('ERR_STREAM_NULL_VALUES');
export const ERR_STREAM_WRITE_AFTER_END = makeError('ERR_STREAM_WRITE_AFTER_END');
export const ERR_STREAM_ALREADY_FINISHED = makeError('ERR_STREAM_ALREADY_FINISHED');
export const ERR_STREAM_PREMATURE_CLOSE = makeError('ERR_STREAM_PREMATURE_CLOSE');
export const ERR_MULTIPLE_CALLBACK = makeError('ERR_MULTIPLE_CALLBACK');
export const ERR_METHOD_NOT_IMPLEMENTED = makeError('ERR_METHOD_NOT_IMPLEMENTED');
export const ERR_SOCKET_CLOSED = makeError('ERR_SOCKET_CLOSED');
export const ERR_SOCKET_BAD_PORT = makeError('ERR_SOCKET_BAD_PORT');
export const ERR_HTTP_HEADERS_SENT = makeError('ERR_HTTP_HEADERS_SENT');
export const ERR_UNHANDLED_ERROR = makeError('ERR_UNHANDLED_ERROR');
export const ERR_CRYPTO_INVALID_STATE = makeError('ERR_CRYPTO_INVALID_STATE');

// Dynamic error creation for codes not pre-built
export function createError(code: string): new (...args: any[]) => NodeError {
  return makeError(code);
}
