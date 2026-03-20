/**
 * Primordials polyfill for vendored Node.js code.
 *
 * Captures built-in methods at load time to protect against prototype
 * pollution. Node's internal code uses primordials.ArrayPrototypeSlice etc.
 * instead of Array.prototype.slice to avoid being affected by user code
 * that modifies prototypes.
 */

const {
  Array: ArrayConstructor,
  ArrayBuffer: ArrayBufferConstructor,
  BigInt: BigIntConstructor,
  Boolean: BooleanConstructor,
  Date: DateConstructor,
  Error: ErrorConstructor,
  Function: FunctionConstructor,
  JSON: JSONObject,
  Map: MapConstructor,
  Math: MathObject,
  Number: NumberConstructor,
  Object: ObjectConstructor,
  Promise: PromiseConstructor,
  Proxy: ProxyConstructor,
  Reflect: ReflectObject,
  RegExp: RegExpConstructor,
  Set: SetConstructor,
  String: StringConstructor,
  Symbol: SymbolConstructor,
  TypeError: TypeErrorConstructor,
  RangeError: RangeErrorConstructor,
  Uint8Array: Uint8ArrayConstructor,
  WeakMap: WeakMapConstructor,
  WeakSet: WeakSetConstructor,
} = globalThis;

// Array
export const ArrayFrom = ArrayConstructor.from.bind(ArrayConstructor);
export const ArrayIsArray = ArrayConstructor.isArray.bind(ArrayConstructor);
export const ArrayPrototypeFilter = Function.prototype.call.bind(Array.prototype.filter);
export const ArrayPrototypeForEach = Function.prototype.call.bind(Array.prototype.forEach);
export const ArrayPrototypeIncludes = Function.prototype.call.bind(Array.prototype.includes);
export const ArrayPrototypeIndexOf = Function.prototype.call.bind(Array.prototype.indexOf);
export const ArrayPrototypeJoin = Function.prototype.call.bind(Array.prototype.join);
export const ArrayPrototypeMap = Function.prototype.call.bind(Array.prototype.map);
export const ArrayPrototypePush = Function.prototype.call.bind(Array.prototype.push);
export const ArrayPrototypePushApply = Function.prototype.apply.bind(Array.prototype.push);
export const ArrayPrototypeSlice = Function.prototype.call.bind(Array.prototype.slice);
export const ArrayPrototypeSplice = Function.prototype.call.bind(Array.prototype.splice);
export const ArrayPrototypeSort = Function.prototype.call.bind(Array.prototype.sort);
export const ArrayPrototypeUnshift = Function.prototype.call.bind(Array.prototype.unshift);

// Boolean
export const BooleanPrototypeValueOf = Function.prototype.call.bind(Boolean.prototype.valueOf);

// Error
export const ErrorCaptureStackTrace = ErrorConstructor.captureStackTrace?.bind(ErrorConstructor) ??
  ((obj: any) => { obj.stack = new ErrorConstructor().stack; });

// Function
export const FunctionPrototypeBind = Function.prototype.call.bind(Function.prototype.bind);
export const FunctionPrototypeCall = Function.prototype.call.bind(Function.prototype.call);

// JSON
export const JSONParse = JSONObject.parse.bind(JSONObject);
export const JSONStringify = JSONObject.stringify.bind(JSONObject);

// Map
export const MapPrototypeGet = Function.prototype.call.bind(Map.prototype.get);
export const MapPrototypeSet = Function.prototype.call.bind(Map.prototype.set);
export const MapPrototypeHas = Function.prototype.call.bind(Map.prototype.has);
export const MapPrototypeDelete = Function.prototype.call.bind(Map.prototype.delete);
export const MapPrototypeEntries = Function.prototype.call.bind(Map.prototype.entries);
export const MapPrototypeForEach = Function.prototype.call.bind(Map.prototype.forEach);

// Math
export const MathMax = MathObject.max;
export const MathMin = MathObject.min;
export const MathFloor = MathObject.floor;
export const MathTrunc = MathObject.trunc;

// Number
export const NumberIsFinite = NumberConstructor.isFinite;
export const NumberIsInteger = NumberConstructor.isInteger;
export const NumberIsNaN = NumberConstructor.isNaN;
export const NumberParseInt = NumberConstructor.parseInt;
export const NumberMAX_SAFE_INTEGER = NumberConstructor.MAX_SAFE_INTEGER;

// Object
export const ObjectAssign = ObjectConstructor.assign;
export const ObjectCreate = ObjectConstructor.create;
export const ObjectDefineProperty = ObjectConstructor.defineProperty;
export const ObjectDefineProperties = ObjectConstructor.defineProperties;
export const ObjectEntries = ObjectConstructor.entries;
export const ObjectFreeze = ObjectConstructor.freeze;
export const ObjectGetOwnPropertyDescriptor = ObjectConstructor.getOwnPropertyDescriptor;
export const ObjectGetPrototypeOf = ObjectConstructor.getPrototypeOf;
export const ObjectHasOwn = ObjectConstructor.hasOwn ?? ((obj: any, key: any) => Object.prototype.hasOwnProperty.call(obj, key));
export const ObjectKeys = ObjectConstructor.keys;
export const ObjectSetPrototypeOf = ObjectConstructor.setPrototypeOf;
export const ObjectValues = ObjectConstructor.values;
export const ObjectPrototypeHasOwnProperty = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

// Promise
export const PromiseAll = PromiseConstructor.all.bind(PromiseConstructor);
export const PromiseReject = PromiseConstructor.reject.bind(PromiseConstructor);
export const PromiseResolve = PromiseConstructor.resolve.bind(PromiseConstructor);
export const PromisePrototypeThen = Function.prototype.call.bind(Promise.prototype.then);
export const PromisePrototypeCatch = Function.prototype.call.bind(Promise.prototype.catch);

// Reflect
export const ReflectApply = ReflectObject.apply;
export const ReflectOwnKeys = ReflectObject.ownKeys;

// RegExp
export const RegExpPrototypeExec = Function.prototype.call.bind(RegExp.prototype.exec);
export const RegExpPrototypeTest = Function.prototype.call.bind(RegExp.prototype.test);

// String
export const StringFromCharCode = StringConstructor.fromCharCode;
export const StringPrototypeCharCodeAt = Function.prototype.call.bind(String.prototype.charCodeAt);
export const StringPrototypeEndsWith = Function.prototype.call.bind(String.prototype.endsWith);
export const StringPrototypeIncludes = Function.prototype.call.bind(String.prototype.includes);
export const StringPrototypeIndexOf = Function.prototype.call.bind(String.prototype.indexOf);
export const StringPrototypeMatch = Function.prototype.call.bind(String.prototype.match);
export const StringPrototypePadStart = Function.prototype.call.bind(String.prototype.padStart);
export const StringPrototypeRepeat = Function.prototype.call.bind(String.prototype.repeat);
export const StringPrototypeReplace = Function.prototype.call.bind(String.prototype.replace);
export const StringPrototypeSlice = Function.prototype.call.bind(String.prototype.slice);
export const StringPrototypeSplit = Function.prototype.call.bind(String.prototype.split);
export const StringPrototypeStartsWith = Function.prototype.call.bind(String.prototype.startsWith);
export const StringPrototypeToLowerCase = Function.prototype.call.bind(String.prototype.toLowerCase);
export const StringPrototypeToUpperCase = Function.prototype.call.bind(String.prototype.toUpperCase);
export const StringPrototypeTrim = Function.prototype.call.bind(String.prototype.trim);

// Symbol
export const SymbolFor = SymbolConstructor.for;
export const SymbolHasInstance = SymbolConstructor.hasInstance;
export const SymbolIterator = SymbolConstructor.iterator;
export const SymbolAsyncIterator = SymbolConstructor.asyncIterator;
export const SymbolToPrimitive = SymbolConstructor.toPrimitive;
export const SymbolToStringTag = SymbolConstructor.toStringTag;

// TypedArray
export const TypedArrayPrototypeSet = Function.prototype.call.bind(Uint8Array.prototype.set);

// Safe collections (prevent prototype pollution on Map/Set)
export class SafeMap<K, V> extends Map<K, V> {}
export class SafeSet<T> extends Set<T> {}
export class SafeWeakMap<K extends WeakKey, V> extends WeakMap<K, V> {}
export class SafeWeakSet<T extends WeakKey> extends WeakSet<T> {}

// Iterable helpers
export function SafeArrayIterator<T>(arr: T[]): IterableIterator<T> {
  return arr[Symbol.iterator]();
}

// Freeze the exports to prevent mutation
ObjectFreeze(SafeMap.prototype);
ObjectFreeze(SafeSet.prototype);
ObjectFreeze(SafeWeakMap.prototype);
ObjectFreeze(SafeWeakSet.prototype);
