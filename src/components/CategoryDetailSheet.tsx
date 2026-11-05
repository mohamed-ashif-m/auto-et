import { useMemo } from 'react'
import { Empty, Sheet } from './ui'
import { useStore } from '../store/AppStore'
import { shortDateTime } from '../lib/format'
import type { Range } from '../lib/period'
import type { Transaction } from '../lib/types'

export function CategoryDetailSheet({
  categoryName,
  range,
  onClose,
  onOpenTxn,
}: {
  categoryName: string
  range: Range
  onClose: () => void
  onOpenTxn: (t: Transaction) => void
}) {
  const { transactions, catOf, fmt } = useStore()
  const category = catOf(categoryName)

  // Filter transactions in range for this category
  const txns = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === 'EXPENSE' &&
          t.category === categoryName &&
          t.transactionTime >= range.start &&
          t.transactionTime < range.end,
      )
      .sort((a, b) => b.transactionTime - a.transactionTime)
  }, [transactions, categoryName, range])

  // Total period expense across all categories for percentage calculation
  const totalPeriodExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'EXPENSE' && t.transactionTime >= range.start && t.transactionTime < range.end)
      .reduce((sum, t) => sum + t.amountPaise, 0)
  }, [transactions, range])

  const totalSpent = useMemo(() => txns.reduce((sum, t) => sum + t.amountPaise, 0), [txns])
  const count = txns.length
  const pct = totalPeriodExpense > 0 ? Math.round((totalSpent / totalPeriodExpense) * 100) : 0
  const avg = count > 0 ? Math.round(totalSpent / count) : 0

  return (
    <Sheet title={category.name} onClose={onClose}>
      <div className="cat-detail-hero" style={{ borderLeftColor: category.color }}>
        <div className="cat-detail-top">
          <span className="tile lg" style={{ background: category.color }}>
            {category.emoji}
          </span>
          <div className="cat-detail-meta">
            <span className="cat-period-badge">{range.label}</span>
            <h3 className="cat-detail-title">{category.name}</h3>
            <div className="cat-detail-amount">{fmt(totalSpent)}</div>
          </div>
        </div>

        <div className="cat-detail-stats-grid">
          <div className="cat-stat-box">
            <span className="cat-stat-num">{count}</span>
            <span className="cat-stat-lbl">{count === 1 ? 'Payment' : 'Payments'}</span>
          </div>
          <div className="cat-stat-box">
            <span className="cat-stat-num">{pct}%</span>
            <span className="cat-stat-lbl">Of Period</span>
          </div>
          <div className="cat-stat-box">
            <span className="cat-stat-num">{fmt(avg)}</span>
            <span className="cat-stat-lbl">Average</span>
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: '16px', marginBottom: '8px' }}>
        <h3>Each amount paid ({count})</h3>
      </div>

      {txns.length === 0 ? (
        <Empty
          emoji={category.emoji}
          title="No payments"
          body={`No spending recorded in ${category.name} for ${range.label}.`}
        />
      ) : (
        <div className="cat-txns-list">
          {txns.map((t) => (
            <button
              key={t.id}
              type="button"
              className="cat-txn-item"
              onClick={() => {
                onClose()
                onOpenTxn(t)
              }}
              aria-label={`Payment of ${fmt(t.amountPaise)} at ${t.merchant}`}
            >
              <div className="cat-txn-left">
                <strong className="cat-txn-merchant">{t.merchant}</strong>
                <span className="cat-txn-date">{shortDateTime(t.transactionTime)}</span>
                {t.note && <span className="cat-txn-note">“{t.note}”</span>}
              </div>
              <div className="cat-txn-right">
                <span className="cat-txn-amount">{fmt(t.amountPaise)}</span>
                <span className="cat-txn-badge">
                  {t.sourcePackage && t.sourcePackage !== 'manual' ? 'SMS' : 'Manual'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
