const FULL = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** ₹1,672 — decimals only appear when the amount actually has paise. */
export function money(paise: number, hide = false): string {
  if (hide) return '₹ ••••'
  const rupees = paise / 100
  const sign = rupees < 0 ? '−' : ''
  return `${sign}₹${FULL.format(Math.abs(rupees))}`
}

/** ₹1.2k / ₹3.4L / ₹1.1Cr — for tight chart labels. */
export function moneyShort(paise: number, hide = false): string {
  if (hide) return '••'
  const r = Math.abs(paise / 100)
  const trim = (n: number) => String(Math.round(n * 10) / 10)
  if (r >= 1e7) return `₹${trim(r / 1e7)}Cr`
  if (r >= 1e5) return `₹${trim(r / 1e5)}L`
  if (r >= 1e3) return `₹${trim(r / 1e3)}k`
  return `₹${Math.round(r)}`
}

const DAY_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
})
const SHORT_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
})

export const startOfDay = (t: number | Date) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function dayLabel(t: number): string {
  const today = startOfDay(Date.now())
  const day = startOfDay(t)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return DAY_FMT.format(t)
}

export const timeLabel = (t: number) => TIME_FMT.format(t)
export const shortDate = (t: number) => SHORT_FMT.format(t)
export const shortDateTime = (t: number) => `${SHORT_FMT.format(t)}, ${TIME_FMT.format(t)}`

/** yyyy-mm-dd in local time, for <input type="date"> */
export function toDateInput(t: number): string {
  const d = new Date(t)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Combine a yyyy-mm-dd string with the clock time of `base`. */
export function fromDateInput(value: string, base: number): number {
  const [y, m, d] = value.split('-').map(Number)
  const t = new Date(base)
  t.setFullYear(y, m - 1, d)
  return t.getTime()
}

export const pct = (part: number, whole: number) =>
  whole <= 0 ? 0 : Math.round((part / whole) * 100)
