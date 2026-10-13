import { RedisCache, NativeRedisClient, createLedgerCache } from '../../src/cache/redisCache';
import { LedgerRecord } from '../../src/subscriptions/horizonSubscription';

describe('RedisCache Layer', () => {
  let cache: RedisCache;

  const mockLedger: LedgerRecord = {
    id: 'ledger_123456',
    paging_token: '123456_token',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sequence: 123456,
    transaction_count: 42,
    operation_count: 85,
    closed_at: '2026-10-01T12:00:00Z',
    base_fee_in_stroops: 100,
    base_reserve_in_stroops: 5000000,
  };

  beforeEach(async () => {
    cache = createLedgerCache({
      forceInMemory: true, // test in-memory fallback deterministic path
      prefix: 'test-chainscope:',
      defaultTtlSeconds: 10,
    });
    await cache.init();
  });

  afterEach(() => {
    cache.disconnect();
  });

  describe('Basic Key-Value Operations', () => {
    test('sets and retrieves a primitive value', async () => {
      await cache.set('status', 'synced');
      const val = await cache.get<string>('status');
      expect(val).toBe('synced');
    });

    test('sets and retrieves an object', async () => {
      const payload = { network: 'mainnet', activeValidators: 25 };
      await cache.set('network_info', payload);
      const result = await cache.get<typeof payload>('network_info');
      expect(result).toEqual(payload);
    });

    test('returns null for non-existent key', async () => {
      const val = await cache.get('missing_key');
      expect(val).toBeNull();
    });

    test('has() checks existence correctly', async () => {
      await cache.set('exists_key', 42);
      expect(await cache.has('exists_key')).toBe(true);
      expect(await cache.has('does_not_exist')).toBe(false);
    });

    test('delete() removes existing key', async () => {
      await cache.set('temp', 'value');
      expect(await cache.has('temp')).toBe(true);

      const deleted = await cache.delete('temp');
      expect(deleted).toBe(true);
      expect(await cache.has('temp')).toBe(false);
      expect(await cache.get('temp')).toBeNull();
    });

    test('clear() flushes all entries and resets stats', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.get('a'); // 1 hit

      await cache.clear();

      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toBeNull();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2); // from the 2 post-clear gets
    });
  });

  describe('TTL & Expiration', () => {
    test('respects custom TTL and expires keys', async () => {
      // 1 second TTL
      await cache.set('ephemeral', 'fast', 1);
      expect(await cache.get('ephemeral')).toBe('fast');

      // Wait 1.1s for expiration
      await new Promise((r) => setTimeout(r, 1100));

      expect(await cache.get('ephemeral')).toBeNull();
      expect(await cache.has('ephemeral')).toBe(false);
    });

    test('keys with ttl=0 do not expire', async () => {
      await cache.set('permanent', 'forever', 0);
      expect(await cache.get('permanent')).toBe('forever');
    });
  });

  describe('getOrSet Read-Through Helper', () => {
    test('executes fetcher on cache miss and caches result', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ledgerSeq: 100 });

      const first = await cache.getOrSet('auto_ledger', fetchMock);
      expect(first).toEqual({ ledgerSeq: 100 });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call should return from cache without calling fetcher
      const second = await cache.getOrSet('auto_ledger', fetchMock);
      expect(second).toEqual({ ledgerSeq: 100 });
      expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1!
    });
  });

  describe('Ledger-Specific Caching', () => {
    test('setLedger and getLedger by sequence and hash', async () => {
      await cache.setLedger(mockLedger);

      const bySeq = await cache.getLedger(mockLedger.sequence);
      expect(bySeq).toEqual(mockLedger);

      const byHash = await cache.getLedger(mockLedger.hash);
      expect(byHash).toEqual(mockLedger);
    });

    test('getOrFetchLedger only fetches on cold cache', async () => {
      const fetcher = jest.fn().mockResolvedValue(mockLedger);

      const l1 = await cache.getOrFetchLedger(123456, fetcher);
      expect(l1.sequence).toBe(123456);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Warm cache
      const l2 = await cache.getOrFetchLedger(123456, fetcher);
      expect(l2.sequence).toBe(123456);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Statistics', () => {
    test('computes hits, misses, and hitRatio accurately', async () => {
      await cache.set('k1', 'v1');

      await cache.get('k1'); // hit 1
      await cache.get('k1'); // hit 2
      await cache.get('k2'); // miss 1
      await cache.get('k3'); // miss 2

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.sets).toBe(1);
      expect(stats.hitRatio).toBe(0.5);
      expect(stats.backend).toBe('memory');
      expect(stats.connected).toBe(false);
    });
  });

  describe('NativeRedisClient RESP parser unit tests', () => {
    test('parses simple strings, integers, and bulk strings', () => {
      const client = new NativeRedisClient();
      const parse = (client as any).parseResp.bind(client);

      // Simple string
      expect(parse('+OK\r\n')).toEqual({ value: 'OK', bytesConsumed: 5, isError: false });

      // Integer
      expect(parse(':42\r\n')).toEqual({ value: 42, bytesConsumed: 5, isError: false });

      // Bulk string
      expect(parse('$5\r\nhello\r\n')).toEqual({ value: 'hello', bytesConsumed: 11, isError: false });

      // Null bulk string
      expect(parse('$-1\r\n')).toEqual({ value: null, bytesConsumed: 5, isError: false });

      // Error
      expect(parse('-ERR unknown command\r\n')).toEqual({
        value: 'ERR unknown command',
        bytesConsumed: 22,
        isError: true,
      });

      // Incomplete data
      expect(parse('$10\r\nshort')).toBeNull();
    });

    test('fails gracefully when connecting to non-existent Redis server', async () => {
      // Connect to unused local port with short 100ms timeout
      const client = new NativeRedisClient('127.0.0.1', 59999, 100);
      const connected = await client.connect();
      expect(connected).toBe(false);
      expect(client.connected).toBe(false);
      client.disconnect();
    });
  });
});
