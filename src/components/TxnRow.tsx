import { useStore } from '../store/AppStore'
import { shortDateTime } from '../lib/format'
import type { Transaction } from '../lib/types'

export const isAuto = (t: Transaction) => !!t.sourcePackage && t.sourcePackage !== 'manual'

export function TxnRow({ txn, onOpen, showDate = true }: { txn: Transaction; onOpen: (t: Transaction) => void; showDate?: boolean }) {
  const { catOf, fmt } = useStore()
  const cat = catOf(txn.category)
  const income = txn.type === 'INCOME'

  return (
    <button className="txn" onClick={() => onOpen(txn)}>
      <span className="tile" style={{ background: cat.color }} aria-hidden="true">
        {cat.emoji}
      </span>
      <span className="txn-main">
        <span className="txn-title">{txn.merchant || 'Unknown merchant'}</span>
        <span className="txn-sub">
          {cat.name}
          {showDate && ` · ${shortDateTime(txn.transactionTime)}`}
          {isAuto(txn) && <em className="badge">SMS</em>}
        </span>
      </span>
      <strong className={`amount ${income ? 'in' : 'out'}`}>
        {income ? '+' : '−'}
        {fmt(txn.amountPaise)}
      </strong>
    </button>
  )
}
