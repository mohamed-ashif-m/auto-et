import type { TxnType } from './types'

export interface ImportRow {
  amountPaise: number
  merchant: string
  type: TxnType
  category: string
  note?: string
  transactionTime: number
}

export interface ParseResult {
  rows: ImportRow[]
  skipped: number
  errors: string[]
}

/* ---------- low-level CSV reader (quotes, escaped quotes, CRLF, BOM) ---------- */

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length }))
  counts.sort((a, b) => b.n - a.n)
  return counts[0].d
}

export function readCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/* ---------- column detection ---------- */

const ALIASES: Record<string, string[]> = {
  date: ['date', 'time', 'datetime', 'transaction date', 'txn date', 'value date', 'timestamp', 'posted'],
  type: ['type', 'transaction type', 'txn type', 'dr cr', 'cr dr'],
  amount: ['amount', 'amount inr', 'amount rs', 'value', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawal amt', 'withdrawals', 'paid out', 'dr'],
  credit: ['credit', 'deposit', 'deposit amt', 'deposits', 'paid in', 'cr'],
  merchant: [
    'merchant', 'description', 'payee', 'narration', 'particulars', 'details',
    'name', 'title', 'paid to', 'remark', 'remarks',
  ],
  category: ['category'],
  note: ['note', 'notes', 'memo', 'comment'],
}

const normalise = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function mapColumns(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  header.forEach((h, i) => {
    const n = normalise(h)
    for (const [field, names] of Object.entries(ALIASES)) {
      if (!(field in map) && names.includes(n)) map[field] = i
    }
  })
  return map
}

/* ---------- value parsers ---------- */

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null
  let s = raw.trim().replace(/[₹,\s]|rs\.?|inr/gi, '').replace('−', '-')
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (/(dr)$/i.test(s)) negative = true
  s = s.replace(/(dr|cr)$/i, '')
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const value = Math.round(parseFloat(s) * 100)
  return negative ? -value : value
}

function parseType(raw: string | undefined): TxnType | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (/^(income|credit|cr|earned|earning|deposit|in|received)$/.test(v)) return 'INCOME'
  if (/^(expense|debit|dr|spent|spending|withdrawal|out|paid)$/.test(v)) return 'EXPENSE'
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseDate(raw: string | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  const time = (m: RegExpMatchArray | null, at: number) =>
    m && m[at] ? [Number(m[at]), Number(m[at + 1] ?? 0), Number(m[at + 2] ?? 0)] : [12, 0, 0]

  // 2026-11-05T13:20:00(.000)(Z) -> ISO strings keep their own time
  if (/^\d{4}-\d{2}-\d{2}[T ]\d/.test(s)) {
    const t = Date.parse(s.replace(' ', 'T'))
    return Number.isNaN(t) ? null : t
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const [h, mi, se] = time(m, 4)
    return new Date(+m[1], +m[2] - 1, +m[3], h, mi, se).getTime()
  }
  // 05/11/2026, 5-11-26, 05.11.2026 (day first — Indian format)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const year = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    const [h, mi, se] = time(m, 4)
    return new Date(year, +m[2] - 1, +m[1], h, mi, se).getTime()
  }
  // 5 Nov 2026, 05-Nov-2026
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -,]+(\d{2,4})/)
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase())
    if (month >= 0) {
      const year = +m[3] < 100 ? 2000 + +m[3] : +m[3]
      return new Date(year, month, +m[1], 12, 0, 0).getTime()
    }
  }
  const fallback = Date.parse(s)
  return Number.isNaN(fallback) ? null : fallback
}

/* ---------- public entry point ---------- */

export function parseTransactionsCsv(text: string): ParseResult {
  const table = readCsv(text)
  if (table.length < 2) {
    return { rows: [], skipped: 0, errors: ['That file has no data rows.'] }
  }

  const cols = mapColumns(table[0])
  const hasAmount = 'amount' in cols || 'debit' in cols || 'credit' in cols
  if (!('date' in cols) || !hasAmount) {
    return {
      rows: [],
      skipped: 0,
      errors: ['Could not find Date and Amount columns. The first row should be a header like: date,type,amount,merchant,category,note'],
    }
  }

  const rows: ImportRow[] = []
  let skipped = 0
  const cell = (r: string[], field: string) => (field in cols ? r[cols[field]] : undefined)
  const merchantFromNote = !('merchant' in cols) && 'note' in cols
  const merchantFromRemark = 'merchant' in cols
    && ['remark', 'remarks'].includes(normalise(table[0][cols.merchant] ?? ''))

  for (const r of table.slice(1)) {
    const when = parseDate(cell(r, 'date'))
    let signed: number | null = null
    let type: TxnType | null = parseType(cell(r, 'type'))

    if ('amount' in cols) {
      signed = parseAmount(cell(r, 'amount'))
    } else {
      const debit = parseAmount(cell(r, 'debit')) ?? 0
      const credit = parseAmount(cell(r, 'credit')) ?? 0
      if (Math.abs(credit) > 0 && Math.abs(debit) === 0) signed = Math.abs(credit)
      else if (Math.abs(debit) > 0) signed = -Math.abs(debit)
    }

    if (when === null || signed === null || signed === 0) {
      skipped += 1
      continue
    }

    // An explicit Type column wins; otherwise the sign decides (negative = spent).
    if (!type) type = signed < 0 ? 'EXPENSE' : 'INCOME'

    const category = (cell(r, 'category') ?? '').trim()
    const merchantCell = (cell(r, 'merchant') ?? '').trim()
    const noteCell = (cell(r, 'note') ?? '').trim()
    // remark(s) is a merchant; if there is no merchant-like column, fall back
    // to note, then to the category. "Imported transaction" is a last resort.
    const merchant =
      merchantCell.slice(0, 60) ||
      (merchantFromNote ? noteCell.slice(0, 60) : '') ||
      category.slice(0, 60) ||
      'Imported transaction'
    // Preserve the remark as a note too: that is how earlier imports stored it.
    const note = (
      noteCell || ((merchantFromRemark && merchantCell) || merchantFromNote ? merchant : '')
    ).slice(0, 200)
    rows.push({
      amountPaise: Math.abs(signed),
      merchant,
      type,
      category,
      note: note || undefined,
      transactionTime: when,
    })
  }

  const errors = rows.length === 0 ? ['No valid rows found — check the date and amount formats.'] : []
  return { rows, skipped, errors }
}

/* ---------- direct JSON import (same ImportRow pipeline as CSV) ---------- */

type JsonRecord = Record<string, unknown>

const JSON_FIELDS = {
  date: ['date', 'time', 'datetime', 'transaction date', 'transactionDate', 'txnDate', 'timestamp', 'posted'],
  amount: ['amount', 'amount inr', 'value', 'transaction amount', 'transactionAmount'],
  amountPaise: ['amountPaise', 'amount_paise'],
  type: ['type', 'transaction type', 'transactionType', 'txnType', 'dr cr'],
  category: ['category'],
  merchant: [
    'merchant', 'payee', 'description', 'narration', 'particulars', 'details',
    'name', 'title', 'paid to', 'remark', 'remarks',
  ],
  note: ['note', 'notes', 'memo', 'comment'],
}

function pickValue(record: JsonRecord, names: string[]): unknown {
  for (const name of names) {
    const value = record[name]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return undefined
}

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''

/** Accepts a plain array of objects or `{ "transactions": [...] }`. */
export function parseTransactionsJson(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { rows: [], skipped: 0, errors: ['That file is not valid JSON.'] }
  }

  const source: unknown[] | null = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as JsonRecord).transactions)
      ? (parsed as JsonRecord).transactions as unknown[]
      : null
  if (!source || source.length === 0) {
    return { rows: [], skipped: 0, errors: ['That JSON file has no transactions array.'] }
  }

  const rows: ImportRow[] = []
  let skipped = 0
  for (const item of source) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped += 1
      continue
    }
    const record = item as JsonRecord
    const dateValue = pickValue(record, JSON_FIELDS.date)
    const when = typeof dateValue === 'number'
      ? dateValue
      : parseDate(asText(dateValue) || (dateValue instanceof Date ? dateValue.toISOString() : ''))
    const paiseValue = pickValue(record, JSON_FIELDS.amountPaise)
    const signed = paiseValue !== undefined
      ? Math.round(Number(paiseValue))
      : parseAmount(asText(pickValue(record, JSON_FIELDS.amount)))

    if (when === null || signed === null || !Number.isFinite(signed) || signed === 0) {
      skipped += 1
      continue
    }

    let type = parseType(asText(pickValue(record, JSON_FIELDS.type)))
    if (!type) type = signed < 0 ? 'EXPENSE' : 'INCOME'

    const category = asText(pickValue(record, JSON_FIELDS.category))
    const remarkValue = pickValue(record, ['remark', 'remarks'])
    const noteValue = pickValue(record, JSON_FIELDS.note)
    const merchant =
      asText(pickValue(record, JSON_FIELDS.merchant)) ||
      asText(noteValue) ||
      category.slice(0, 60) ||
      'Imported transaction'
    const note = asText(noteValue) || (remarkValue !== undefined ? asText(remarkValue) : '')

    rows.push({
      amountPaise: Math.abs(signed),
      merchant: merchant.slice(0, 60),
      type,
      category,
      note: note.slice(0, 200) || undefined,
      transactionTime: when,
    })
  }

  const errors = rows.length === 0 ? ['No valid rows found — check the date and amount formats.'] : []
  return { rows, skipped, errors }
}