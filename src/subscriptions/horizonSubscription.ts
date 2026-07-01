/**
 * horizonSubscription.ts
 *
 * Wraps the Stellar Horizon Server-Sent Events (SSE) streams for ledgers
 * and account transactions. Provides a simple callback-based interface with
 * automatic reconnection on connection drops.
 *
 * Uses Node's built-in `http`/`https` module so no external dependencies are
 * required beyond what the project already ships with.
 */

import * as http from 'http';
import * as https from 'https';
import { NetworkConfig, NETWORKS, DEFAULT_NETWORK, NetworkName } from '../config/networks';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw ledger record returned by Horizon SSE. */
export interface LedgerRecord {
  id: string;
  paging_token: string;
  hash: string;
  sequence: number;
  transaction_count: number;
  operation_count: number;
  closed_at: string;
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
}

/** Raw transaction record returned by Horizon SSE. */
export interface TransactionRecord {
  id: string;
  paging_token: string;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_charged: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  successful: boolean;
}

/** Callback fired for each new ledger received over the SSE stream. */
export type LedgerCallback = (ledger: LedgerRecord) => void;

/** Callback fired for each new transaction received over the SSE stream. */
export type TransactionCallback = (transaction: TransactionRecord) => void;

/**
 * Options shared by both subscription helpers.
 */
export interface SubscriptionOptions {
  /** Horizon base URL.  Defaults to mainnet. */
  horizonUrl?: string;
  /**
   * Base delay (ms) before the first reconnect attempt (error closes only).
   * The delay doubles on every consecutive failure (exponential back-off).
   * Defaults to 1 000 ms.
   */
  reconnectDelay?: number;
  /**
   * Maximum reconnect delay (ms).  Defaults to 30 000 ms.
   */
  maxReconnectDelay?: number;
  /**
   * Maximum number of reconnect attempts (error closes only) before giving up.
   * Use `Infinity` (the default) to reconnect forever.
   */
  maxReconnectAttempts?: number;
  /**
   * Network name shorthand.  If provided, `horizonUrl` is derived from
   * the built-in network registry and the explicit `horizonUrl` is ignored.
   */
  network?: NetworkName;
}

/**
 * Handle returned by every `subscribe*` function.
 * Call `.unsubscribe()` to stop the stream and prevent further reconnects.
 */
export interface SubscriptionHandle {
  /** Stop the stream immediately and cancel any pending reconnect. */
  unsubscribe(): void;
}

/**
 * Injectable transport factory.
 * Given a URL + callbacks, opens a connection and returns a teardown fn.
 * @internal exported for unit testing only
 */
export type OpenConnectionFn = (
  url: string,
  onEvent: (record: Record<string, unknown>) => void,
  onClose: (err?: Error) => void,
) => () => void;

// ─── SSE line parser ──────────────────────────────────────────────────────────

/**
 * Parse a single SSE `data:` line and return the payload object, or `null`
 * when the line should be ignored (comment, keepalive, empty, invalid JSON).
 *
 * @internal exported for unit testing only
 */
export function parseSseLine(line: string): Record<string, unknown> | null {
  if (!line.startsWith('data:')) return null;
  const json = line.slice('data:'.length).trim();
  if (!json || json === 'hello' || json === '"hello"') return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Fake-friendly SSE response handler ──────────────────────────────────────

/**
 * Wire up SSE event parsing on an already-received IncomingMessage-like object.
 * Extracted so unit tests can drive it with a fake readable emitter.
 *
 * @internal exported for unit testing only
 */
export function handleSseResponse(
  res: { statusCode?: number; setEncoding?: (enc: string) => void; resume?: () => void; on(event: string, cb: (...args: any[]) => void): void },
  url: string,
  onEvent: (record: Record<string, unknown>) => void,
  onClose: (err?: Error) => void,
  isAborted: () => boolean,
): void {
  if (res.statusCode !== 200) {
    onClose(new Error(`HTTP ${res.statusCode ?? 'unknown'} from ${url}`));
    if (res.resume) res.resume();
    return;
  }

  if (res.setEncoding) res.setEncoding('utf8');
  let buffer = '';

  res.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const record = parseSseLine(line.trim());
      if (record) onEvent(record);
    }
  });

  res.on('end', () => {
    if (!isAborted()) onClose();
  });

  res.on('error', (err: Error) => {
    if (!isAborted()) onClose(err);
  });
}

// ─── Real HTTP transport (uses Node http/https) ───────────────────────────────

/**
 * Open a single SSE HTTP(S) connection and feed events to the callbacks.
 * Returns a teardown function that destroys the request.
 *
 * @internal exported for unit testing only
 */
export function openSseConnection(
  url: string,
  onEvent: (record: Record<string, unknown>) => void,
  onClose: (err?: Error) => void,
): () => void {
  const transport = url.startsWith('https') ? https : http;
  const parsedUrl = new URL(url);

  const options: http.RequestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (url.startsWith('https') ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      'User-Agent': 'ChainScope-SSE/1.0',
    },
  };

  let aborted = false;
  const req = transport.request(options, (res) => {
    handleSseResponse(res, url, onEvent, onClose, () => aborted);
  });

  req.on('error', (err) => {
    if (!aborted) onClose(err);
  });

  req.end();

  return () => {
    aborted = true;
    req.destroy();
  };
}

// ─── Reconnecting subscription state machine ──────────────────────────────────

/**
 * Core reconnecting SSE subscriber.
 *
 * Opens a connection via `openConnection`, feeds each event through `onEvent`,
 * and automatically reconnects (with exponential back-off) if the connection
 * drops due to an error.  A clean server-side close also triggers an immediate
 * reconnect.
 *
 * @internal exported for unit testing only (allows transport injection)
 */
export function createReconnectingSubscription(
  url: string,
  onEvent: (record: Record<string, unknown>) => void,
  options: Required<Omit<SubscriptionOptions, 'horizonUrl' | 'network'>>,
  openConnection: OpenConnectionFn = openSseConnection,
): SubscriptionHandle {
  let attempts = 0;
  let currentDelay = options.reconnectDelay;
  let abortCurrent: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function connect() {
    if (stopped) return;

    abortCurrent = openConnection(
      url,
      (record) => {
        attempts = 0;
        currentDelay = options.reconnectDelay;
        onEvent(record);
      },
      (err?: Error) => {
        abortCurrent = null;
        if (stopped) return;
        if (err) {
          attempts += 1;
          if (attempts > options.maxReconnectAttempts) return;
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, currentDelay);
          currentDelay = Math.min(currentDelay * 2, options.maxReconnectDelay);
        } else {
          connect();
        }
      },
    );
  }

  connect();

  return {
    unsubscribe() {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (abortCurrent) {
        abortCurrent();
        abortCurrent = null;
      }
    },
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveHorizonUrl(options: SubscriptionOptions): string {
  if (options.network) {
    const cfg: NetworkConfig = NETWORKS[options.network];
    if (!cfg) {
      throw new Error(
        `Unknown network "${options.network}". Valid values: ${Object.keys(NETWORKS).join(', ')}`,
      );
    }
    return cfg.horizonUrl;
  }
  return options.horizonUrl ?? NETWORKS[DEFAULT_NETWORK].horizonUrl;
}

function withDefaults(
  options: SubscriptionOptions,
): Required<Omit<SubscriptionOptions, 'horizonUrl' | 'network'>> {
  return {
    reconnectDelay: options.reconnectDelay ?? 1_000,
    maxReconnectDelay: options.maxReconnectDelay ?? 30_000,
    maxReconnectAttempts: options.maxReconnectAttempts ?? Infinity,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Subscribe to new Stellar ledgers via the Horizon SSE stream.
 *
 * @example
 * ```ts
 * const handle = subscribeToLedgers((ledger) => {
 *   console.log('New ledger:', ledger.sequence);
 * });
 * handle.unsubscribe();
 * ```
 */
export function subscribeToLedgers(
  callback: LedgerCallback,
  options: SubscriptionOptions = {},
  /** @internal for testing only */ _transport?: OpenConnectionFn,
): SubscriptionHandle {
  const baseUrl = resolveHorizonUrl(options);
  const url = `${baseUrl}/ledgers?cursor=now`;
  const resolved = withDefaults(options);
  return createReconnectingSubscription(
    url,
    (record) => callback(record as unknown as LedgerRecord),
    resolved,
    _transport,
  );
}

/**
 * Subscribe to new transactions for a specific Stellar account via the
 * Horizon SSE stream.
 *
 * @example
 * ```ts
 * const handle = subscribeToTransactions(accountId, (tx) => {
 *   console.log('New tx:', tx.hash);
 * });
 * handle.unsubscribe();
 * ```
 */
export function subscribeToTransactions(
  accountId: string,
  callback: TransactionCallback,
  options: SubscriptionOptions = {},
  /** @internal for testing only */ _transport?: OpenConnectionFn,
): SubscriptionHandle {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('subscribeToTransactions: accountId must be a non-empty string');
  }
  const baseUrl = resolveHorizonUrl(options);
  const url = `${baseUrl}/accounts/${encodeURIComponent(accountId)}/transactions?cursor=now`;
  const resolved = withDefaults(options);
  return createReconnectingSubscription(
    url,
    (record) => callback(record as unknown as TransactionRecord),
    resolved,
    _transport,
  );
}
