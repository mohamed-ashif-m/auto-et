export type TxnType = 'EXPENSE' | 'INCOME'

export interface Transaction {
  id: number
  amountPaise: number
  currency: string
  merchant: string
  type: TxnType
  transactionTime: number
  sourcePackage?: string
  category: string
  note?: string
}

export interface Category {
  name: string
  emoji: string
  color: string
  builtin?: boolean
}

export interface Rule {
  keyword: string
  category: string
}

export type ThemeMode = 'light' | 'dark' | 'auto'
export type CornerStyle = 'sharp' | 'soft' | 'round'
export type ShadowStyle = 'flat' | 'bold' | 'heavy'

export interface Settings {
  name: string
  theme: ThemeMode
  accent: string
  corners: CornerStyle
  shadow: ShadowStyle
  hideAmounts: boolean
  startDay: number
  monthlyBudget: number // paise, 0 = not set
  categoryBudgets: Record<string, number> // paise per category
  savingsPct: number
  categories: Category[]
}

export type Tab = 'home' | 'history' | 'stats' | 'budget'
