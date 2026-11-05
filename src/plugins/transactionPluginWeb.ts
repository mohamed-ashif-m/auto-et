import { WebPlugin } from '@capacitor/core'
import type { Transaction } from '../lib/types'
import type { TransactionInput, TransactionPluginInterface } from './transactionPlugin'

/**
 * Browser-only stand-in for the native plugin, so the whole UI can be
 * developed with `npm run dev` without an emulator. Never used on Android.
 */
const DB_KEY = 'autoet.web.transactions'
const KV_KEY = 'autoet.web.kv'

const DAY = 86400000

function seed(): Transaction[] {
  const now = Date.now()
  const rows: Array<[number, string, string, 'EXPENSE' | 'INCOME', number, number, string?]> = [
    // [days ago, merchant, category, type, rupees, hour, note]
    [0, 'Swiggy', 'Food & Dining', 'EXPENSE', 349, 13],
    [0, 'Uber', 'Transport', 'EXPENSE', 186, 9],
    [1, 'Salary - Acme Pvt Ltd', 'Salary', 'INCOME', 42000, 10],
    [1, 'DMart', 'Groceries', 'EXPENSE', 1280, 18, 'Weekly stock-up'],
    [2, 'Netflix', 'Entertainment', 'EXPENSE', 649, 21],
    [3, 'Apollo Pharmacy', 'Healthcare', 'EXPENSE', 420, 12],
    [3, 'Zomato', 'Food & Dining', 'EXPENSE', 512, 20],
    [4, 'Amazon', 'Shopping', 'EXPENSE', 2199, 15, 'Headphones'],
    [5, 'Airtel Broadband', 'Bills & Utilities', 'EXPENSE', 999, 11],
    [6, 'Rapido', 'Transport', 'EXPENSE', 92, 8],
    [7, 'Chai Kadai', 'Food & Dining', 'EXPENSE', 60, 17],
    [8, 'Freelance - Logo work', 'Online Payment', 'INCOME', 6500, 16],
    [9, 'BigBasket', 'Groceries', 'EXPENSE', 1540, 19],
    [10, 'Spotify', 'Entertainment', 'EXPENSE', 119, 10],
    [11, 'Udemy', 'Education', 'EXPENSE', 499, 22],
    [12, 'Swiggy', 'Food & Dining', 'EXPENSE', 287, 21],
    [13, 'Petrol Bunk', 'Transport', 'EXPENSE', 1000, 8],
    [15, 'Electricity Bill', 'Bills & Utilities', 'EXPENSE', 1320, 11],
    [16, 'Myntra', 'Shopping', 'EXPENSE', 1799, 14],
    [18, 'Cash - Barber', 'Cash', 'EXPENSE', 150, 10],
    [20, 'Zomato', 'Food & Dining', 'EXPENSE', 430, 20],
    [24, 'Salary - Acme Pvt Ltd', 'Salary', 'INCOME', 42000, 10],
    [26, 'Flipkart', 'Shopping', 'EXPENSE', 3499, 13],
    [31, 'Apollo Clinic', 'Healthcare', 'EXPENSE', 800, 9],
    [34, 'DMart', 'Groceries', 'EXPENSE', 1675, 18],
    [40, 'Swiggy', 'Food & Dining', 'EXPENSE', 612, 21],
    [47, 'Salary - Acme Pvt Ltd', 'Salary', 'INCOME', 42000, 10],
    [52, 'Amazon', 'Shopping', 'EXPENSE', 1299, 15],
  ]
  return rows.map(([ago, merchant, category, type, rupees, hour, note], i) => {
    const d = new Date(now - ago * DAY)
    d.setHours(hour, (i * 7) % 60, 0, 0)
    return {
      id: i + 1,
      amountPaise: rupees * 100,
      currency: 'INR',
      merchant,
      type,
      category,
      note,
      transactionTime: d.getTime(),
      sourcePackage: i % 3 === 0 ? 'manual' : 'com.google.android.apps.messaging',
    }
  })
}

function load(): Transaction[] {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  const fresh = seed()
  localStorage.setItem(DB_KEY, JSON.stringify(fresh))
  return fresh
}

const save = (rows: Transaction[]) => localStorage.setItem(DB_KEY, JSON.stringify(rows))

function loadKv(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KV_KEY) || '{}')
  } catch {
    return {}
  }
}

export class TransactionPluginWeb extends WebPlugin implements TransactionPluginInterface {
  async getTransactions() {
    return { transactions: load().sort((a, b) => b.transactionTime - a.transactionTime) }
  }

  async addTransaction(o: TransactionInput) {
    const rows = load()
    const id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1
    rows.push({
      id,
      amountPaise: o.amountPaise,
      currency: 'INR',
      merchant: o.merchant,
      type: o.type,
      category: o.category,
      note: o.note,
      transactionTime: o.transactionTime ?? Date.now(),
      sourcePackage: 'manual',
    })
    save(rows)
    return { id }
  }

  async updateTransaction(o: TransactionInput & { transactionId: number; transactionTime: number }) {
    const rows = load().map((r) =>
      r.id === o.transactionId
        ? {
            ...r,
            amountPaise: o.amountPaise,
            merchant: o.merchant,
            type: o.type,
            category: o.category,
            note: o.note,
            transactionTime: o.transactionTime,
          }
        : r,
    )
    save(rows)
    return { success: true }
  }

  async deleteTransaction(o: { transactionId: number }) {
    save(load().filter((r) => r.id !== o.transactionId))
    return { success: true }
  }

  async updateCategory(o: { transactionId: number; category: string }) {
    save(load().map((r) => (r.id === o.transactionId ? { ...r, category: o.category } : r)))
    return { success: true, transactionId: o.transactionId, category: o.category }
  }

  async reassignCategory(o: { from: string; to: string }) {
    let updated = 0
    save(
      load().map((r) => {
        if (r.category !== o.from) return r
        updated += 1
        return { ...r, category: o.to }
      }),
    )
    return { updated }
  }

  async clearAllTransactions() {
    const deleted = load().length
    save([])
    return { deleted }
  }

  async getValue(o: { key: string }) {
    return { value: loadKv()[o.key] ?? null }
  }

  async setValue(o: { key: string; value: string }) {
    const kv = loadKv()
    kv[o.key] = o.value
    localStorage.setItem(KV_KEY, JSON.stringify(kv))
  }

  async checkBudgetAlert() {
    // Native-only: browser dev mode shows the in-app banner instead.
  }

  async isNotificationAccessEnabled() {
    return { enabled: true }
  }

  async openNotificationAccessSettings() {
    /* only meaningful on Android */
  }

  async exportCsv(o: { csv: string; fileName: string }) {
    const url = URL.createObjectURL(new Blob([o.csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = o.fileName
    a.click()
    URL.revokeObjectURL(url)
  }
}
