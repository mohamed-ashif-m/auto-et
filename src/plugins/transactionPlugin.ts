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

export interface Category {
  id: number;
  name: string;
  icon: string;
  isDefault: boolean;
  sortOrder: number;
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
    category: string;
  }>;

  updateCategory(options: {
    transactionId: number;
    category: string;
  }): Promise<{
    success: boolean;
    transactionId: number;
    category: string;
  }>;

  getCategories(): Promise<{
    categories: Category[];
  }>;

  addCategory(options: {
    name: string;
    icon: string;
  }): Promise<Category>;

  deleteCategory(options: {
    id: number;
  }): Promise<{
    success: boolean;
    id: number;
  }>;
}

const TransactionPlugin =
  registerPlugin<TransactionPluginInterface>('TransactionPlugin');

export default TransactionPlugin;
