import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { Transaction, TransactionFilters } from '../filters/types';
import { buildIndex, applyFilters } from '../filters/transactionFilterEngine';

export type { Transaction, TransactionFilters };

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx_1', amount: 100,  type: 'payment',                  timestamp: '2026-06-17T00:00:00Z', asset: 'XLM',  memo: 'Payment for services',     sourceAccount: 'GD23...3456' },
  { id: 'tx_2', amount: 250,  type: 'manage_sell_offer',        timestamp: '2026-06-17T00:05:00Z', asset: 'XLM',  memo: 'Sell order',               sourceAccount: 'GB7A...8901' },
  { id: 'tx_3', amount: 50,   type: 'payment',                  timestamp: '2026-06-17T00:10:00Z', asset: 'USDC', memo: 'Refund',                   sourceAccount: 'GC12...4567' },
  { id: 'tx_4', amount: 500,  type: 'create_passive_sell_offer', timestamp: '2026-06-17T00:15:00Z', asset: 'XLM',  memo: 'Passive offer',            sourceAccount: 'GA45...9012' },
  { id: 'tx_5', amount: 120,  type: 'payment',                  timestamp: '2026-06-17T00:20:00Z', asset: 'USDC', memo: 'Subscription payment',     sourceAccount: 'GD23...3456' },
  { id: 'tx_6', amount: 800,  type: 'manage_sell_offer',        timestamp: '2026-06-17T00:25:00Z', asset: 'XLM',  memo: 'Large sell order',         sourceAccount: 'GB7A...8901' },
  { id: 'tx_7', amount: 75,   type: 'payment',                  timestamp: '2026-06-18T00:00:00Z', asset: 'XLM',  memo: 'Daily payout',             sourceAccount: 'GC12...4567' },
  { id: 'tx_8', amount: 320,  type: 'manage_buy_offer',         timestamp: '2026-06-18T00:05:00Z', asset: 'USDC', memo: 'Buy order',                sourceAccount: 'GA45...9012' },
  { id: 'tx_9', amount: 90,   type: 'payment',                  timestamp: '2026-06-18T00:10:00Z', asset: 'XLM',  memo: 'Tip',                      sourceAccount: 'GB7A...8901' },
  { id: 'tx_10', amount: 1000, type: 'path_payment',            timestamp: '2026-06-18T00:15:00Z', asset: 'USDC', memo: 'Cross-border payment',     sourceAccount: 'GD23...3456' },
  { id: 'tx_11', amount: 45,   type: 'payment',                 timestamp: '2026-06-18T00:20:00Z', asset: 'XLM',  memo: 'Reward',                   sourceAccount: 'GA45...9012' },
  { id: 'tx_12', amount: 600,  type: 'manage_sell_offer',       timestamp: '2026-06-18T00:25:00Z', asset: 'XLM',  memo: 'Bulk sell',                sourceAccount: 'GC12...4567' },
];

export function useTransactionHistory(
  address: string,
  filters?: TransactionFilters,
) {
  const queryKey = ['history', address, filters];

  const { data, isLoading, isError } = useQuery(queryKey, async () => {
    return MOCK_TRANSACTIONS;
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    const index = buildIndex(data);
    return applyFilters(data, filters || {}, index);
  }, [data, filters]);

  return { data: filteredData, isLoading, isError };
}
