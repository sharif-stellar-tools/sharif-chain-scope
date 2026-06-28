import { Transaction, TransactionFilters } from '../../src/filters/types';
import { buildIndex, applyFilters } from '../../src/filters/transactionFilterEngine';

const makeTxs = (): Transaction[] => [
  { id: 'tx_1', amount: 100,  type: 'payment',                  timestamp: '2026-06-17T00:00:00Z', asset: 'XLM',  memo: 'Payment for services',     sourceAccount: 'GD23...3456' },
  { id: 'tx_2', amount: 250,  type: 'manage_sell_offer',        timestamp: '2026-06-17T00:05:00Z', asset: 'XLM',  memo: 'Sell order',               sourceAccount: 'GB7A...8901' },
  { id: 'tx_3', amount: 50,   type: 'payment',                  timestamp: '2026-06-17T00:10:00Z', asset: 'USDC', memo: 'Refund',                   sourceAccount: 'GC12...4567' },
  { id: 'tx_4', amount: 500,  type: 'create_passive_sell_offer', timestamp: '2026-06-17T00:15:00Z', asset: 'XLM',  memo: 'Passive offer',            sourceAccount: 'GA45...9012' },
  { id: 'tx_5', amount: 120,  type: 'payment',                  timestamp: '2026-06-17T00:20:00Z', asset: 'USDC', memo: 'Subscription payment',     sourceAccount: 'GD23...3456' },
  { id: 'tx_6', amount: 800,  type: 'manage_sell_offer',        timestamp: '2026-06-17T00:25:00Z', asset: 'XLM',  memo: 'Large sell order',         sourceAccount: 'GB7A...8901' },
  { id: 'tx_7', amount: 75,   type: 'payment',                  timestamp: '2026-06-18T00:00:00Z', asset: 'XLM',  memo: 'Daily payout',             sourceAccount: 'GC12...4567' },
  { id: 'tx_8', amount: 320,  type: 'manage_buy_offer',         timestamp: '2026-06-18T00:05:00Z', asset: 'USDC', memo: 'Buy order',                sourceAccount: 'GA45...9012' },
];

describe('buildIndex', () => {
  it('creates byType, byAsset, and byDate indices', () => {
    const txs = makeTxs();
    const idx = buildIndex(txs);

    expect(idx.byType.size).toBeGreaterThan(0);
    expect(idx.byAsset.size).toBeGreaterThan(0);
    expect(idx.byDate.length).toBe(txs.length);
  });

  it('groups transactions by type', () => {
    const idx = buildIndex(makeTxs());
    const payments = idx.byType.get('payment');
    expect(payments).toHaveLength(4);
  });

  it('groups transactions by asset', () => {
    const idx = buildIndex(makeTxs());
    const xlm = idx.byAsset.get('XLM');
    const usdc = idx.byAsset.get('USDC');
    expect(xlm).toHaveLength(5);
    expect(usdc).toHaveLength(3);
  });

  it('sorts byDate entries chronologically', () => {
    const idx = buildIndex(makeTxs());
    for (let i = 1; i < idx.byDate.length; i++) {
      expect(idx.byDate[i - 1].key.localeCompare(idx.byDate[i].key)).toBeLessThanOrEqual(0);
    }
  });
});

describe('applyFilters — type', () => {
  it('filters by single operation type', () => {
    const result = applyFilters(makeTxs(), { types: ['payment'] });
    expect(result).toHaveLength(4);
    expect(result.every((tx) => tx.type === 'payment')).toBe(true);
  });

  it('filters by multiple operation types', () => {
    const result = applyFilters(makeTxs(), { types: ['payment', 'manage_sell_offer'] });
    expect(result).toHaveLength(6);
  });

  it('returns empty array when no match', () => {
    const result = applyFilters(makeTxs(), { types: ['account_merge'] });
    expect(result).toHaveLength(0);
  });
});

describe('applyFilters — asset', () => {
  it('filters by asset code', () => {
    const result = applyFilters(makeTxs(), { asset: 'USDC' });
    expect(result).toHaveLength(3);
    expect(result.every((tx) => tx.asset === 'USDC')).toBe(true);
  });

  it('is case-insensitive', () => {
    const result = applyFilters(makeTxs(), { asset: 'usdc' });
    expect(result).toHaveLength(3);
  });
});

describe('applyFilters — amount range', () => {
  it('filters by minimum amount', () => {
    const result = applyFilters(makeTxs(), { amountMin: 200 });
    expect(result.every((tx) => tx.amount >= 200)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters by maximum amount', () => {
    const result = applyFilters(makeTxs(), { amountMax: 100 });
    expect(result.every((tx) => tx.amount <= 100)).toBe(true);
  });

  it('filters by min and max', () => {
    const result = applyFilters(makeTxs(), { amountMin: 50, amountMax: 150 });
    expect(result.every((tx) => tx.amount >= 50 && tx.amount <= 150)).toBe(true);
  });
});

describe('applyFilters — date range', () => {
  it('filters by start date', () => {
    const result = applyFilters(makeTxs(), { dateFrom: '2026-06-18' });
    expect(result.every((tx) => tx.timestamp >= '2026-06-18')).toBe(true);
  });

  it('filters by end date (date only)', () => {
    const result = applyFilters(makeTxs(), { dateTo: '2026-06-17T23:59:59Z' });
    expect(result.every((tx) => tx.timestamp.slice(0, 10) <= '2026-06-17')).toBe(true);
  });
});

describe('applyFilters — memo text', () => {
  it('filters by memo text (case-insensitive fuzzy)', () => {
    const result = applyFilters(makeTxs(), { memo: 'payment' });
    expect(result.every((tx) => tx.memo && tx.memo.toLowerCase().includes('payment'))).toBe(true);
  });

  it('returns empty when no memo match', () => {
    const result = applyFilters(makeTxs(), { memo: 'nonexistent' });
    expect(result).toHaveLength(0);
  });
});

describe('applyFilters — combined criteria', () => {
  it('applies multiple filters with AND logic', () => {
    const result = applyFilters(makeTxs(), {
      types: ['payment'],
      asset: 'USDC',
      amountMin: 100,
      amountMax: 200,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx_5');
  });

  it('returns empty when conflicting filters', () => {
    const result = applyFilters(makeTxs(), {
      types: ['manage_buy_offer'],
      asset: 'XLM',
    });
    expect(result).toHaveLength(0);
  });
});

describe('applyFilters — query search', () => {
  it('searches across id, type, memo, and sourceAccount', () => {
    const result = applyFilters(makeTxs(), { query: 'GD23' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((tx) => tx.sourceAccount?.includes('GD23'))).toBe(true);
  });

  it('finds by transaction id', () => {
    const result = applyFilters(makeTxs(), { query: 'tx_1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx_1');
  });
});

describe('applyFilters — with pre-built index', () => {
  it('uses the provided index for faster filtering', () => {
    const txs = makeTxs();
    const idx = buildIndex(txs);
    const result = applyFilters(txs, { asset: 'XLM' }, idx);
    expect(result.every((tx) => (tx.asset || 'XLM') === 'XLM')).toBe(true);
  });
});

describe('applyFilters — empty filters', () => {
  it('returns all transactions when no filters are provided', () => {
    const result = applyFilters(makeTxs(), {});
    expect(result).toHaveLength(makeTxs().length);
  });
});
