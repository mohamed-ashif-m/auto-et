import { startOfDay } from './format'

export type PeriodKind = 'week' | 'month' | 'year' | 'all'

export interface Range {
  kind: PeriodKind
  start: number
  end: number // exclusive
  label: string
}

export interface Bucket {
  label: string
  start: number
  end: number
}

const DAY = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const fmt = (t: number) => {
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Start of the month cycle that contains `now`, offset by `offset` cycles. */
function cycleStart(now: Date, startDay: number, offset: number): Date {
  const y = now.getFullYear()
  let m = now.getMonth()
  if (now.getDate() < startDay) m -= 1
  m += offset
  return new Date(y + Math.floor(m / 12), ((m % 12) + 12) % 12, startDay)
}

export function rangeFor(
  kind: PeriodKind,
  offset: number,
  startDay: number,
  now = new Date(),
): Range {
  if (kind === 'all') {
    return { kind, start: 0, end: Number.MAX_SAFE_INTEGER, label: 'All time' }
  }

  if (kind === 'week') {
    const today = new Date(startOfDay(now))
    const mondayShift = (today.getDay() + 6) % 7
    const start = today.getTime() - mondayShift * DAY + offset * 7 * DAY
    const end = start + 7 * DAY
    return { kind, start, end, label: `${fmt(start)} – ${fmt(end - DAY)}` }
  }

  if (kind === 'year') {
    const y = now.getFullYear() + offset
    return {
      kind,
      start: new Date(y, 0, 1).getTime(),
      end: new Date(y + 1, 0, 1).getTime(),
      label: String(y),
    }
  }

  const s = cycleStart(now, startDay, offset)
  const e = new Date(s.getFullYear(), s.getMonth() + 1, startDay)
  const label =
    startDay === 1
      ? `${MONTHS_LONG[s.getMonth()]} ${s.getFullYear()}`
      : `${fmt(s.getTime())} – ${fmt(e.getTime() - DAY)}`
  return { kind, start: s.getTime(), end: e.getTime(), label }
}

export const isCurrent = (r: Range, now = Date.now()) => now >= r.start && now < r.end

/** The range right before `r`, for "vs last period" comparisons. */
export function previousRange(r: Range, startDay: number): Range | null {
  if (r.kind === 'all') return null
  // Any date inside `r` works as the reference "now"; step back one period.
  return rangeFor(r.kind, -1, startDay, new Date(r.start + DAY))
}

/** Days in the range that have actually elapsed (for "per day" maths). */
export function elapsedDays(r: Range, firstTxn: number | null, now = Date.now()): number {
  if (r.kind === 'all') {
    const from = firstTxn ?? now
    return Math.max(1, Math.ceil((startOfDay(now) + DAY - startOfDay(from)) / DAY))
  }
  const upto = Math.min(now, r.end - 1)
  return Math.max(1, Math.ceil((startOfDay(upto) + DAY - r.start) / DAY))
}

export function totalDays(r: Range): number {
  return Math.round((r.end - r.start) / DAY)
}

export function bucketsFor(r: Range, now = Date.now()): Bucket[] {
  if (r.kind === 'week') {
    return WEEKDAYS.map((label, i) => ({
      label,
      start: r.start + i * DAY,
      end: r.start + (i + 1) * DAY,
    }))
  }

  if (r.kind === 'month') {
    const out: Bucket[] = []
    let i = 1
    for (let s = r.start; s < r.end; s += 7 * DAY, i += 1) {
      out.push({ label: `W${i}`, start: s, end: Math.min(s + 7 * DAY, r.end) })
    }
    return out
  }

  if (r.kind === 'year') {
    const y = new Date(r.start).getFullYear()
    return MONTHS.map((label, i) => ({
      label,
      start: new Date(y, i, 1).getTime(),
      end: new Date(y, i + 1, 1).getTime(),
    }))
  }

  // all time → last 12 calendar months
  const n = new Date(now)
  return Array.from({ length: 12 }, (_, k) => {
    const d = new Date(n.getFullYear(), n.getMonth() - 11 + k, 1)
    return {
      label: MONTHS[d.getMonth()],
      start: d.getTime(),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
    }
  })
}
