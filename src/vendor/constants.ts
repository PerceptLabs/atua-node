/**
 * Node.js constants module — re-exports from fs and os constants.
 *
 * This is the deprecated top-level `require('constants')` module
 * which merges fs.constants and os.constants.
 */
export const __atua = true;

import { constants as fsConstants } from './fs.js';
import { constants as osConstants } from './os.js';

// fs constants (O_RDONLY, S_IFMT, etc.)
const fs = fsConstants ?? {};
for (const [key, value] of Object.entries(fs)) {
  (exports as any)[key] = value;
}

// os.constants.signals (SIGINT, SIGTERM, etc.)
const signals = (osConstants as any)?.signals ?? {};
for (const [key, value] of Object.entries(signals)) {
  (exports as any)[key] = value;
}

// os.constants.errno (ENOENT, EACCES, etc.)
const errno = (osConstants as any)?.errno ?? {};
for (const [key, value] of Object.entries(errno)) {
  (exports as any)[key] = value;
}

// Re-export merged object as default
const allConstants = { ...fs, ...signals, ...errno };
export default allConstants;
