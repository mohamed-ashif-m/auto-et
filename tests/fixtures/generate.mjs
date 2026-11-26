// Reconstructs the two files described in the report (the original attachments
// were not present in the workspace). Run with: node tests/fixtures/generate.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dateOf = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)

// 315 ordinary rows + 5 "counterpart" rows that share date/type/amount with the
// five legit transactions that were reported as skipped = 320 clean rows.
const overrides = {
  304: [
    { category: 'Tea', remark: 'T20', amount: 50 },
    { category: 'Social', remark: 'Vappa', amount: 5000 },
  ],
  263: [{ category: 'Beauty', remark: 'Haircut', amount: 100 }],
  224: [{ category: 'Movie', remark: 'Ajmal DC', amount: 89.5 }],
  160: [{ category: 'Food', remark: 'SS Biriyani', amount: 100 }],
}

const rows = []
for (let i = 0; i < 319; i += 1) {
  const list = overrides[i] ?? [{ category: 'Misc', remark: `Entry ${i}`, amount: ((i + 1) * 137 + 23) / 100 }]
  for (const item of list) {
    rows.push({
      date: dateOf(i),
      type: 'EXPENSE',
      amount: item.amount,
      category: item.category,
      remark: item.remark,
    })
  }
}

// The five rows that were skipped, in the order given in the report.
rows.push(
  { date: '2026-11-01', type: 'EXPENSE', amount: 50, category: 'Social', remark: 'Ashhad' },
  { date: '2026-11-01', type: 'EXPENSE', amount: 5000, category: 'Social', remark: 'Yasar Mama' },
  { date: '2026-09-21', type: 'EXPENSE', amount: 100, category: 'Petrol', remark: '' },
  { date: '2026-08-13', type: 'EXPENSE', amount: 89.5, category: 'Movie', remark: 'DC' },
  { date: '2026-06-10', type: 'EXPENSE', amount: 100, category: 'Repairs', remark: 'Puncture' },
)

writeFileSync(join(here, 'original.json'), `${JSON.stringify(rows, null, 2)}\n`)

// The lossy JSON -> CSV conversion: no merchant column, "remarks" only.
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const csv = [
  'date,type,amount,category,remarks',
  ...rows.map((r) => [r.date, r.type, r.amount, r.category, r.remark].map(cell).join(',')),
].join('\n')
writeFileSync(join(here, 'lossy.csv'), `${csv}\n`)

// The app state after that import: 320 rows as stored by the OLD code
// (merchant fallback + remark in note) plus one unrelated SMS row.
const state = rows.slice(0, 320).map((r, i) => ({
  id: i + 1,
  amountPaise: Math.round(r.amount * 100),
  currency: 'INR',
  merchant: 'Imported transaction',
  type: r.type,
  category: r.category,
  note: r.remark || undefined,
  transactionTime: Date.parse(`${r.date}T12:00:00`),
  sourcePackage: 'import',
}))
state.push({
  id: 321,
  amountPaise: 34900,
  currency: 'INR',
  merchant: 'Swiggy',
  type: 'EXPENSE',
  category: 'Online Payment',
  transactionTime: Date.parse('2026-11-05T13:20:00'),
  sourcePackage: 'com.google.android.apps.messaging',
})
writeFileSync(join(here, 'current-state.json'), `${JSON.stringify(state, null, 2)}\n`)
console.log(`wrote ${rows.length} source rows, ${state.length} current-state rows`)
