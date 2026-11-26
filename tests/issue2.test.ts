import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTransactionsCsv, parseTransactionsJson } from '../src/lib/csv'
import type { ImportRow } from '../src/lib/csv'
import { dedupeRows, duplicateKey } from '../src/lib/importDedupe'
import type { Transaction } from '../src/lib/types'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const sourceRows = () => parseTransactionsJson(fixture('original.json')).rows
const currentState = () => JSON.parse(fixture('current-state.json')) as Transaction[]

function asStored(rows: ImportRow[], firstId = 1): Transaction[] {
  return rows.map((row, i) => ({
    id: firstId + i,
    amountPaise: row.amountPaise,
    currency: 'INR',
    merchant: row.merchant,
    type: row.type,
    category: row.category,
    note: row.note,
    transactionTime: row.transactionTime,
    sourcePackage: 'import',
  }))
}

const summary = (rows: ImportRow[]) =>
  rows.map((r) => [r.category, r.note, r.amountPaise])

const FIVE = [
  ['Social', 'Ashhad', 5000],
  ['Social', 'Yasar Mama', 500000],
  ['Petrol', undefined, 10000],
  ['Movie', 'DC', 8950],
  ['Repairs', 'Puncture', 10000],
]

describe('ISSUE 2 / STEP B: all-field, multiset dedupe', () => {
  it('adds all 325 rows from the original JSON on an empty app', () => {
    const rows = sourceRows()
    expect(rows).toHaveLength(325)
    const result = dedupeRows([], rows)
    expect(result.accepted).toHaveLength(325)
    expect(result.duplicates).toHaveLength(0)
  })

  it('re-importing the same JSON adds 0 and reports 325 exact matches', () => {
    const rows = sourceRows()
    const stored = asStored(dedupeRows([], rows).accepted, 1)
    const again = dedupeRows(stored, rows)
    expect(again.accepted).toHaveLength(0)
    expect(again.duplicates).toHaveLength(325)
  })

  it('adds exactly the 5 listed rows to the 321-row current state', () => {
    const result = dedupeRows(currentState(), sourceRows())
    expect(result.accepted).toHaveLength(5)
    expect(result.duplicates).toHaveLength(320)
    expect(summary(result.accepted)).toEqual(FIVE)
    // The 321 existing rows are never mutated.
    expect(currentState()).toHaveLength(321)
  })

  it('the lossy CSV now maps remark(s) to merchant and adds the same 5 rows', () => {
    const parsed = parseTransactionsCsv(fixture('lossy.csv'))
    expect(parsed.errors).toEqual([])
    expect(parsed.rows).toHaveLength(325)
    expect(parsed.rows.every((r) => r.merchant !== 'Imported transaction')).toBe(true)
    const result = dedupeRows(currentState(), parsed.rows)
    expect(summary(result.accepted)).toEqual(FIVE)
    expect(result.duplicates).toHaveLength(320)
  })

  it('keeps two genuinely identical rows in one file, and skips both on re-import', () => {
    const row: ImportRow = {
      transactionTime: Date.parse('2026-11-01T12:00:00'),
      amountPaise: 5000,
      type: 'EXPENSE',
      merchant: 'Tea',
      category: 'Food',
      note: 'T20',
    }
    const first = dedupeRows([], [row, { ...row }])
    expect(first.accepted).toHaveLength(2)
    expect(first.duplicates).toHaveLength(0)
    const second = dedupeRows(asStored(first.accepted), [row, { ...row }])
    expect(second.accepted).toHaveLength(0)
    expect(second.duplicates).toHaveLength(2)
  })

  it('never skips same date/type/amount with a different category, remark or note', () => {
    const base: ImportRow = {
      transactionTime: Date.parse('2026-11-01T12:00:00'),
      amountPaise: 5000,
      type: 'EXPENSE',
      merchant: 'Vappa',
      category: 'Social',
      note: 'Vappa',
    }
    const existing = asStored([base])
    const variations: ImportRow[] = [
      { ...base, category: 'Tea', merchant: 'T20', note: 'T20' },
      { ...base, merchant: 'Ashhad', note: 'Ashhad' },
      { ...base, note: 'something else' },
    ]
    const result = dedupeRows(existing, variations)
    expect(result.accepted).toHaveLength(3)
    expect(result.duplicates).toHaveLength(0)
  })

  it('normalises case, whitespace and surrounding spaces in every text field', () => {
    const row: ImportRow = {
      transactionTime: 1761992400000,
      amountPaise: 8950,
      type: 'EXPENSE',
      merchant: 'Ajmal   DC',
      category: 'Movie',
      note: '  dc  ',
    }
    const existing = asStored([{
      ...row,
      merchant: '  ajmal dc ',
      category: ' movie ',
      note: 'DC',
    }])
    expect(duplicateKey(row)).toBe(duplicateKey(existing[0]))
    expect(dedupeRows(existing, [row]).duplicates).toHaveLength(1)
  })

  it('separates unreadable rows from exact matches in the parse result', () => {
    const parsed = parseTransactionsJson(JSON.stringify([
      { date: '2026-11-01', amount: 50, category: 'Social', remark: 'Ashhad' },
      { date: 'not a date', amount: 50 },
    ]))
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.skipped).toBe(1)
    expect(parsed.rows[0]).toMatchObject({ merchant: 'Ashhad', note: 'Ashhad', amountPaise: 5000 })
  })
})
