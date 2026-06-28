import React, { useState, useCallback, useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Transaction, TransactionFilters } from '../filters/types';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useLedgerStream } from '../hooks/useLedgerStream';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';

const WS_URL: string | null = (import.meta as unknown as { env: Record<string, string> }).env.VITE_LEDGER_WS_URL ?? null;

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
  const [filters, setFilters] = useState<TransactionFilters>({});
  const { data, isLoading, isError } = useTransactionHistory('0x123', filters);
  const chartData = useMemo(() => getTransactionChartData(data), [data]);

  const { transactions: liveTransactions, status: streamStatus } = useLedgerStream(WS_URL);

  const handleFilterChange = useCallback((newFilters: TransactionFilters) => {
    setFilters(newFilters);
  }, []);

  const styles = {
    container: {
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: '2rem',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
      maxWidth: '960px',
      margin: '2rem auto',
      border: '1px solid #1e293b',
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
      padding: '0.75rem 1rem',
      fontSize: '0.7rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      color: '#94a3b8',
      borderBottom: '1px solid #334155',
      fontWeight: 600,
    },
    td: {
      padding: '0.75rem 1rem',
      fontSize: '0.8rem',
      borderBottom: '1px solid #334155',
      color: '#cbd5e1',
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
      } else if (type === 'manage_buy_offer') {
        bg = 'rgba(236, 72, 153, 0.15)';
        text = '#ec4899';
      } else if (type === 'path_payment') {
        bg = 'rgba(168, 85, 247, 0.15)';
        text = '#a855f7';
      } else if (type === 'account_merge') {
        bg = 'rgba(239, 68, 68, 0.15)';
        text = '#ef4444';
      }
      return {
        backgroundColor: bg,
        color: text,
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'capitalize' as const,
        display: 'inline-block',
      };
    },
    assetBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      color: '#38bdf8',
      padding: '0.2rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 600,
      fontFamily: 'monospace',
    },
    amount: {
      fontFamily: 'monospace',
      fontWeight: 600,
      color: '#f8fafc',
    },
    txId: {
      fontFamily: 'monospace',
      color: '#38bdf8',
      fontSize: '0.75rem',
    },
    memo: {
      color: '#94a3b8',
      fontSize: '0.75rem',
      maxWidth: '140px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Transaction Analytics</h2>

      <AdvancedSearchPanel filters={filters} onChange={handleFilterChange} />

      {isLoading ? (
        <div style={{ color: '#94a3b8', padding: '1rem' }}>Loading transactions...</div>
      ) : isError ? (
        <div style={{ color: '#ef4444', padding: '1rem' }}>Error loading transactions.</div>
      ) : (
        <div>
          <div style={styles.metrics}>
            {data?.length ?? 0} transaction{data?.length !== 1 ? 's' : ''} found.
          </div>
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
                  <th style={styles.th}>Tx ID</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Asset</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Memo</th>
                </tr>
              </thead>
              <tbody>
                {data && data.length > 0 ? (
                  data.map((tx) => (
                    <tr key={tx.id}>
                      <td style={styles.td}>
                        <span style={styles.txId}>{tx.id}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge(tx.type)}>{tx.type.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.assetBadge}>{tx.asset || 'XLM'}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.amount}>{tx.amount}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.memo} title={tx.memo}>
                          {tx.memo || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                      No transactions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.025em' }}>
          Live Ledger Stream{' '}
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: streamStatus === 'open' ? '#10b981' : streamStatus === 'error' ? '#ef4444' : '#94a3b8',
          }}>
            ● {streamStatus}
          </span>
        </h3>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tx ID</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Asset</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Memo</th>
              </tr>
            </thead>
            <tbody>
              {liveTransactions.length > 0 ? (
                liveTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={styles.td}><span style={styles.txId}>{tx.id}</span></td>
                    <td style={styles.td}><span style={styles.badge(tx.type)}>{tx.type.replace(/_/g, ' ')}</span></td>
                    <td style={styles.td}><span style={styles.assetBadge}>{tx.asset || 'XLM'}</span></td>
                    <td style={styles.td}><span style={styles.amount}>{tx.amount}</span></td>
                    <td style={styles.td}><span style={styles.memo} title={tx.memo}>{tx.memo || '—'}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                    {streamStatus === 'connecting' ? 'Connecting to stream…' : 'Waiting for live events…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
