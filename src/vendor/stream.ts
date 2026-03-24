// TODO(browser): Replace with browser-native implementation
/**
 * Node.js stream module re-export.
 * Pure JS — works in any environment.
 */
import stream from 'stream';

export const {
  Readable, Writable, Duplex, Transform, PassThrough,
  pipeline, finished, Stream,
} = stream;

export default stream;
