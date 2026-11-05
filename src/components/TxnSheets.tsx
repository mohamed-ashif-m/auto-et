import { useMemo, useState } from 'react'
import { Confirm, Field, Icon, Sheet } from './ui'
import { isAuto } from './TxnRow'
import { messageOf, useStore } from '../store/AppStore'
import { fromDateInput, shortDateTime, toDateInput } from '../lib/format'
import type { Transaction, TxnType } from '../lib/types'

/* ------------------------------------------------------------------ */
/* Add / edit                                                          */
/* ------------------------------------------------------------------ */

export function TxnFormSheet({ initial, onClose }: { initial?: Transaction; onClose: () => void }) {
  const { settings, rules, addTransaction, updateTransaction, notify } = useStore()

  const [type, setType] = useState<TxnType>(initial?.type ?? 'EXPENSE')
  const [amount, setAmount] = useState(initial ? String(initial.amountPaise / 100) : '')
  const [merchant, setMerchant] = useState(initial?.merchant ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'Other')
  const [touched, setTouched] = useState(!!initial)
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(toDateInput(initial?.transactionTime ?? Date.now()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = toDateInput(Date.now())

  // Auto-pick a category from the user's own smart rules while they type.
  const onMerchant = (value: string) => {
    setMerchant(value)
    if (touched) return
    const lower = value.toLowerCase()
    const hit = rules.find((r) => r.keyword && lower.includes(r.keyword.toLowerCase()))
    if (hit) setCategory(hit.category)
  }

  const quickDates = useMemo(() => {
    const d = new Date()
    const yesterday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
    return [
      { label: 'Today', value: toDateInput(d.getTime()) },
      { label: 'Yesterday', value: toDateInput(yesterday.getTime()) },
    ]
  }, [])

  const save = async () => {
    const value = Number(amount)
    if (!merchant.trim()) return setError('Enter a description or merchant name.')
    if (!Number.isFinite(value) || value <= 0) return setError('Enter a valid amount.')
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return setError('Use up to two decimal places.')

    setSaving(true)
    setError('')
    try {
      const base = initial?.transactionTime ?? Date.now()
      const payload = {
        amountPaise: Math.round(value * 100),
        merchant: merchant.trim(),
        type,
        category,
        note: note.trim() || undefined,
        transactionTime: fromDateInput(date, base),
      }
      if (initial) await updateTransaction(initial.id, payload)
      else await addTransaction(payload)
      notify(initial ? 'Changes saved' : 'Transaction added')
      onClose()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={initial ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <div className="seg-big" role="tablist" aria-label="Transaction type">
        <button className={type === 'EXPENSE' ? 'on out' : ''} onClick={() => setType('EXPENSE')}>
          <Icon name="down" size={18} /> Spent
        </button>
        <button className={type === 'INCOME' ? 'on in' : ''} onClick={() => setType('INCOME')}>
          <Icon name="up" size={18} /> Earned
        </button>
      </div>

      <div className={`amount-box ${type === 'INCOME' ? 'in' : 'out'}`}>
        <span>₹</span>
        <input
          autoFocus={!initial}
          inputMode="decimal"
          placeholder="0"
          aria-label="Amount in rupees"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
        />
      </div>

      <Field label="What was it for?">
        <input
          type="text"
          placeholder="e.g. Chai with Priya"
          value={merchant}
          maxLength={60}
          onChange={(e) => onMerchant(e.target.value)}
        />
      </Field>

      <div className="field">
        <span className="field-label">Category</span>
        <div className="cat-grid">
          {settings.categories.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`cat-pick ${category === c.name ? 'on' : ''}`}
              onClick={() => {
                setCategory(c.name)
                setTouched(true)
              }}
            >
              <span className="tile sm" style={{ background: c.color }}>{c.emoji}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Field label="Date" group>
        <div className="row gap wrap">
          {quickDates.map((q) => (
            <button key={q.label} type="button" className={`chip ${date === q.value ? 'on' : ''}`} onClick={() => setDate(q.value)}>
              {q.label}
            </button>
          ))}
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </Field>

      <Field label="Note (optional)">
        <input type="text" placeholder="Anything worth remembering" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn big block" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : initial ? 'Save changes' : type === 'INCOME' ? 'Add income' : 'Add expense'}
      </button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

export function TxnDetailSheet({
  txn,
  onClose,
  onEdit,
}: {
  txn: Transaction
  onClose: () => void
  onEdit: (t: Transaction) => void
}) {
  const { catOf, fmt, deleteTransaction, notify } = useStore()
  const [confirming, setConfirming] = useState(false)
  const cat = catOf(txn.category)
  const income = txn.type === 'INCOME'

  const remove = async () => {
    try {
      await deleteTransaction(txn.id)
      notify('Transaction deleted')
      onClose()
    } catch (e) {
      notify(messageOf(e), 'error')
      setConfirming(false)
    }
  }

  return (
    <>
      <Sheet title="Transaction" onClose={onClose}>
        <div className={`detail-hero tone ${income ? 't-lime' : 't-coral'}`}>
          <span className="tile lg" style={{ background: cat.color }}>{cat.emoji}</span>
          <div>
            <p className="detail-kind">{income ? 'Money in' : 'Money out'}</p>
            <h3>{income ? '+' : '−'}{fmt(txn.amountPaise)}</h3>
          </div>
        </div>

        <dl className="detail-list">
          <div><dt>Paid to</dt><dd>{txn.merchant || 'Unknown'}</dd></div>
          <div><dt>Category</dt><dd>{cat.emoji} {cat.name}</dd></div>
          <div><dt>When</dt><dd>{shortDateTime(txn.transactionTime)}</dd></div>
          <div>
            <dt>Added by</dt>
            <dd>{isAuto(txn) ? 'Auto-detected from SMS' : 'You, manually'}</dd>
          </div>
          {txn.note && <div><dt>Note</dt><dd>{txn.note}</dd></div>}
        </dl>

        <div className="row gap">
          <button className="btn coral grow" onClick={() => setConfirming(true)}>
            <Icon name="trash" size={18} /> Delete
          </button>
          <button className="btn grow" onClick={() => onEdit(txn)}>
            <Icon name="edit" size={18} /> Edit
          </button>
        </div>
      </Sheet>

      {confirming && (
        <Confirm
          title="Delete this transaction?"
          body="It will be removed from your totals and charts. This can't be undone."
          confirmLabel="Delete"
          danger
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
