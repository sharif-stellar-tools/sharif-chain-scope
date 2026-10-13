/**
 * @module cache
 *
 * Redis caching layer for Sharif ChainScope.
 *
 * Usage:
 *   import { RedisCache, createLedgerCache, getGlobalLedgerCache } from './cache';
 */

export {
  RedisCache,
  NativeRedisClient,
  createLedgerCache,
  getGlobalLedgerCache,
} from './redisCache';

export type {
  RedisCacheOptions,
  CacheStats,
} from './redisCache';
