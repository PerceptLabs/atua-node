/**
 * Node.js dns module facade.
 *
 * Routes DNS resolution through the browser's built-in resolution
 * (via fetch/URL) since WASI has no DNS syscalls.
 */
export const __atua = true;

export interface LookupAddress {
  address: string;
  family: number;
}

export function lookup(
  hostname: string,
  callback: (err: Error | null, address: string, family: number) => void
): void;
export function lookup(
  hostname: string,
  options: { family?: number; all?: boolean },
  callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void
): void;
export function lookup(hostname: string, ...args: any[]): void {
  const callback = args[args.length - 1] as Function;
  const options = args.length > 1 ? args[0] : {};

  // Use browser's DNS resolution via URL parsing
  queueMicrotask(() => {
    try {
      // Check if it's already an IP
      if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        if (options?.all) {
          callback(null, [{ address: hostname, family: 4 }]);
        } else {
          callback(null, hostname, 4);
        }
        return;
      }

      // For non-IP hostnames, return the hostname itself
      // (browser handles DNS during fetch/connect)
      if (options?.all) {
        callback(null, [{ address: hostname, family: 4 }]);
      } else {
        callback(null, hostname, 4);
      }
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)), '', 0);
    }
  });
}

export function resolve(hostname: string, callback: (err: Error | null, addresses: string[]) => void): void {
  lookup(hostname, (err, address) => {
    if (err) callback(err, []);
    else callback(null, [address as string]);
  });
}

export function resolve4(hostname: string, callback: (err: Error | null, addresses: string[]) => void): void {
  resolve(hostname, callback);
}

export function resolve6(hostname: string, callback: (err: Error | null, addresses: string[]) => void): void {
  callback(null, []);
}

export function reverse(ip: string, callback: (err: Error | null, hostnames: string[]) => void): void {
  callback(null, [ip]);
}

export function getServers(): string[] {
  return ['8.8.8.8', '8.8.4.4'];
}

export function setServers(_servers: string[]): void {
  // Browser handles DNS — this is a no-op
}

// Promises API
export const promises = {
  lookup: (hostname: string, options?: any) =>
    new Promise<LookupAddress>((resolve, reject) => {
      lookup(hostname, options ?? {}, (err: any, address: any, family: any) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    }),
  resolve: (hostname: string) =>
    new Promise<string[]>((resolve, reject) => {
      dns_resolve(hostname, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    }),
};

const dns_resolve = resolve;

export default { lookup, resolve, resolve4, resolve6, reverse, getServers, setServers, promises };
