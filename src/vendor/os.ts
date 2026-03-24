/**
 * Node.js os module facade.
 *
 * Reports as Linux x64 for compatibility with Node.js packages.
 * Memory values come from libuv.wasm when available.
 */
export const __atua = true;

import { internalBinding } from './internal-binding.js';

const binding = internalBinding('os') as {
  type(): string;
  platform(): string;
  arch(): string;
  release(): string;
  hostname(): string;
  homedir(): string;
  tmpdir(): string;
  endianness(): string;
  cpus(): Array<{ model: string; speed: number; times: Record<string, number> }>;
  totalmem(): number;
  freemem(): number;
  uptime(): number;
  loadavg(): number[];
  networkInterfaces(): Record<string, unknown>;
  EOL: string;
  constants: { signals: Record<string, number>; errno: Record<string, number> };
};

export const EOL = '\n';

export function type() { return binding.type(); }
export function platform() { return binding.platform(); }
export function arch() { return binding.arch(); }
export function release() { return binding.release(); }
export function hostname() { return binding.hostname(); }
export function homedir() { return binding.homedir(); }
export function tmpdir() { return binding.tmpdir(); }
export function endianness() { return binding.endianness(); }
export function cpus() { return binding.cpus(); }
export function totalmem() { return binding.totalmem(); }
export function freemem() { return binding.freemem(); }
export function uptime() { return binding.uptime(); }
export function loadavg() { return binding.loadavg(); }
export function networkInterfaces() { return binding.networkInterfaces(); }

export function userInfo() {
  return {
    uid: 1000,
    gid: 1000,
    username: 'user',
    homedir: homedir(),
    shell: '/bin/sh',
  };
}

export function machine() { return 'x86_64'; }

export const constants = binding.constants;

export const devNull = '/dev/null';
export function availableParallelism(): number { return (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 1; }

export default {
  EOL, type, platform, arch, release, hostname, homedir, tmpdir,
  endianness, cpus, totalmem, freemem, uptime, loadavg,
  networkInterfaces, userInfo, machine, constants, devNull,
  availableParallelism,
};
