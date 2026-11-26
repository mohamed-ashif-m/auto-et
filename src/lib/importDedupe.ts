import type { Transaction } from './types'

export interface KeyFields {
  transactionTime: number
  amountPaise: number
  type: string
  merchant: string
  category: string
  note?: string
}

/** trim + lowercase + collapse whitespace (also used for the import summary). */
export function normaliseField(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Every field that identifies an imported transaction. */
export function duplicateKey(row: KeyFields): string {
  return [
    row.transactionTime,
    row.amountPaise,
    row.type,
    normaliseField(row.merchant),
    normaliseField(row.category),
    normaliseField(row.note),
  ].join('|')
}

const LEGACY_MERCHANT = 'imported transaction'

/**
 * Rows written by the old importer all had merchant = "Imported transaction"
 * and the remark in `note`. Keep a second, modernised key for those rows so a
 * re-import of the same JSON/CSV is still recognised as an exact match.
 */
export function storedKeys(row: KeyFields): string[] {
  const primary = duplicateKey(row)
  if (normaliseField(row.merchant) !== LEGACY_MERCHANT) return [primary]
  return [
    primary,
    duplicateKey({ ...row, merchant: normaliseField(row.note) ? row.note! : row.category }),
  ]
}

export interface DedupeResult<T extends KeyFields> {
  accepted: T[]
  duplicates: T[]
}

/**
 * Multiset ("count-based") matching: existing rows consume one match each.
 * Keys from accepted rows are never added, so two genuinely identical rows in
 * one file are both kept, while re-importing the file is idempotent.
 */
export function dedupeRows<T extends KeyFields>(existing: Transaction[], rows: T[]): DedupeResult<T> {
  const counts = new Map<string, number>()
  for (const row of existing) {
    for (const key of storedKeys(row)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const accepted: T[] = []
  const duplicates: T[] = []
  for (const row of rows) {
    const key = duplicateKey(row)
    const left = counts.get(key) ?? 0
    if (left > 0) {
      counts.set(key, left - 1)
      duplicates.push(row)
    } else {
      accepted.push(row)
    }
  }
  return { accepted, duplicates }
}

/** Cheap change fingerprint so an identical re-read never replaces React state. */
export function transactionsFingerprint(rows: Transaction[]): string {
  let maxId = 0
  let maxTime = 0
  let hash = 2166136261
  const mix = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
    }
  }

  for (const t of rows) {
    if (t.id > maxId) maxId = t.id
    if (t.transactionTime > maxTime) maxTime = t.transactionTime
    hash = Math.imul(hash ^ t.id, 16777619)
    hash = Math.imul(hash ^ t.amountPaise, 16777619)
    mix(`${t.type}|${t.merchant}|${t.category}|${t.note ?? ''}`)
  }
  return `${rows.length}|${maxId}|${maxTime}|${hash >>> 0}`
}
