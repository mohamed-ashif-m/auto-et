import { registerPlugin } from '@capacitor/core';

export interface Transaction {
  id: number;
  amountPaise: number;
  currency: string;
  merchant: string;
  type: 'EXPENSE' | 'INCOME';
  transactionTime: number;
  sourcePackage?: string;
  category: string;
}

interface TransactionPluginInterface {
  getTransactions(): Promise<{
    transactions: Transaction[];
  }>;

  addTransaction(options: {
    amountPaise: number;
    merchant: string;
    type: 'EXPENSE' | 'INCOME';
    category: string;
  }): Promise<{
    id: number;
  }>;

  updateCategory(options: {
    transactionId: number;
    category: string;
  }): Promise<{
    success: boolean;
    transactionId: number;
    category: string;
  }>;
}

const TransactionPlugin =
  registerPlugin<TransactionPluginInterface>('TransactionPlugin');

export default TransactionPlugin;