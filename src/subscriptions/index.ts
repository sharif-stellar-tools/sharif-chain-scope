/**
 * @module subscriptions
 *
 * Stellar Horizon SSE subscription helpers.
 *
 * Usage:
 *   import { subscribeToLedgers, subscribeToTransactions } from './subscriptions';
 */

export {
  subscribeToLedgers,
  subscribeToTransactions,
} from './horizonSubscription';

export type {
  LedgerRecord,
  TransactionRecord,
  LedgerCallback,
  TransactionCallback,
  SubscriptionOptions,
  SubscriptionHandle,
} from './horizonSubscription';
