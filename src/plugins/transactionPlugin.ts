import { registerPlugin } from '@capacitor/core'
import type { Transaction, TxnType } from '../lib/types'

export type { Transaction } from '../lib/types'

export interface TransactionInput {
  amountPaise: number
  merchant: string
  type: TxnType
  category: string
  note?: string
  transactionTime?: number
}

export interface TransactionPluginInterface {
  getTransactions(): Promise<{ transactions: Transaction[] }>

  addTransaction(options: TransactionInput): Promise<{ id: number }>

  updateTransaction(
    options: TransactionInput & { transactionId: number; transactionTime: number },
  ): Promise<{ success: boolean }>

  deleteTransaction(options: { transactionId: number }): Promise<{ success: boolean }>

  updateCategory(options: {
    transactionId: number
    category: string
  }): Promise<{ success: boolean; transactionId: number; category: string }>

  reassignCategory(options: { from: string; to: string }): Promise<{ updated: number }>

  clearAllTransactions(): Promise<{ deleted: number }>

  getValue(options: { key: string }): Promise<{ value: string | null }>

  setValue(options: { key: string; value: string }): Promise<void>

  checkBudgetAlert(): Promise<void>

  isNotificationAccessEnabled(): Promise<{ enabled: boolean }>

  openNotificationAccessSettings(): Promise<void>

  exportCsv(options: { csv: string; fileName: string }): Promise<void>
}

// On Android this talks to TransactionPlugin.java (encrypted Room database).
// In a plain browser (npm run dev) it falls back to localStorage with demo data.
const TransactionPlugin = registerPlugin<TransactionPluginInterface>('TransactionPlugin', {
  web: () => import('./transactionPluginWeb').then((m) => new m.TransactionPluginWeb()),
})

export default TransactionPlugin
