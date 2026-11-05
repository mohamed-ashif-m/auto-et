import type { Range, Bucket } from './period'
import { startOfDay } from './format'
import type { Transaction } from './types'

export const inRange = (txns: Transaction[], r: Range) =>
  txns.filter((t) => t.transactionTime >= r.start && t.transactionTime < r.end)

export function summarize(txns: Transaction[]) {
  let income = 0
  let expense = 0
  for (const t of txns) {
    if (t.type === 'INCOME') income += t.amountPaise
    else expense += t.amountPaise
  }
  return { income, expense, net: income - expense, count: txns.length }
}

export interface Slice {
  key: string
  total: number
  count: number
}

function group(txns: Transaction[], keyOf: (t: Transaction) => string): Slice[] {
  const map = new Map<string, Slice>()
  for (const t of txns) {
    if (t.type !== 'EXPENSE') continue
    const key = keyOf(t)
    const slice = map.get(key) ?? { key, total: 0, count: 0 }
    slice.total += t.amountPaise
    slice.count += 1
    map.set(key, slice)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export const byCategory = (txns: Transaction[]) =>
  group(txns, (t) => t.category || 'Other')

/** Same merchant, different capitalisation → one row. */
export const byMerchant = (txns: Transaction[]) =>
  group(txns, (t) => (t.merchant || 'Unknown').trim().toLowerCase()).map((s) => ({
    ...s,
    key: s.key.replace(/\b\w/g, (c) => c.toUpperCase()),
  }))

export const biggestExpenses = (txns: Transaction[], n = 5) =>
  txns
    .filter((t) => t.type === 'EXPENSE')
    .sort((a, b) => b.amountPaise - a.amountPaise)
    .slice(0, n)

export function bucketize(txns: Transaction[], buckets: Bucket[]) {
  return buckets.map((b) => {
    let expense = 0
    let income = 0
    for (const t of txns) {
      if (t.transactionTime >= b.start && t.transactionTime < b.end) {
        if (t.type === 'EXPENSE') expense += t.amountPaise
        else income += t.amountPaise
      }
    }
    return { label: b.label, expense, income }
  })
}

export function priciestDay(txns: Transaction[]) {
  const map = new Map<number, number>()
  for (const t of txns) {
    if (t.type !== 'EXPENSE') continue
    const day = startOfDay(t.transactionTime)
    map.set(day, (map.get(day) ?? 0) + t.amountPaise)
  }
  let best: { day: number; total: number } | null = null
  for (const [day, total] of map) {
    if (!best || total > best.total) best = { day, total }
  }
  return best
}

export const sumExpense = (txns: Transaction[], category?: string) =>
  txns.reduce(
    (a, t) =>
      t.type === 'EXPENSE' && (!category || t.category === category)
        ? a + t.amountPaise
        : a,
    0,
  )

export function toCsv(txns: Transaction[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = txns.map((t) => {
    const d = new Date(t.transactionTime)
    return [
      d.toISOString(),
      t.type,
      (t.amountPaise / 100).toFixed(2),
      esc(t.merchant || ''),
      esc(t.category || ''),
      esc(t.note || ''),
      t.sourcePackage === 'manual' || !t.sourcePackage ? 'manual' : 'sms',
    ].join(',')
  })
  return ['date,type,amount_inr,merchant,category,note,source', ...rows].join('\n')
}
