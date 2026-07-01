/**
 * examples/subscriptions-demo.ts
 *
 * Demonstrates how to use the Horizon SSE subscription helpers from
 * sharif-chain-scope to listen for real-time ledgers and account
 * transactions on the Stellar Testnet.
 *
 * Run with ts-node (no compilation step needed):
 *   npx ts-node examples/subscriptions-demo.ts
 *
 * Or compile first:
 *   npx tsc --outDir dist examples/subscriptions-demo.ts
 *   node dist/subscriptions-demo.js
 */

import {
  subscribeToLedgers,
  subscribeToTransactions,
  LedgerRecord,
  TransactionRecord,
} from '../src/subscriptions/horizonSubscription';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * The Stellar account to watch for incoming transactions.
 * Replace with a real account G-address for live testing.
 * The address below is the Stellar Development Foundation's friend-bot address
 * used on Testnet, which receives frequent transactions.
 */
const ACCOUNT_ID = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';

/** Use Testnet so the demo works without real funds. */
const NETWORK = 'testnet' as const;

/**
 * Reconnection options — start retrying after 2 s, cap at 30 s.
 * In production you might tune these to your latency requirements.
 */
const RECONNECT_OPTIONS = {
  network: NETWORK,
  reconnectDelay: 2_000,     // first retry after 2 s
  maxReconnectDelay: 30_000,  // never wait longer than 30 s
  maxReconnectAttempts: Infinity, // retry forever
};

// ─── Ledger subscription ──────────────────────────────────────────────────────

console.log('=== sharif-chain-scope: Horizon SSE Subscription Demo ===\n');
console.log(`Network : ${NETWORK}`);
console.log(`Account : ${ACCOUNT_ID}\n`);
console.log('Subscribing to new ledgers …');

const ledgerHandle = subscribeToLedgers((ledger: LedgerRecord) => {
  const { sequence, closed_at, transaction_count, operation_count } = ledger;
  console.log(
    `[LEDGER] seq=${sequence}  txs=${transaction_count}  ops=${operation_count}  closed=${closed_at}`,
  );
}, RECONNECT_OPTIONS);

// ─── Transaction subscription ─────────────────────────────────────────────────

console.log(`Subscribing to transactions for account ${ACCOUNT_ID} …\n`);

const txHandle = subscribeToTransactions(
  ACCOUNT_ID,
  (tx: TransactionRecord) => {
    const { hash, ledger, created_at, operation_count, successful } = tx;
    console.log(
      `[TX]     hash=${hash.slice(0, 10)}…  ledger=${ledger}  ops=${operation_count}  ok=${successful}  at=${created_at}`,
    );
  },
  RECONNECT_OPTIONS,
);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

/**
 * Press Ctrl+C or send SIGTERM to cleanly unsubscribe and exit.
 */
function shutdown(signal: string) {
  console.log(`\nReceived ${signal} — unsubscribing and exiting …`);
  ledgerHandle.unsubscribe();
  txHandle.unsubscribe();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('Listening … (press Ctrl+C to stop)\n');
