import { useMemo, useState } from 'react'
import { Empty, Icon, Meter } from '../components/ui'
import { RankList } from '../components/RankList'
import { TxnRow } from '../components/TxnRow'
import { BalanceTableSheet } from '../components/BalanceTableSheet'
import { CategoryDetailSheet } from '../components/CategoryDetailSheet'
import { CalendarSheet } from '../components/CalendarSheet'
import { useStore } from '../store/AppStore'
import { byCategory, inRange, summarize } from '../lib/analytics'
import { isCurrent, rangeFor } from '../lib/period'
import type { Range } from '../lib/period'
import type { Tab, Transaction } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Home({
  onOpen,
  onAdd,
  go,
  openSettings,
}: {
  onOpen: (t: Transaction) => void
  onAdd: () => void
  go: (tab: Tab) => void
  openSettings: () => void
}) {
  const {
    transactions, loading, error, settings, fmt, catOf, refresh,
    autoTrackOn, openAutoTrackSettings,
  } = useStore()
  const [offset, setOffset] = useState(0)
  const [customRange, setCustomRange] = useState<Range | null>(null)
  const [showBalanceTable, setShowBalanceTable] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)

  const defaultRange = useMemo(() => rangeFor('month', offset, settings.startDay), [offset, settings.startDay])
  const range = customRange ?? defaultRange
  const current = isCurrent(range)
  const rows = useMemo(() => inRange(transactions, range), [transactions, range])
  const sum = useMemo(() => summarize(rows), [rows])
  const top = useMemo(() => byCategory(rows).slice(0, 5), [rows])

  const budget = settings.monthlyBudget
  const left = budget - sum.expense
  const daysLeft = Math.max(1, Math.ceil((range.end - Date.now()) / 86400000))

  const heroLabel = budget > 0 ? (left >= 0 ? 'Left to spend' : 'Over budget by') : 'Balance this month'
  const heroValue = budget > 0 ? Math.abs(left) : sum.net

  const handlePrev = () => {
    if (customRange) {
      setCustomRange(null)
      setOffset(-1)
    } else {
      setOffset((o) => o - 1)
    }
  }

  const handleNext = () => {
    if (customRange) {
      setCustomRange(null)
      setOffset(0)
    } else {
      setOffset((o) => o + 1)
    }
  }

  return (
    <div className="screen">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">₹</span>
          <div>
            <h1>Auto Et</h1>
            <p>{greeting()}{settings.name ? `, ${settings.name}` : ''}</p>
          </div>
        </div>
        <div className="row gap-s">
          <button
          className="icon-btn white sm home-cal"
          onClick={() => setShowCalendar(true)}
          aria-label="Open Calendar"
          title="Open Calendar"
        >
          <Icon name="calendar" size={18} />
        </button>
          <button className="icon-btn" onClick={openSettings} aria-label="Settings">
            <Icon name="gear" />
          </button>
        </div>
      </header>

      {autoTrackOn === false && (
        <section className="card tone t-yellow banner">
          <span className="tile" style={{ background: 'var(--ink)', color: 'var(--yellow)' }}>
            <Icon name="sms" />
          </span>
          <div className="grow">
            <h3>Turn on SMS auto-tracking</h3>
            <p>Let Auto Et read bank &amp; UPI alerts so payments log themselves.</p>
          </div>
          <button className="btn white sm" onClick={() => void openAutoTrackSettings()}>Enable</button>
        </section>
      )}

      <div className="month-nav">
        
        <button className="icon-btn white sm" onClick={handlePrev} aria-label="Previous month">
          <Icon name="left" size={18} />
        </button>
        <strong className="clickable-range" onClick={() => setShowCalendar(true)}>
          {range.label}
        </strong>
        <button
          className="icon-btn white sm"
          onClick={handleNext}
          disabled={!customRange && offset >= 0}
          aria-label="Next month"
        >
          <Icon name="right" size={18} />
        </button>
      </div>

      {/* Clickable Hero Balance Card */}
      <section
        className="hero tone t-violet clickable-hero"
        onClick={() => setShowBalanceTable(true)}
        role="button"
        tabIndex={0}
        aria-label="Click to open financial table and balance breakdown"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setShowBalanceTable(true)
          }
        }}
      >
        <div className="hero-top-indicator">
          <p className="hero-label">{heroLabel}</p>
          <span className="hero-table-chip">
            <Icon name="table" size={14} /> Financial Table ↗
          </span>
        </div>
        <h2 className="hero-num">{fmt(heroValue)}</h2>
        {budget > 0 ? (
          <>
            <Meter ratio={budget ? sum.expense / budget : 0} tall />
            <p className="hero-foot">
              {fmt(sum.expense)} spent of {fmt(budget)}
              {current && left > 0 && <> · <b>{fmt(Math.floor(left / daysLeft / 100) * 100)}</b>/day for {daysLeft} more {daysLeft === 1 ? 'day' : 'days'}</>}
            </p>
          </>
        ) : (
          <button
            className="btn white sm"
            onClick={(e) => {
              e.stopPropagation()
              go('budget')
            }}
          >
            <Icon name="target" size={18} /> Set a monthly budget
          </button>
        )}
      </section>

      <section className="pair">
        <article className="card tone t-lime stat-card">
          <span className="icon-chip"><Icon name="up" size={18} /></span>
          <p>Earned</p>
          <h3>{fmt(sum.income)}</h3>
        </article>
        <article className="card tone t-coral stat-card">
          <span className="icon-chip"><Icon name="down" size={18} /></span>
          <p>Spent</p>
          <h3>{fmt(sum.expense)}</h3>
        </article>
      </section>

      {top.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>Top spending</h2>
            <button className="btn sm white" onClick={() => go('stats')}>All stats <Icon name="right" size={16} /></button>
          </div>
          <p className="muted note-hint">Tap any category to see each payment made</p>
          <RankList
            format={fmt}
            onItemClick={(item) => setSelectedCategory(item.key)}
            items={top.map((s) => {
              const c = catOf(s.key)
              return { key: s.key, label: c.name, emoji: c.emoji, color: c.color, value: s.total }
            })}
          />
        </section>
      )}

      <section className="stack">
        <div className="section-head">
          <h2>Recent</h2>
          {rows.length > 5 && (
            <button className="btn sm white" onClick={() => go('history')}>See all <Icon name="right" size={16} /></button>
          )}
        </div>

        {loading && <p className="muted center-text">Loading…</p>}

        {!loading && error && (
          <Empty emoji="⚠️" title="Couldn't load" body={error} action={<button className="btn" onClick={() => void refresh()}>Try again</button>} />
        )}

        {!loading && !error && rows.length === 0 && (
          <Empty
            emoji="🧾"
            title="Nothing here yet"
            body={current ? 'Add your first transaction, or let SMS alerts fill this up for you.' : 'No transactions in this month.'}
            action={current ? <button className="btn" onClick={onAdd}><Icon name="plus" size={18} /> Add one</button> : undefined}
          />
        )}

        {rows.length > 0 && (
          <div className="card list">
            {rows.slice(0, 5).map((t) => <TxnRow key={t.id} txn={t} onOpen={onOpen} />)}
          </div>
        )}
      </section>

      {/* Balance Breakdown Table Sheet modal */}
      {showBalanceTable && (
        <BalanceTableSheet
          onClose={() => setShowBalanceTable(false)}
          onSelectMonth={(year, month) => {
            const now = new Date()
            const diffYears = year - now.getFullYear()
            const diffMonths = month - now.getMonth()
            setOffset(diffYears * 12 + diffMonths)
            setCustomRange(null)
            setShowBalanceTable(false)
          }}
        />
      )}

      {/* Category Detail Sheet modal */}
      {selectedCategory && (
        <CategoryDetailSheet
          categoryName={selectedCategory}
          range={range}
          onClose={() => setSelectedCategory(null)}
          onOpenTxn={onOpen}
        />
      )}

      {/* Calendar modal */}
      {showCalendar && (
        <CalendarSheet
          currentRange={range}
          onSelectRange={(r) => {
            setCustomRange(r)
            setShowCalendar(false)
          }}
          onClose={() => setShowCalendar(false)}
          onOpenTxn={onOpen}
        />
      )}
    </div>
  )
}
