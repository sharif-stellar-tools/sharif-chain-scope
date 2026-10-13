/**
 * examples/redis-cache-demo.ts
 *
 * Demonstrates how to use the Redis caching layer to cache frequently accessed
 * Stellar ledger data, reducing load on Horizon API endpoints.
 *
 * Run:
 *   npx ts-node examples/redis-cache-demo.ts
 */

import { createLedgerCache } from '../src/cache/redisCache';
import { LedgerRecord } from '../src/subscriptions/horizonSubscription';

async function main() {
  console.log('=== sharif-chain-scope: Redis Caching Layer Demo ===\n');

  // Initialize ledger cache (automatically uses Redis or falls back to in-memory)
  const cache = createLedgerCache({
    prefix: 'chainscope:demo:',
    defaultTtlSeconds: 3600,
  });

  await cache.init();
  const initialStats = cache.getStats();
  console.log(`Active Backend : ${initialStats.backend} (Connected: ${initialStats.connected})\n`);

  const mockLedger: LedgerRecord = {
    id: 'ledger_500000',
    paging_token: '500000_token',
    hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    sequence: 500000,
    transaction_count: 15,
    operation_count: 32,
    closed_at: new Date().toISOString(),
    base_fee_in_stroops: 100,
    base_reserve_in_stroops: 5000000,
  };

  // Simulate cold cache fetch
  console.log('1. Cold cache query: fetching ledger 500000...');
  const startCold = Date.now();
  const fetched1 = await cache.getOrFetchLedger(500000, async () => {
    // Simulated remote Horizon latency
    await new Promise((r) => setTimeout(r, 200));
    return mockLedger;
  });
  console.log(`   Fetched sequence ${fetched1.sequence} in ${Date.now() - startCold}ms (Cache Miss)`);

  // Simulate warm cache hit
  console.log('\n2. Warm cache query: fetching ledger 500000...');
  const startWarm = Date.now();
  const fetched2 = await cache.getOrFetchLedger(500000, async () => {
    throw new Error('Should not hit Horizon on warm cache!');
  });
  console.log(`   Retrieved sequence ${fetched2.sequence} in ${Date.now() - startWarm}ms (Cache Hit!)`);

  // Print cache metrics
  console.log('\n3. Cache Runtime Metrics:');
  console.log(cache.getStats());

  cache.disconnect();
  console.log('\nDemo completed successfully.');
}

if (require.main === module) {
  main().catch(console.error);
}
