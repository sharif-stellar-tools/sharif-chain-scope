import React from 'react';
import { OperationType, TransactionFilters } from '../filters/types';

interface AdvancedSearchPanelProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}

const OPERATION_TYPES: { value: OperationType; label: string }[] = [
  { value: 'payment', label: 'Payment' },
  { value: 'manage_sell_offer', label: 'Manage Sell Offer' },
  { value: 'create_passive_sell_offer', label: 'Create Passive Sell Offer' },
  { value: 'manage_buy_offer', label: 'Manage Buy Offer' },
  { value: 'path_payment', label: 'Path Payment' },
  { value: 'account_merge', label: 'Account Merge' },
  { value: 'create_account', label: 'Create Account' },
];

const ASSET_OPTIONS = ['XLM', 'USDC', 'ETH', 'BTC'];

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  filters,
  onChange,
}) => {
  const activeCount = countActiveFilters(filters);

  const update = (patch: Partial<TransactionFilters>) => {
    onChange({ ...filters, ...patch });
  };

  const clearAll = () => {
    onChange({});
  };

  const toggleType = (type: OperationType) => {
    const current = filters.types || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    update({ types: next.length > 0 ? next : undefined });
  };

  const typeChipStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? '#3b82f6' : '#0f172a',
    color: active ? '#fff' : '#94a3b8',
    border: `1px solid ${active ? '#3b82f6' : '#475569'}`,
    borderRadius: '999px',
    padding: '0.25rem 0.7rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontWeight: active ? 600 : 400,
  });

  const assetChipStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? '#10b981' : '#0f172a',
    color: active ? '#fff' : '#94a3b8',
    border: `1px solid ${active ? '#10b981' : '#475569'}`,
    borderRadius: '6px',
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  });

  const s: Record<string, React.CSSProperties> = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      backgroundColor: '#1e293b',
      padding: '1rem',
      borderRadius: '12px',
      border: '1px solid #334155',
      marginBottom: '1.5rem',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    badge: {
      backgroundColor: '#3b82f6',
      color: '#fff',
      fontSize: '0.7rem',
      padding: '0.15rem 0.45rem',
      borderRadius: '999px',
      fontWeight: 700,
    },
    clearBtn: {
      backgroundColor: 'transparent',
      color: '#94a3b8',
      border: '1px solid #475569',
      borderRadius: '6px',
      padding: '0.3rem 0.75rem',
      fontSize: '0.75rem',
      cursor: 'pointer',
    },
    row: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '0.75rem',
      alignItems: 'center',
    },
    label: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      minWidth: '60px',
    },
    input: {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      border: '1px solid #475569',
      borderRadius: '6px',
      padding: '0.4rem 0.6rem',
      fontSize: '0.8rem',
      outline: 'none',
      flex: 1,
      minWidth: '100px',
    },
    select: {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      border: '1px solid #475569',
      borderRadius: '6px',
      padding: '0.4rem 0.6rem',
      fontSize: '0.8rem',
      outline: 'none',
      cursor: 'pointer',
    },
    numberInput: {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      border: '1px solid #475569',
      borderRadius: '6px',
      padding: '0.4rem 0.6rem',
      fontSize: '0.8rem',
      outline: 'none',
      width: '90px',
    },
    flexRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    separator: {
      color: '#64748b',
      fontSize: '0.8rem',
    },
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.title}>
          Advanced Filters
          {activeCount > 0 && <span style={s.badge}>{activeCount}</span>}
        </div>
        {activeCount > 0 && (
          <button onClick={clearAll} style={s.clearBtn}>
            Clear all
          </button>
        )}
      </div>

      <div style={s.row}>
        <span style={s.label}>Search</span>
        <input
          type="text"
          placeholder="Search by ID, type, memo..."
          value={filters.query || ''}
          onChange={(e) => update({ query: e.target.value || undefined })}
          style={s.input}
        />
      </div>

      <div style={s.row}>
        <span style={s.label}>Type</span>
        {OPERATION_TYPES.map((op) => (
          <button
            key={op.value}
            onClick={() => toggleType(op.value)}
            style={typeChipStyle(filters.types?.includes(op.value) || false)}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div style={s.row}>
        <span style={s.label}>Asset</span>
        {ASSET_OPTIONS.map((a) => (
          <button
            key={a}
            onClick={() =>
              update({ asset: filters.asset === a ? undefined : a })
            }
            style={assetChipStyle(filters.asset === a)}
          >
            {a}
          </button>
        ))}
      </div>

      <div style={s.row}>
        <span style={s.label}>Amount</span>
        <div style={s.flexRow}>
          <input
            type="number"
            placeholder="Min"
            value={filters.amountMin ?? ''}
            onChange={(e) =>
              update({
                amountMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            style={s.numberInput}
          />
          <span style={s.separator}>—</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.amountMax ?? ''}
            onChange={(e) =>
              update({
                amountMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            style={s.numberInput}
          />
        </div>
      </div>

      <div style={s.row}>
        <span style={s.label}>Date</span>
        <div style={s.flexRow}>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) =>
              update({ dateFrom: e.target.value || undefined })
            }
            style={s.input}
          />
          <span style={s.separator}>—</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) =>
              update({ dateTo: e.target.value || undefined })
            }
            style={s.input}
          />
        </div>
      </div>

      <div style={s.row}>
        <span style={s.label}>Memo</span>
        <input
          type="text"
          placeholder="Search memo text..."
          value={filters.memo || ''}
          onChange={(e) => update({ memo: e.target.value || undefined })}
          style={s.input}
        />
      </div>
    </div>
  );
};

function countActiveFilters(filters: TransactionFilters): number {
  let count = 0;
  if (filters.query) count++;
  if (filters.types && filters.types.length > 0) count++;
  if (filters.asset) count++;
  if (filters.amountMin !== undefined) count++;
  if (filters.amountMax !== undefined) count++;
  if (filters.dateFrom) count++;
  if (filters.dateTo) count++;
  if (filters.memo) count++;
  if (filters.sourceAccount) count++;
  return count;
}
