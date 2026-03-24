/**
 * Node.js v8 module — browser-compatible implementation.
 *
 * serialize/deserialize use JSON + TextEncoder/TextDecoder.
 * Heap statistics from performance.memory when available.
 */
export const __atua = true;

const _encoder = new TextEncoder();
const _decoder = new TextDecoder();

export function serialize(value: any): Uint8Array {
  const json = JSON.stringify(value);
  return _encoder.encode(json);
}

export function deserialize(buffer: Uint8Array | ArrayBuffer): any {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const json = _decoder.decode(bytes);
  return JSON.parse(json);
}

export interface HeapStatistics {
  total_heap_size: number;
  total_heap_size_executable: number;
  total_physical_size: number;
  total_available_size: number;
  used_heap_size: number;
  heap_size_limit: number;
  malloced_memory: number;
  peak_malloced_memory: number;
  does_zap_garbage: number;
  number_of_native_contexts: number;
  number_of_detached_contexts: number;
  total_global_handles_size: number;
  used_global_handles_size: number;
  external_memory: number;
}

export function getHeapStatistics(): HeapStatistics {
  const mem = (performance as any).memory;
  const usedHeap = mem?.usedJSHeapSize ?? 0;
  const totalHeap = mem?.totalJSHeapSize ?? 0;
  const heapLimit = mem?.jsHeapSizeLimit ?? 0;
  return {
    total_heap_size: totalHeap,
    total_heap_size_executable: 0,
    total_physical_size: totalHeap,
    total_available_size: heapLimit > usedHeap ? heapLimit - usedHeap : 0,
    used_heap_size: usedHeap,
    heap_size_limit: heapLimit,
    malloced_memory: 0,
    peak_malloced_memory: 0,
    does_zap_garbage: 0,
    number_of_native_contexts: 1,
    number_of_detached_contexts: 0,
    total_global_handles_size: 0,
    used_global_handles_size: 0,
    external_memory: 0,
  };
}

export function getHeapSpaceStatistics(): Array<{ space_name: string; space_size: number; space_used_size: number; space_available_size: number; physical_space_size: number }> {
  const stats = getHeapStatistics();
  return [
    { space_name: 'new_space', space_size: stats.total_heap_size / 4, space_used_size: stats.used_heap_size / 4, space_available_size: 0, physical_space_size: 0 },
    { space_name: 'old_space', space_size: stats.total_heap_size / 2, space_used_size: stats.used_heap_size / 2, space_available_size: 0, physical_space_size: 0 },
    { space_name: 'code_space', space_size: stats.total_heap_size / 8, space_used_size: stats.used_heap_size / 8, space_available_size: 0, physical_space_size: 0 },
    { space_name: 'large_object_space', space_size: stats.total_heap_size / 8, space_used_size: stats.used_heap_size / 8, space_available_size: 0, physical_space_size: 0 },
  ];
}

export function getHeapCodeStatistics(): { code_and_metadata_size: number; bytecode_and_metadata_size: number; external_script_source_size: number; cpu_profiler_metadata_size: number } {
  return {
    code_and_metadata_size: 0,
    bytecode_and_metadata_size: 0,
    external_script_source_size: 0,
    cpu_profiler_metadata_size: 0,
  };
}

export function getHeapSnapshot(): { read(): string } {
  return {
    read() { return JSON.stringify(getHeapStatistics()); },
  };
}

export function cachedDataVersionTag(): number {
  return 0;
}

export function writeHeapSnapshot(_filename?: string): never {
  throw Object.assign(
    new Error('writeHeapSnapshot is not supported in browser environment. V8 heap snapshots require native V8 API access.'),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

export function setFlagsFromString(_flags: string): void {
  // No-op — cannot set V8 flags in browser
}

export class Serializer {
  private _parts: any[] = [];
  writeHeader(): void { /* no-op */ }
  writeValue(val: any): boolean { this._parts.push(val); return true; }
  releaseBuffer(): Uint8Array { return serialize(this._parts.length === 1 ? this._parts[0] : this._parts); }
  writeUint32(value: number): void { this._parts.push(value); }
  writeUint64(hi: number, lo: number): void { this._parts.push([hi, lo]); }
  writeDouble(value: number): void { this._parts.push(value); }
  writeRawBytes(buffer: Uint8Array): void { this._parts.push(Array.from(buffer)); }
}

export class Deserializer {
  private _data: any;
  private _pos = 0;
  constructor(buffer: Uint8Array | ArrayBuffer) { this._data = deserialize(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)); }
  readHeader(): boolean { return true; }
  readValue(): any { return this._data; }
  readUint32(): number { return typeof this._data === 'number' ? this._data : 0; }
  readUint64(): [number, number] { return Array.isArray(this._data) ? this._data as [number, number] : [0, 0]; }
  readDouble(): number { return typeof this._data === 'number' ? this._data : 0; }
  readRawBytes(length: number): Uint8Array { void length; return new Uint8Array(0); }
}

export class DefaultSerializer extends Serializer {}
export class DefaultDeserializer extends Deserializer {}

export function takeCoverage(): void {
  // No-op
}

export function stopCoverage(): void {
  // No-op
}

const v8 = {
  serialize, deserialize,
  getHeapStatistics, getHeapSpaceStatistics, getHeapCodeStatistics, getHeapSnapshot,
  cachedDataVersionTag, writeHeapSnapshot, setFlagsFromString,
  Serializer, Deserializer, DefaultSerializer, DefaultDeserializer,
  takeCoverage, stopCoverage,
  __atua,
};
export default v8;
