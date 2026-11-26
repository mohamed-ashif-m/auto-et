import { describe, expect, it } from 'vitest'
import { transactionsFingerprint } from '../src/lib/importDedupe'
import type { Transaction } from '../src/lib/types'

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: 1,
  amountPaise: 5000,
  currency: 'INR',
  merchant: 'Swiggy',
  type: 'EXPENSE',
  category: 'Online Payment',
  note: undefined,
  transactionTime: 1761992400000,
  ...over,
})

describe('ISSUE 1: stable transaction identity', () => {
  it('does not change when an identical table is re-read', () => {
    const before = [row(), row({ id: 2, merchant: 'Uber', amountPaise: 18600 })]
    const after = before.map((t) => ({ ...t }))
    expect(transactionsFingerprint(after)).toBe(transactionsFingerprint(before))
  })

  it('changes when any stored field changes (add, edit, category or note)', () => {
    const base = [row()]
    const changed = [
      [row(), row({ id: 2 })],
      [row({ amountPaise: 5001 })],
      [row({ category: 'Food' })],
      [row({ note: 'tea' })],
    ]
    for (const next of changed) {
      expect(transactionsFingerprint(next)).not.toBe(transactionsFingerprint(base))
    }
  })
})
