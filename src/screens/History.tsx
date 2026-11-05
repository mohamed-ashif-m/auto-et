import { useMemo, useState } from 'react'
import { Empty, Icon, Segmented } from '../components/ui'
import { TxnRow } from '../components/TxnRow'
import { useStore } from '../store/AppStore'
import { dayLabel, startOfDay } from '../lib/format'
import type { Transaction } from '../lib/types'

type Filter = 'ALL' | 'EXPENSE' | 'INCOME'
const PAGE = 60

export function History({ onOpen }: { onOpen: (t: Transaction) => void }) {
  const { transactions, loading, fmt, catOf, settings } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(PAGE)

  // Only offer category chips that actually have transactions.
  const usedCategories = useMemo(() => {
    const used = new Set(transactions.map((t) => t.category))
    return settings.categories.filter((c) => used.has(c.name))
  }, [transactions, settings.categories])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return transactions.filter((t) => {
      if (filter !== 'ALL' && t.type !== filter) return false
      if (category && t.category !== category) return false
      if (!q) return true
      return (
        (t.merchant || '').toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    })
  }, [transactions, query, filter, category])

  const groups = useMemo(() => {
    const map = new Map<number, Transaction[]>()
    for (const t of filtered.slice(0, limit)) {
      const day = startOfDay(t.transactionTime)
      map.set(day, [...(map.get(day) ?? []), t])
    }
    return [...map.entries()].map(([day, items]) => ({
      day,
      items,
      net: items.reduce((a, t) => a + (t.type === 'INCOME' ? t.amountPaise : -t.amountPaise), 0),
    }))
  }, [filtered, limit])

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1 className="page-title">History</h1>
          <p className="muted">{filtered.length} of {transactions.length} transactions</p>
        </div>
      </header>

      <div className="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Search merchant, note or category"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }}
          aria-label="Search transactions"
        />
        {query && (
          <button className="icon-btn sm white" onClick={() => setQuery('')} aria-label="Clear search">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      <Segmented<Filter>
        label="Filter by type"
        value={filter}
        onChange={(v) => { setFilter(v); setLimit(PAGE) }}
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'EXPENSE', label: 'Spent' },
          { value: 'INCOME', label: 'Earned' },
        ]}
      />

      {usedCategories.length > 1 && (
        <div className="chip-scroll" role="group" aria-label="Filter by category">
          <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>All categories</button>
          {usedCategories.map((c) => (
            <button
              key={c.name}
              className={`chip ${category === c.name ? 'on' : ''}`}
              onClick={() => { setCategory(category === c.name ? '' : c.name); setLimit(PAGE) }}
            >
              <span aria-hidden="true">{c.emoji}</span> {catOf(c.name).name}
            </button>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Empty emoji="🔍" title="No matches" body="Try a different search or clear the filters." />
      )}

      {groups.map((g) => (
        <section key={g.day} className="day-group">
          <div className="day-head">
            <h3>{dayLabel(g.day)}</h3>
            <span className={g.net >= 0 ? 'pos' : 'neg'}>{g.net >= 0 ? '+' : '−'}{fmt(Math.abs(g.net))}</span>
          </div>
          <div className="card list">
            {g.items.map((t) => <TxnRow key={t.id} txn={t} onOpen={onOpen} showDate={false} />)}
          </div>
        </section>
      ))}

      {filtered.length > limit && (
        <button className="btn white block" onClick={() => setLimit(limit + PAGE)}>
          Show more ({filtered.length - limit} left)
        </button>
      )}
    </div>
  )
}
