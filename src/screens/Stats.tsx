import { useMemo, useState } from 'react'
import { BarChart, DonutChart } from '../components/charts'
import { RankList } from '../components/RankList'
import { TxnRow } from '../components/TxnRow'
import { Empty, Icon, Segmented } from '../components/ui'
import { useStore } from '../store/AppStore'
import {
  biggestExpenses, bucketize, byCategory, byMerchant, inRange, priciestDay, summarize,
} from '../lib/analytics'
import { shortDate } from '../lib/format'
import { bucketsFor, elapsedDays, isCurrent, previousRange, rangeFor } from '../lib/period'
import type { PeriodKind } from '../lib/period'
import type { Transaction } from '../lib/types'

type TopTab = 'categories' | 'merchants' | 'biggest'
type Flow = 'EXPENSE' | 'INCOME'

export function Stats({ onOpen }: { onOpen: (t: Transaction) => void }) {
  const { transactions, settings, fmt, fmtShort, catOf } = useStore()
  const [kind, setKind] = useState<PeriodKind>('month')
  const [offset, setOffset] = useState(0)
  const [topTab, setTopTab] = useState<TopTab>('categories')
  const [flow, setFlow] = useState<Flow>('EXPENSE')

  const range = useMemo(() => rangeFor(kind, offset, settings.startDay), [kind, offset, settings.startDay])
  const rows = useMemo(() => inRange(transactions, range), [transactions, range])
  const sum = useMemo(() => summarize(rows), [rows])

  const prev = useMemo(() => previousRange(range, settings.startDay), [range, settings.startDay])
  const prevSum = useMemo(() => (prev ? summarize(inRange(transactions, prev)) : null), [prev, transactions])

  const cats = useMemo(() => byCategory(rows), [rows])
  const merchants = useMemo(() => byMerchant(rows).slice(0, 6), [rows])
  const biggest = useMemo(() => biggestExpenses(rows, 5), [rows])
  const day = useMemo(() => priciestDay(rows), [rows])

  const bars = useMemo(() => {
    const buckets = bucketsFor(range)
    const data = bucketize(rows, buckets)
    return data.map((d) => ({ label: d.label, value: flow === 'EXPENSE' ? d.expense : d.income }))
  }, [range, rows, flow])

  const firstTxn = transactions.length ? Math.min(...transactions.map((t) => t.transactionTime)) : null
  const days = elapsedDays(range, firstTxn)
  const perDay = Math.round(sum.expense / days)

  let delta: number | null = null
  if (prevSum && prevSum.expense > 0) delta = Math.round(((sum.expense - prevSum.expense) / prevSum.expense) * 100)

  const changeKind = (k: PeriodKind) => {
    setKind(k)
    setOffset(0)
  }

  const slices = cats.map((s) => {
    const c = catOf(s.key)
    return { key: s.key, label: c.name, value: s.total, color: c.color, emoji: c.emoji }
  })

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="muted">Where your money goes</p>
        </div>
      </header>

      <Segmented<PeriodKind>
        label="Period"
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
          { value: 'all', label: 'All' },
        ]}
      />

      {kind !== 'all' && (
        <div className="month-nav">
          <button className="icon-btn white sm" onClick={() => setOffset(offset - 1)} aria-label="Previous period">
            <Icon name="left" size={18} />
          </button>
          <strong>{range.label}</strong>
          <button className="icon-btn white sm" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next period">
            <Icon name="right" size={18} />
          </button>
        </div>
      )}

      <section className="trio">
        <article className="card tone t-coral mini">
          <p>Spent</p>
          <strong>{fmtShort(sum.expense)}</strong>
        </article>
        <article className="card tone t-lime mini">
          <p>Earned</p>
          <strong>{fmtShort(sum.income)}</strong>
        </article>
        <article className="card tone t-sky mini">
          <p>Net</p>
          <strong>{sum.net < 0 ? '−' : ''}{fmtShort(Math.abs(sum.net))}</strong>
        </article>
      </section>

      {rows.length === 0 ? (
        <Empty emoji="📊" title="No data for this period" body="Add a few transactions and the charts will fill in." />
      ) : (
        <>
          <section className="card tone t-violet">
            <div className="section-head">
              <h2>{flow === 'EXPENSE' ? 'Spending' : 'Income'} trend</h2>
              <Segmented<Flow>
                label="Trend type"
                value={flow}
                onChange={setFlow}
                options={[
                  { value: 'EXPENSE', label: 'Spent' },
                  { value: 'INCOME', label: 'Earned' },
                ]}
              />
            </div>
            <BarChart data={bars} format={fmtShort} name={flow === 'EXPENSE' ? 'spent' : 'earned'} />
          </section>

          {cats.length > 0 && (
            <section className="card">
              <h2>Where it went</h2>
              <DonutChart
                slices={slices}
                centerTop="Total spent"
                centerBottom={fmtShort(sum.expense)}
                format={fmtShort}
              />
              <ul className="legend">
                {slices.slice(0, 8).map((s) => (
                  <li key={s.key}>
                    <span className="swatch" style={{ background: s.color }} />
                    <span className="legend-name">{s.label}</span>
                    <strong>{Math.round((s.value / sum.expense) * 100)}%</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>Top spending</h2>
            <Segmented<TopTab>
              label="Top spending view"
              value={topTab}
              onChange={setTopTab}
              options={[
                { value: 'categories', label: 'Categories' },
                { value: 'merchants', label: 'Merchants' },
                { value: 'biggest', label: 'Biggest' },
              ]}
            />
            <div className="top-body">
              {topTab === 'categories' && (
                <RankList
                  format={fmt}
                  items={slices.slice(0, 6).map((s) => ({
                    key: s.key, label: s.label, emoji: s.emoji, color: s.color, value: s.value,
                  }))}
                />
              )}
              {topTab === 'merchants' && (
                <RankList
                  format={fmt}
                  items={merchants.map((m, i) => ({
                    key: m.key + i,
                    label: m.key,
                    sub: `${m.count} ${m.count === 1 ? 'payment' : 'payments'}`,
                    emoji: '🏪',
                    color: ['#FFD93B', '#6FD3EB', '#FF8FD8', '#B8F04B', '#FFA94D', '#9B8CF5'][i % 6],
                    value: m.total,
                  }))}
                />
              )}
              {topTab === 'biggest' && (
                <div className="list flush">
                  {biggest.map((t) => <TxnRow key={t.id} txn={t} onOpen={onOpen} />)}
                </div>
              )}
            </div>
          </section>

          <section className="insights">
            <article className="card tone t-yellow insight">
              <p>Daily average</p>
              <strong>{fmt(perDay)}</strong>
              <span>over {days} {days === 1 ? 'day' : 'days'}</span>
            </article>
            <article className="card tone t-pink insight">
              <p>Transactions</p>
              <strong>{sum.count}</strong>
              <span>{rows.filter((t) => t.sourcePackage && t.sourcePackage !== 'manual').length} via SMS</span>
            </article>
            <article className="card tone t-orange insight">
              <p>Priciest day</p>
              <strong>{day ? fmt(day.total) : '—'}</strong>
              <span>{day ? shortDate(day.day) : 'no spending'}</span>
            </article>
            <article className="card tone t-lime insight">
              <p>vs last {kind === 'week' ? 'week' : kind === 'month' ? 'month' : 'year'}</p>
              <strong>{delta === null ? '—' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : ''} ${Math.abs(delta)}%`}</strong>
              <span>{delta === null ? (kind === 'all' ? 'n/a for all time' : 'no earlier data') : delta > 0 ? 'spending is up' : delta < 0 ? 'spending is down' : 'about the same'}</span>
            </article>
          </section>

          {isCurrent(range) && kind !== 'all' && cats[0] && (
            <p className="muted center-text note-line">
              Biggest drain so far: <b>{catOf(cats[0].key).emoji} {catOf(cats[0].key).name}</b> ({Math.round((cats[0].total / Math.max(1, sum.expense)) * 100)}% of spending).
            </p>
          )}
        </>
      )}
    </div>
  )
}
