import { useMemo, useState } from 'react'
import { Empty, Icon, Sheet } from './ui'
import { useStore } from '../store/AppStore'
import { byCategory } from '../lib/analytics'
import { dayRange, rangeFor } from '../lib/period'
import { shortDateTime, startOfDay } from '../lib/format'
import type { Range } from '../lib/period'
import type { Transaction } from '../lib/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmtCellAmount(paise: number): string {
  const r = paise / 100
  if (r >= 10000000) return `${(r / 10000000).toFixed(1)}Cr`
  if (r >= 100000)   return `${(r / 100000).toFixed(r >= 1000000 ? 1 : 0)}L`
  if (r >= 1000)     return `${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}k`
  return `${Math.round(r)}`
}

export function CalendarSheet({
  currentRange,
  onSelectRange,
  onClose,
  onOpenTxn,
}: {
  currentRange?: Range
  onSelectRange: (range: Range) => void
  onClose: () => void
  onOpenTxn?: (t: Transaction) => void
}) {
  const { transactions, fmt, settings, catOf } = useStore()

  const initialDate = currentRange?.start && currentRange.start > 0 ? new Date(currentRange.start) : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  // If viewing day stats
  const [activeDayTs, setActiveDayTs] = useState<number | null>(
    currentRange?.kind === 'day' ? startOfDay(currentRange.start) : null,
  )
  const [viewingDayStats, setViewingDayStats] = useState(false)

  const todayTs = startOfDay(Date.now())

  // Days in selected month & first day index (0 = Sunday, 1 = Monday ...)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay()

  // Pre-calculate spending by day timestamp
  const dailyData = useMemo(() => {
    const map = new Map<number, { expense: number; income: number; txns: Transaction[] }>()
    for (const t of transactions) {
      const day = startOfDay(t.transactionTime)
      const entry = map.get(day) ?? { expense: 0, income: 0, txns: [] }
      if (t.type === 'EXPENSE') entry.expense += t.amountPaise
      else entry.income += t.amountPaise
      entry.txns.push(t)
      map.set(day, entry)
    }
    return map
  }, [transactions])

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleDayClick = (dayNum: number) => {
    const ts = new Date(viewYear, viewMonth, dayNum).getTime()
    setActiveDayTs(ts)
    setViewingDayStats(true)
  }

  const selectPreset = (kind: 'week' | 'month' | 'year') => {
    const now = new Date()
    const r = rangeFor(kind, 0, settings.startDay, now)
    onSelectRange(r)
    onClose()
  }

  // Active day transactions & stats
  const selectedDayEntry = activeDayTs ? dailyData.get(activeDayTs) : null
  const selectedDayTxns = selectedDayEntry?.txns ?? []
  const selectedDayExpenses = selectedDayTxns.filter((t) => t.type === 'EXPENSE')
  const selectedDayCategories = useMemo(
    () => byCategory(selectedDayExpenses),
    [selectedDayExpenses],
  )
  const dayExpense = selectedDayEntry?.expense ?? 0
  const dayIncome = selectedDayEntry?.income ?? 0
  const dayNet = dayIncome - dayExpense

  return (
    <Sheet
      title={viewingDayStats ? 'Day Stats' : 'Calendar'}
      onClose={onClose}
    >
      <div className="cal-sheet-container">
        {viewingDayStats && activeDayTs ? (
          /* Day Stats View */
          <div className="cal-day-stats-view">
            <div className="cal-day-stats-header">
              <button
                type="button"
                className="btn sm white"
                onClick={() => setViewingDayStats(false)}
              >
                <Icon name="left" size={16} /> Calendar
              </button>
              <strong className="cal-day-stats-date">
                {new Date(activeDayTs).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
            </div>

            {/* Day KPI Cards */}
            <div className="cal-day-kpis">
              <div className="cal-day-kpi-card tone t-coral">
                <span className="cal-kpi-lbl">
                  <Icon name="down" size={13} /> Spent
                </span>
                <strong className="cal-kpi-val">{fmt(dayExpense)}</strong>
              </div>
              <div className="cal-day-kpi-card tone t-lime">
                <span className="cal-kpi-lbl">
                  <Icon name="up" size={13} /> Earned
                </span>
                <strong className="cal-kpi-val">{fmt(dayIncome)}</strong>
              </div>
              <div className="cal-day-kpi-card tone t-sky">
                <span className="cal-kpi-lbl">Net</span>
                <strong className="cal-kpi-val">
                  {dayNet < 0 ? '−' : ''}{fmt(Math.abs(dayNet))}
                </strong>
              </div>
            </div>

            {/* Categories breakdown on this day */}
            {selectedDayCategories.length > 0 && (
              <div className="card" style={{ padding: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontFamily: 'var(--display)' }}>
                  Categories ({selectedDayCategories.length})
                </h4>
                <div className="cal-day-cats-list">
                  {selectedDayCategories.map((c) => {
                    const cat = catOf(c.key)
                    return (
                      <div key={c.key} className="cal-day-cat-row">
                        <span className="tile sm" style={{ background: cat.color }}>
                          {cat.emoji}
                        </span>
                        <span className="cal-day-cat-name">{cat.name}</span>
                        <strong className="cal-day-cat-amt">{fmt(c.total)}</strong>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Transactions on this day */}
            <div className="cal-day-txns-section">
              <h4 style={{ margin: '4px 0 8px 0', fontSize: '13px', fontFamily: 'var(--display)' }}>
                Payments & Entries ({selectedDayTxns.length})
              </h4>
              {selectedDayTxns.length === 0 ? (
                <Empty
                  emoji="📅"
                  title="No activity"
                  body="No transactions recorded on this day."
                />
              ) : (
                <div className="cat-txns-list" style={{ maxHeight: '220px' }}>
                  {selectedDayTxns.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="cat-txn-item"
                      onClick={() => {
                        if (onOpenTxn) {
                          onClose()
                          onOpenTxn(t)
                        }
                      }}
                    >
                      <div className="cat-txn-left">
                        <strong className="cat-txn-merchant">{t.merchant}</strong>
                        <span className="cat-txn-date">{shortDateTime(t.transactionTime)}</span>
                        {t.note && <span className="cat-txn-note">“{t.note}”</span>}
                      </div>
                      <div className="cat-txn-right">
                        <span className={`cat-txn-amount ${t.type === 'INCOME' ? 'ft-pos' : ''}`}>
                          {t.type === 'INCOME' ? '+' : '−'}{fmt(t.amountPaise)}
                        </span>
                        <span className="cat-txn-badge">{t.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn block"
              onClick={() => {
                onSelectRange(dayRange(activeDayTs))
                onClose()
              }}
            >
              Filter Dashboard to This Day
            </button>
          </div>
        ) : (
          /* Full Month Calendar View */
          <>
            {/* Quick Period Presets */}
            <div className="cal-presets">
              <button type="button" className="cal-preset-btn" onClick={() => selectPreset('week')}>
                This Week
              </button>
              <button type="button" className="cal-preset-btn" onClick={() => selectPreset('month')}>
                This Month
              </button>
              <button type="button" className="cal-preset-btn" onClick={() => selectPreset('year')}>
                This Year
              </button>
            </div>

            {/* Month Navigator Header */}
            <div className="cal-header">
              <button type="button" className="icon-btn white sm" onClick={prevMonth} aria-label="Previous month">
                <Icon name="left" size={16} />
              </button>
              <strong className="cal-month-title">
                {MONTHS_LONG[viewMonth]} {viewYear}
              </strong>
              <button type="button" className="icon-btn white sm" onClick={nextMonth} aria-label="Next month">
                <Icon name="right" size={16} />
              </button>
            </div>

            {/* Responsive Calendar Grid */}
            <div className="cal-grid-wrapper">
              <div className="cal-grid">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="cal-weekday">
                    {w}
                  </div>
                ))}

                {Array.from({ length: firstDayWeekday }).map((_, i) => (
                  <div key={`blank-${i}`} className="cal-cell empty" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1
                  const cellTs = new Date(viewYear, viewMonth, dayNum).getTime()
                  const isToday = cellTs === todayTs
                  const isSelected = activeDayTs === cellTs
                  const data = dailyData.get(cellTs)
                  const hasIncome = data && data.income > 0
                  const hasExpense = data && data.expense > 0
                  const hasActivity = hasIncome || hasExpense

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasActivity ? 'has-data' : ''}`}
                      onClick={() => handleDayClick(dayNum)}
                      aria-label={`Day ${dayNum}, ${MONTHS_LONG[viewMonth]}`}
                    >
                      <span className="cal-day-number">{dayNum}</span>
                      {hasActivity && (
                        <div className="cal-cell-amounts">
                          {hasIncome && (
                            <span className="cal-amt-income">▲{fmtCellAmount(data!.income)}</span>
                          )}
                          {hasExpense && (
                            <span className="cal-amt-expense">▼{fmtCellAmount(data!.expense)}</span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="muted center-text note-line" style={{ marginTop: '8px', fontSize: '11px' }}>
              💡 Tap any date to view its daily breakdown, expenses &amp; stats.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
