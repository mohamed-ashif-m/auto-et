import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readCsv } from '../src/lib/csv'
import type { ImportRow } from '../src/lib/csv'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

// Mirrors the pre-fix csv.ts mapping of this fixture: no merchant column,
// "remarks" mapped only to note, dates at 12:00:00.
function legacyParse(text: string): ImportRow[] {
  return readCsv(text).slice(1).map((r) => ({
    transactionTime: Date.parse(`${r[0]}T12:00:00`),
    amountPaise: Math.round(Number(r[2].replace(/[₹,\s]/g, '')) * 100),
    type: r[1] as ImportRow['type'],
    category: r[3],
    merchant: 'Imported transaction',
    note: r[4] || undefined,
  }))
}

// The exact key used by AppStore.importTransactions before the fix.
const legacyKey = (row: ImportRow) =>
  `${row.transactionTime}|${row.amountPaise}|${row.type}|${row.merchant.trim().toLowerCase()}`

describe('ISSUE 2 / STEP A: reproduce the false duplicates with the original code', () => {
  it('imports 325 rows from the lossy CSV into an empty store and reports which 5 are skipped', () => {
    const parsed = legacyParse(fixture('lossy.csv'))
    expect(parsed).toHaveLength(325)

    // Old importTransactions: a Set seeded from existing rows, and every
    // accepted row is added to that Set during the same import.
    const known = new Set<string>()
    const skipped: ImportRow[] = []
    let added = 0
    for (const row of parsed) {
      const key = legacyKey(row)
      if (known.has(key)) {
        skipped.push(row)
        continue
      }
      known.add(key)
      added += 1
    }

    const describeRow = (r: ImportRow) =>
      `${new Date(r.transactionTime).toISOString().slice(0, 10)} | ${r.category} | ${r.note ?? ''} | ₹${(r.amountPaise / 100).toFixed(2)}`

    console.log('BEFORE FIX — import into empty store')
    console.log(`  rows in file : ${parsed.length}`)
    console.log(`  added        : ${added}`)
    console.log(`  skipped      : ${skipped.length}`)
    for (const row of skipped) console.log(`    SKIPPED (key already in Set): ${describeRow(row)}`)

    expect(added).toBe(320)
    expect(skipped).toHaveLength(5)
    expect(skipped.map((r) => [r.category, r.note, r.amountPaise])).toEqual([
      ['Social', 'Ashhad', 5000],
      ['Social', 'Yasar Mama', 500000],
      ['Petrol', undefined, 10000],
      ['Movie', 'DC', 8950],
      ['Repairs', 'Puncture', 10000],
    ])
  })
})
