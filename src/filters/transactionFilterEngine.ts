import { Transaction, TransactionFilters, FilterIndex } from './types';

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\s+/).filter(Boolean);
}

function matchFuzzy(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryTokens = tokenize(query);
  return queryTokens.every((token) => textLower.includes(token));
}

function buildDateKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export function buildIndex(transactions: Transaction[]): FilterIndex {
  const byType = new Map<string, Transaction[]>();
  const byAsset = new Map<string, Transaction[]>();
  const byDate: { key: string; tx: Transaction }[] = [];

  for (const tx of transactions) {
    const typeKey = tx.type.toLowerCase();
    if (!byType.has(typeKey)) byType.set(typeKey, []);
    byType.get(typeKey)!.push(tx);

    const asset = (tx.asset || 'XLM').toUpperCase();
    if (!byAsset.has(asset)) byAsset.set(asset, []);
    byAsset.get(asset)!.push(tx);

    byDate.push({ key: buildDateKey(tx.timestamp), tx });
  }

  byDate.sort((a, b) => a.key.localeCompare(b.key));

  return { byType, byAsset, byDate };
}

export function applyFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
  index?: FilterIndex,
): Transaction[] {
  const idx = index || buildIndex(transactions);

  let result: Transaction[] | null = null;

  if (filters.types && filters.types.length > 0) {
    const typeSet = new Set(filters.types.map((t) => t.toLowerCase()));
    const matched: Transaction[] = [];
    for (const [typeKey, txs] of idx.byType) {
      if (typeSet.has(typeKey)) matched.push(...txs);
    }
    result = matched;
  }

  if (filters.asset) {
    const assetKey = filters.asset.toUpperCase();
    const assetTxs = idx.byAsset.get(assetKey) || [];
    result = result ? intersect(result, assetTxs) : assetTxs;
  }

  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    const source = result || transactions;
    result = source.filter((tx) => {
      if (filters.amountMin !== undefined && tx.amount < filters.amountMin) return false;
      if (filters.amountMax !== undefined && tx.amount > filters.amountMax) return false;
      return true;
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    const fromKey = filters.dateFrom ? buildDateKey(filters.dateFrom) : '0000-00-00';
    const toKey = filters.dateTo ? buildDateKey(filters.dateTo) : '9999-99-99';
    const fromIdx = lowerBound(idx.byDate, fromKey);
    const toIdx = upperBound(idx.byDate, toKey);
    const dateMatched = idx.byDate.slice(fromIdx, toIdx).map((e) => e.tx);
    result = result ? intersect(result, dateMatched) : dateMatched;
  }

  if (filters.query) {
    const source = result || transactions;
    result = source.filter(
      (tx) =>
        matchFuzzy(tx.id, filters.query!) ||
        matchFuzzy(tx.type, filters.query!) ||
        (tx.asset ? matchFuzzy(tx.asset, filters.query!) : false) ||
        (tx.memo ? matchFuzzy(tx.memo, filters.query!) : false) ||
        (tx.sourceAccount ? matchFuzzy(tx.sourceAccount, filters.query!) : false),
    );
  }

  if (filters.memo) {
    const source = result || transactions;
    result = source.filter((tx) => tx.memo && matchFuzzy(tx.memo, filters.memo!));
  }

  if (filters.sourceAccount) {
    const source = result || transactions;
    result = source.filter(
      (tx) => tx.sourceAccount && matchFuzzy(tx.sourceAccount, filters.sourceAccount!),
    );
  }

  return result || transactions;
}

function lowerBound(arr: { key: string; tx: Transaction }[], key: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].key < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr: { key: string; tx: Transaction }[], key: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].key <= key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function intersect(a: Transaction[], b: Transaction[]): Transaction[] {
  const idSet = new Set(b.map((tx) => tx.id));
  return a.filter((tx) => idSet.has(tx.id));
}
