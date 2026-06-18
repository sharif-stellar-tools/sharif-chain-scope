import { useQuery } from 'react-query';

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  timestamp: string;
}

export function useTransactionHistory(address: string, operationType?: string) {
  return useQuery(['history', address, operationType], async () => {
    // Mock API fetch
    const transactions: Transaction[] = [
      { id: 'tx_1', amount: 100, type: 'payment', timestamp: '2026-06-17T00:00:00Z' },
      { id: 'tx_2', amount: 250, type: 'manage_sell_offer', timestamp: '2026-06-17T00:05:00Z' },
      { id: 'tx_3', amount: 50, type: 'payment', timestamp: '2026-06-17T00:10:00Z' },
      { id: 'tx_4', amount: 500, type: 'create_passive_sell_offer', timestamp: '2026-06-17T00:15:00Z' },
      { id: 'tx_5', amount: 120, type: 'payment', timestamp: '2026-06-17T00:20:00Z' },
      { id: 'tx_6', amount: 800, type: 'manage_sell_offer', timestamp: '2026-06-17T00:25:00Z' }
    ];

    if (operationType) {
      return transactions.filter((tx) => tx.type === operationType);
    }
    return transactions;
  });
}
