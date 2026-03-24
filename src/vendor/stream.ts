/**
 * Node.js stream module — browser-compatible via readable-stream npm package.
 */
export const __atua = true;

import stream from 'readable-stream';

export const Readable = stream.Readable;
export const Writable = stream.Writable;
export const Duplex = stream.Duplex;
export const Transform = stream.Transform;
export const PassThrough = stream.PassThrough;
export const pipeline = stream.pipeline;
export const finished = stream.finished;
export const Stream = stream.Stream;

export default stream;
