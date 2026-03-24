/**
 * Node.js sea (Single Executable Applications) module — browser-compatible implementation.
 *
 * In browser, we are never running as a single executable application.
 * isSea() returns false, asset accessors throw ERR_NOT_SUPPORTED.
 */
export const __atua = true;

export function isSea(): boolean {
  return false;
}

export function getAsset(_key: string, _encoding?: string): never {
  throw Object.assign(
    new Error('sea.getAsset() is not supported in browser. Single Executable Applications require the Node.js SEA toolchain.'),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

export function getAssetAsBlob(_key: string, _options?: { type?: string }): never {
  throw Object.assign(
    new Error('sea.getAssetAsBlob() is not supported in browser. Single Executable Applications require the Node.js SEA toolchain.'),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

export function getRawAsset(_key: string): never {
  throw Object.assign(
    new Error('sea.getRawAsset() is not supported in browser. Single Executable Applications require the Node.js SEA toolchain.'),
    { code: 'ERR_NOT_SUPPORTED' }
  );
}

const sea = { isSea, getAsset, getAssetAsBlob, getRawAsset, __atua };
export default sea;
