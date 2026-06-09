import { useQuery } from 'react-query';

export function useTransactionHistory(address: string) {
  return useQuery(['history', address], async () => {
    // Mock API fetch
    return [{ id: 'tx_1', amount: 100 }, { id: 'tx_2', amount: 250 }];
  });
}
