import React from 'react';
import { useTransactionHistory } from '../hooks/useTransactionHistory';

export const Dashboard: React.FC = () => {
  const { data } = useTransactionHistory('0x123');
  return (
    <div className="dashboard-container">
      <h2>Transaction Analytics</h2>
      <div className="metrics">{data?.length} transactions found.</div>
    </div>
  );
};
