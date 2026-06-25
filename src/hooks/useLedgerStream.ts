import { useEffect, useState } from 'react';
import { Transaction } from './useTransactionHistory';

export type StreamStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface UseLedgerStreamReturn {
  transactions: Transaction[];
  status: StreamStatus;
  error: string | null;
}

/**
 * Streams real-time ledger/transaction events over WebSocket.
 *
 * Each WebSocket message must be a JSON-serialised `Transaction` object.
 * The hook accumulates incoming events in newest-first order and cleans
 * up the socket on unmount or when `url` changes.
 *
 * @param url   WebSocket endpoint (ws:// or wss://).  Pass `null` to
 *              disable the stream (e.g. when no network is selected).
 * @param limit Maximum number of transactions to keep in memory (default 50).
 */
export function useLedgerStream(
  url: string | null,
  limit: number = 50,
): UseLedgerStreamReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<StreamStatus>('closed');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus('closed');
      return;
    }

    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(url);

    ws.onopen = () => setStatus('open');

    ws.onmessage = (event: MessageEvent) => {
      try {
        const tx: Transaction = JSON.parse(event.data as string);
        setTransactions((prev) => [tx, ...prev].slice(0, limit));
      } catch {
        // Ignore unparseable frames
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setError('WebSocket connection error');
    };

    ws.onclose = () => setStatus('closed');

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [url, limit]);

  return { transactions, status, error };
}
