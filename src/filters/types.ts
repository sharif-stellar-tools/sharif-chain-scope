export type OperationType =
  | 'payment'
  | 'manage_sell_offer'
  | 'create_passive_sell_offer'
  | 'manage_buy_offer'
  | 'path_payment'
  | 'account_merge'
  | 'create_account'
  | string;

export interface Transaction {
  id: string;
  amount: number;
  type: OperationType;
  timestamp: string;
  asset?: string;
  memo?: string;
  sourceAccount?: string;
}

export interface TransactionFilters {
  query?: string;
  types?: OperationType[];
  asset?: string;
  amountMin?: number;
  amountMax?: number;
  memo?: string;
  dateFrom?: string;
  dateTo?: string;
  sourceAccount?: string;
}

export interface FilterIndex {
  byType: Map<string, Transaction[]>;
  byAsset: Map<string, Transaction[]>;
  byDate: { key: string; tx: Transaction }[];
}
