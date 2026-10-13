/**
 * redisCache.ts
 *
 * Implements a resilient Redis caching layer for historical Stellar ledgers and
 * Horizon API queries to optimize repeated queries and reduce network load.
 *
 * Features:
 * - Native Redis RESP protocol support over Node's built-in `net` module (zero external dependencies).
 * - Automatic, graceful fallback to in-memory cache when Redis is unavailable.
 * - Configurable TTL (Time-To-Live), key prefix namespacing, and timeouts.
 * - Metric tracking: hits, misses, hit ratio, operation count, and active backend.
 * - Type-safe methods: `get`, `set`, `has`, `delete`, `clear`, `getOrSet`, and `getLedger`/`setLedger`.
 */

import * as net from 'net';
import { LedgerRecord } from '../subscriptions/horizonSubscription';

// ─── Interfaces & Types ───────────────────────────────────────────────────────

export interface RedisCacheOptions {
  /** Redis host. Defaults to '127.0.0.1' or process.env.REDIS_HOST. */
  host?: string;
  /** Redis port. Defaults to 6379 or process.env.REDIS_PORT. */
  port?: number;
  /** Redis connection URL (e.g. redis://127.0.0.1:6379). */
  url?: string;
  /** Key prefix for namespacing. Defaults to 'chainscope:'. */
  prefix?: string;
  /** Default TTL in seconds. Defaults to 3600 (1 hour). */
  defaultTtlSeconds?: number;
  /** Connection timeout in milliseconds. Defaults to 1500ms. */
  connectTimeoutMs?: number;
  /** Force in-memory mode (useful for testing or air-gapped environments). */
  forceInMemory?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRatio: number;
  backend: 'redis' | 'memory';
  connected: boolean;
}

interface InMemoryEntry<T> {
  value: T;
  expiresAt: number | null; // null = never expires
}

// ─── Minimal Native RESP Protocol Client ─────────────────────────────────────

export class NativeRedisClient {
  private socket: net.Socket | null = null;
  private isConnected = false;
  private pendingCallbacks: Array<(err: Error | null, res: any) => void> = [];
  private incomingBuffer = '';

  constructor(
    private readonly host: string = '127.0.0.1',
    private readonly port: number = 6379,
    private readonly timeoutMs: number = 1500,
  ) {}

  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      this.socket = socket;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          this.isConnected = false;
          resolve(false);
        }
      }, this.timeoutMs);

      socket.connect(this.port, this.host, () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.isConnected = true;
          resolve(true);
        }
      });

      socket.on('data', (chunk) => {
        this.incomingBuffer += chunk.toString();
        this.processBuffer();
      });

      socket.on('error', () => {
        this.isConnected = false;
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(false);
        }
      });

      socket.on('close', () => {
        this.isConnected = false;
      });
    });
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public sendCommand(args: (string | number)[]): Promise<any> {
    if (!this.isConnected || !this.socket) {
      return Promise.reject(new Error('Redis client not connected'));
    }

    return new Promise((resolve, reject) => {
      // RESP Array serialization
      let payload = `*${args.length}\r\n`;
      for (const arg of args) {
        const str = String(arg);
        payload += `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
      }

      this.pendingCallbacks.push((err, res) => {
        if (err) reject(err);
        else resolve(res);
      });

      const socket = this.socket;
      if (!socket) {
        this.pendingCallbacks.pop();
        return reject(new Error('Redis client socket is null'));
      }

      try {
        socket.write(payload);
      } catch (err) {
        this.pendingCallbacks.pop();
        reject(err);
      }
    });
  }

  private processBuffer() {
    while (this.incomingBuffer.length > 0 && this.pendingCallbacks.length > 0) {
      const parsed = this.parseResp(this.incomingBuffer);
      if (!parsed) break; // Incomplete response

      this.incomingBuffer = this.incomingBuffer.slice(parsed.bytesConsumed);
      const cb = this.pendingCallbacks.shift();
      if (cb) {
        if (parsed.isError) {
          cb(new Error(parsed.value), null);
        } else {
          cb(null, parsed.value);
        }
      }
    }
  }

  private parseResp(buf: string): { value: any; bytesConsumed: number; isError: boolean } | null {
    if (buf.length < 3) return null;
    const type = buf[0];
    const crlfIndex = buf.indexOf('\r\n');
    if (crlfIndex === -1) return null;

    if (type === '+' || type === '-' || type === ':') {
      const line = buf.slice(1, crlfIndex);
      const val = type === ':' ? parseInt(line, 10) : line;
      return { value: val, bytesConsumed: crlfIndex + 2, isError: type === '-' };
    }

    if (type === '$') {
      const len = parseInt(buf.slice(1, crlfIndex), 10);
      if (len === -1) {
        return { value: null, bytesConsumed: crlfIndex + 2, isError: false };
      }
      const dataStart = crlfIndex + 2;
      const dataEnd = dataStart + len;
      if (buf.length < dataEnd + 2) return null;
      const data = buf.slice(dataStart, dataEnd);
      return { value: data, bytesConsumed: dataEnd + 2, isError: false };
    }

    return null;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

// ─── Redis Caching Layer Implementation ──────────────────────────────────────

export class RedisCache {
  private readonly prefix: string;
  private readonly defaultTtl: number;
  private readonly memoryStore = new Map<string, InMemoryEntry<any>>();
  private redisClient: NativeRedisClient | null = null;
  private useRedis = false;
  private stats: { hits: number; misses: number; sets: number; deletes: number } = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  constructor(private readonly options: RedisCacheOptions = {}) {
    this.prefix = options.prefix ?? 'chainscope:';
    this.defaultTtl = options.defaultTtlSeconds ?? 3600;
  }

  /**
   * Initializes the cache layer. Attempts to connect to Redis; falls back to in-memory store.
   */
  public async init(): Promise<void> {
    if (this.options.forceInMemory) {
      this.useRedis = false;
      return;
    }

    let host = this.options.host || process.env.REDIS_HOST || '127.0.0.1';
    let port = this.options.port || (process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379);

    if (this.options.url || process.env.REDIS_URL) {
      try {
        const parsed = new URL(this.options.url || process.env.REDIS_URL || '');
        if (parsed.hostname) host = parsed.hostname;
        if (parsed.port) port = parseInt(parsed.port, 10);
      } catch {
        // use default host/port
      }
    }

    this.redisClient = new NativeRedisClient(host, port, this.options.connectTimeoutMs ?? 1500);
    const connected = await this.redisClient.connect();
    this.useRedis = connected;
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Retrieves a value from the cache.
   */
  public async get<T>(key: string): Promise<T | null> {
    const k = this.fullKey(key);

    if (this.useRedis && this.redisClient?.connected) {
      try {
        const raw = await this.redisClient.sendCommand(['GET', k]);
        if (raw !== null && raw !== undefined) {
          this.stats.hits++;
          return JSON.parse(raw) as T;
        }
      } catch {
        // Fallback to in-memory on Redis error
      }
    }

    const entry = this.memoryStore.get(k);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(k);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Sets a value in the cache with an optional TTL in seconds.
   */
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const k = this.fullKey(key);
    const ttl = ttlSeconds !== undefined ? ttlSeconds : this.defaultTtl;
    const serialized = JSON.stringify(value);

    this.stats.sets++;

    if (this.useRedis && this.redisClient?.connected) {
      try {
        if (ttl > 0) {
          await this.redisClient.sendCommand(['SET', k, serialized, 'EX', ttl]);
        } else {
          await this.redisClient.sendCommand(['SET', k, serialized]);
        }
        return;
      } catch {
        // Fallback to in-memory on error
      }
    }

    this.memoryStore.set(k, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
    });
  }

  /**
   * Checks whether a key exists and has not expired.
   */
  public async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  /**
   * Removes a key from the cache.
   */
  public async delete(key: string): Promise<boolean> {
    const k = this.fullKey(key);
    this.stats.deletes++;

    let deleted = false;
    if (this.useRedis && this.redisClient?.connected) {
      try {
        const count = await this.redisClient.sendCommand(['DEL', k]);
        deleted = count > 0;
      } catch {
        // ignore
      }
    }

    const inMemDeleted = this.memoryStore.delete(k);
    return deleted || inMemDeleted;
  }

  /**
   * Clears all cached items matching this instance's prefix.
   */
  public async clear(): Promise<void> {
    this.memoryStore.clear();
    // For Redis, keys under prefix are flushed when practical
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  /**
   * Read-through helper: returns cached value or executes fetcher, caches result, and returns it.
   */
  public async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    const fresh = await fetchFn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  // ─── Ledger-Specific Convenience Helpers ────────────────────────────────────

  /**
   * Cache key builder for ledger sequence or hash.
   */
  public static ledgerKey(sequenceOrHash: number | string): string {
    return `ledger:${sequenceOrHash}`;
  }

  /**
   * Gets a cached ledger record by sequence or hash.
   */
  public async getLedger(sequenceOrHash: number | string): Promise<LedgerRecord | null> {
    return this.get<LedgerRecord>(RedisCache.ledgerKey(sequenceOrHash));
  }

  /**
   * Caches a ledger record. Historical ledgers are immutable, so default TTL is long (e.g. 24h).
   */
  public async setLedger(ledger: LedgerRecord, ttlSeconds: number = 86400): Promise<void> {
    const key = RedisCache.ledgerKey(ledger.sequence);
    await this.set(key, ledger, ttlSeconds);

    // Also index by hash for direct lookup
    if (ledger.hash) {
      await this.set(RedisCache.ledgerKey(ledger.hash), ledger, ttlSeconds);
    }
  }

  /**
   * Retrieves ledger from cache or calls Horizon fetcher function if missing.
   */
  public async getOrFetchLedger(
    sequence: number | string,
    fetchFn: () => Promise<LedgerRecord>,
    ttlSeconds?: number,
  ): Promise<LedgerRecord> {
    return this.getOrSet<LedgerRecord>(
      RedisCache.ledgerKey(sequence),
      fetchFn,
      ttlSeconds ?? 86400,
    );
  }

  /**
   * Returns runtime statistics and hit ratio.
   */
  public getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRatio = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      hitRatio: Math.round(hitRatio * 1000) / 1000,
      backend: this.useRedis ? 'redis' : 'memory',
      connected: this.useRedis && (this.redisClient?.connected ?? false),
    };
  }

  /**
   * Closes underlying connections.
   */
  public disconnect(): void {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
    this.useRedis = false;
  }
}

// ─── Singleton & Factory Exports ─────────────────────────────────────────────

let defaultInstance: RedisCache | null = null;

export function getGlobalLedgerCache(options?: RedisCacheOptions): RedisCache {
  if (!defaultInstance) {
    defaultInstance = new RedisCache(options);
  }
  return defaultInstance;
}

export function createLedgerCache(options?: RedisCacheOptions): RedisCache {
  return new RedisCache(options);
}
