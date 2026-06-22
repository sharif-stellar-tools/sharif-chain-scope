import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Transaction, useTransactionHistory } from '../hooks/useTransactionHistory';

interface ChartPoint {
  timestamp: string;
  amount: number;
}

const formatTimestamp = (timestamp: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const getTransactionChartData = (transactions: Transaction[] = []): ChartPoint[] => {
  return transactions.map((transaction) => ({
    timestamp: formatTimestamp(transaction.timestamp),
    amount: transaction.amount,
  }));
};

export const Dashboard: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('');
  const { data, isLoading, isError } = useTransactionHistory('0x123', selectedType || undefined);
  const chartData = getTransactionChartData(data);

  // Modern styling object
  const styles = {
    container: {
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      backgroundColor: '#0f172a', // Slate 900
      color: '#f8fafc', // Slate 50
      padding: '2rem',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
      maxWidth: '800px',
      margin: '2rem auto',
      border: '1px solid #1e293b', // Slate 800
    },
    header: {
      fontSize: '1.75rem',
      fontWeight: 700,
      margin: '0 0 1.5rem 0',
      background: 'linear-gradient(to right, #38bdf8, #818cf8)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      letterSpacing: '-0.025em',
    },
    filterContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '2rem',
      backgroundColor: '#1e293b', // Slate 800
      padding: '1rem',
      borderRadius: '12px',
      border: '1px solid #334155', // Slate 700
    },
    label: {
      fontSize: '0.9rem',
      fontWeight: 500,
      color: '#94a3b8', // Slate 400
    },
    select: {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      border: '1px solid #475569',
      borderRadius: '8px',
      padding: '0.5rem 2.5rem 0.5rem 1rem',
      fontSize: '0.9rem',
      outline: 'none',
      cursor: 'pointer',
      appearance: 'none' as const,
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 0.75rem center',
      backgroundSize: '1rem',
    },
    metrics: {
      fontSize: '0.875rem',
      color: '#64748b',
      marginBottom: '1rem',
      fontWeight: 500,
    },
    chartCard: {
      height: 'clamp(260px, 35vw, 320px)',
      marginBottom: '1.5rem',
      padding: '1rem',
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155',
    },
    chartEmpty: {
      color: '#64748b',
      textAlign: 'center' as const,
      padding: '2rem 1rem',
    },
    tableContainer: {
      overflowX: 'auto' as const,
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      textAlign: 'left' as const,
    },
    th: {
      padding: '1rem',
      fontSize: '0.75rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      color: '#94a3b8',
      borderBottom: '1px solid #334155',
      fontWeight: 600,
    },
    td: {
      padding: '1rem',
      fontSize: '0.875rem',
      borderBottom: '1px solid #334155',
      color: '#cbd5e1',
    },
    trHover: {
      transition: 'background-color 0.2s',
    },
    badge: (type: string) => {
      let bg = '#334155';
      let text = '#94a3b8';
      if (type === 'payment') {
        bg = 'rgba(16, 185, 129, 0.15)';
        text = '#10b981';
      } else if (type === 'manage_sell_offer') {
        bg = 'rgba(245, 158, 11, 0.15)';
        text = '#f59e0b';
      } else if (type === 'create_passive_sell_offer') {
        bg = 'rgba(99, 102, 241, 0.15)';
        text = '#6366f1';
      }
      return {
        backgroundColor: bg,
        color: text,
        padding: '0.25rem 0.6rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'capitalize' as const,
        display: 'inline-block',
      };
    },
    amount: {
      fontFamily: 'monospace',
      fontWeight: 600,
      color: '#f8fafc',
    },
    txId: {
      fontFamily: 'monospace',
      color: '#38bdf8',
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Transaction Analytics</h2>
      
      <div style={styles.filterContainer}>
        <label htmlFor="operation-type-select" style={styles.label}>
          Filter by Operation Type:
        </label>
        <select
          id="operation-type-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={styles.select}
        >
          <option value="">All Operations</option>
          <option value="payment">Payment</option>
          <option value="manage_sell_offer">Manage Sell Offer</option>
          <option value="create_passive_sell_offer">Create Passive Sell Offer</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ color: '#94a3b8', padding: '1rem' }}>Loading transactions...</div>
      ) : isError ? (
        <div style={{ color: '#ef4444', padding: '1rem' }}>Error loading transactions.</div>
      ) : (
        <div>
          <div style={styles.metrics}>{data?.length} transactions found.</div>
          <div style={styles.chartCard}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="transactionVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={{ stroke: '#334155' }}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={{ stroke: '#334155' }}
                    tickFormatter={(value) => `${value} XLM`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                    }}
                    labelStyle={{ color: '#cbd5e1' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    fill="url(#transactionVolume)"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={styles.chartEmpty}>No transaction volume data available.</div>
            )}
          </div>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Transaction ID</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data && data.length > 0 ? (
                  data.map((tx) => (
                    <tr key={tx.id} style={styles.trHover}>
                      <td style={styles.td}>
                        <span style={styles.txId}>{tx.id}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge(tx.type)}>{tx.type.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.amount}>{tx.amount} XLM</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
