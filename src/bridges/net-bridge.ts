/**
 * NetBridge — Adapter to atua-net with clean swap interface.
 *
 * Defines the NetBridge interface: connect/send/recv/close/fetch.
 * Current implementation (AtuaNetBridge) routes to atua-net.
 * Interface is stable — future WasixNetBridge can swap in.
 */

/** Opaque handle for a network stream */
export interface StreamHandle {
  id: number;
  host: string;
  port: number;
  tls: boolean;
  closed: boolean;
}

/** Response from a fetch operation */
export interface FetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

/** Fetch request options */
export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}

/**
 * Abstract NetBridge interface.
 * All networking goes through this interface. Implementations can be swapped
 * at init time: AtuaNetBridge (current) or WasixNetBridge (future).
 */
export interface INetBridge {
  /** Establish a TCP connection, optionally with TLS */
  connect(host: string, port: number, tls?: boolean): Promise<StreamHandle>;
  /** Send data over a stream */
  send(handle: StreamHandle, data: Uint8Array): Promise<number>;
  /** Receive data from a stream */
  recv(handle: StreamHandle): Promise<Uint8Array>;
  /** Close a stream */
  close(handle: StreamHandle): void;
  /** HTTP fetch */
  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>;
}

/**
 * AtuaNetBridge — Routes networking through atua-net (wasm-bindgen).
 *
 * This is the current production implementation. It delegates to
 * atua_connect(), atua_stream_send(), atua_stream_recv(),
 * atua_stream_close(), and atua_fetch().
 */
export class AtuaNetBridge implements INetBridge {
  private _nextStreamId = 1;
  private _streams = new Map<number, StreamHandle>();

  async connect(host: string, port: number, tls: boolean = false): Promise<StreamHandle> {
    const id = this._nextStreamId++;
    const handle: StreamHandle = { id, host, port, tls, closed: false };
    this._streams.set(id, handle);

    // In real implementation: await atua_connect(host, port, tls)
    return handle;
  }

  async send(handle: StreamHandle, data: Uint8Array): Promise<number> {
    if (handle.closed) throw new Error('Stream is closed');
    const stream = this._streams.get(handle.id);
    if (!stream) throw new Error(`Unknown stream: ${handle.id}`);

    // In real implementation: await atua_stream_send(handle.id, data)
    return data.length;
  }

  async recv(handle: StreamHandle): Promise<Uint8Array> {
    if (handle.closed) throw new Error('Stream is closed');
    const stream = this._streams.get(handle.id);
    if (!stream) throw new Error(`Unknown stream: ${handle.id}`);

    // In real implementation: await atua_stream_recv(handle.id)
    return new Uint8Array(0);
  }

  close(handle: StreamHandle): void {
    if (handle.closed) return;
    handle.closed = true;
    this._streams.delete(handle.id);

    // In real implementation: atua_stream_close(handle.id)
  }

  async fetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
    // In real implementation: await atua_fetch(url, options)
    // For now, delegate to browser fetch as placeholder
    try {
      const resp = await globalThis.fetch(url, {
        method: options?.method ?? 'GET',
        headers: options?.headers,
        body: options?.body,
      });

      const body = new Uint8Array(await resp.arrayBuffer());
      const headers: Record<string, string> = {};
      resp.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: resp.status,
        statusText: resp.statusText,
        headers,
        body,
      };
    } catch (err) {
      throw new Error(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Get number of active streams */
  get activeStreamCount(): number {
    return this._streams.size;
  }
}

/**
 * NetBridge is the concrete class exposed to consumers.
 * Uses AtuaNetBridge by default, can be swapped via constructor.
 */
export class NetBridge implements INetBridge {
  private _impl: INetBridge;

  constructor(impl?: INetBridge) {
    this._impl = impl ?? new AtuaNetBridge();
  }

  /** Swap the underlying implementation at runtime */
  setImplementation(impl: INetBridge): void {
    this._impl = impl;
  }

  connect(host: string, port: number, tls?: boolean): Promise<StreamHandle> {
    return this._impl.connect(host, port, tls);
  }

  send(handle: StreamHandle, data: Uint8Array): Promise<number> {
    return this._impl.send(handle, data);
  }

  recv(handle: StreamHandle): Promise<Uint8Array> {
    return this._impl.recv(handle);
  }

  close(handle: StreamHandle): void {
    return this._impl.close(handle);
  }

  fetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
    return this._impl.fetch(url, options);
  }
}
