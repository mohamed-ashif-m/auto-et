import { useMemo, useState } from 'react'
import { Empty, Field, Icon, Meter, Sheet, Stepper } from '../components/ui'
import { messageOf, useStore } from '../store/AppStore'
import { inRange, summarize, sumExpense } from '../lib/analytics'
import { rangeFor } from '../lib/period'

const STEP = 50000 // ₹500 in paise

type Editing =
  | { kind: 'overall' }
  | { kind: 'category'; category?: string }
  | null

export function Budget() {
  const { transactions, settings, patchSettings, fmt, catOf } = useStore()
  const [editing, setEditing] = useState<Editing>(null)

  const range = useMemo(() => rangeFor('month', 0, settings.startDay), [settings.startDay])
  const rows = useMemo(() => inRange(transactions, range), [transactions, range])
  const sum = useMemo(() => summarize(rows), [rows])

  const budget = settings.monthlyBudget
  const left = budget - sum.expense
  const daysLeft = Math.max(1, Math.ceil((range.end - Date.now()) / 86400000))

  const budgeted = Object.entries(settings.categoryBudgets).filter(([name]) =>
    settings.categories.some((c) => c.name === name),
  )

  // Savings goal: a share of this month's income.
  const target = Math.round((sum.income * settings.savingsPct) / 100)
  const saved = Math.max(0, sum.net)

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1 className="page-title">Budget</h1>
          <p className="muted">{range.label}</p>
        </div>
      </header>

      <section className="card tone t-coral">
        <div className="chip-label">Monthly limit</div>
        <Stepper
          label="monthly budget"
          value={budget}
          display={budget > 0 ? fmt(budget) : 'Not set'}
          onMinus={() => patchSettings({ monthlyBudget: Math.max(0, budget - STEP) })}
          onPlus={() => patchSettings({ monthlyBudget: budget + STEP })}
          onValueClick={() => setEditing({ kind: 'overall' })}
        />

        {budget > 0 ? (
          <>
            <Meter ratio={sum.expense / budget} tall />
            <p className="meter-text">
              <b>{fmt(sum.expense)}</b> spent · {left >= 0 ? <><b>{fmt(left)}</b> left</> : <><b>{fmt(-left)}</b> over</>}
            </p>
            {left > 0 && (
              <p className="meter-text">
                Safe to spend <b>{fmt(Math.floor(left / daysLeft / 100) * 100)}</b> a day for the next {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.
              </p>
            )}
          </>
        ) : (
          <p className="meter-text">Set a monthly limit and Auto Et will show how much you can still spend each day.</p>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Category limits</h2>
          <button className="btn sm" onClick={() => setEditing({ kind: 'category' })}>
            <Icon name="plus" size={16} /> Add
          </button>
        </div>

        {budgeted.length === 0 ? (
          <p className="muted">Cap the categories that tend to run away — food, shopping, rides.</p>
        ) : (
          <ul className="budget-list">
            {budgeted.map(([name, limit]) => {
              const c = catOf(name)
              const spent = sumExpense(rows, name)
              return (
                <li key={name}>
                  <button className="budget-row" onClick={() => setEditing({ kind: 'category', category: name })}>
                    <span className="tile sm" style={{ background: c.color }}>{c.emoji}</span>
                    <span className="grow">
                      <span className="rank-head">
                        <span className="rank-name">{c.name}</span>
                        <strong className={spent > limit ? 'neg' : ''}>{fmt(spent)} / {fmt(limit)}</strong>
                      </span>
                      <Meter ratio={limit ? spent / limit : 0} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card tone t-violet">
        <div className="chip-label">Savings goal</div>
        <Stepper
          label="savings percentage"
          value={settings.savingsPct}
          display={`${settings.savingsPct}%`}
          onMinus={() => patchSettings({ savingsPct: Math.max(0, settings.savingsPct - 5) })}
          onPlus={() => patchSettings({ savingsPct: Math.min(90, settings.savingsPct + 5) })}
        />
        {sum.income > 0 ? (
          <>
            <p className="meter-text">
              {settings.savingsPct}% of income = <b>{fmt(target)}</b> this month
            </p>
            <Meter ratio={target ? saved / target : 0} goal />
            <p className="meter-text">
              {saved >= target
                ? <>Goal met — you're <b>{fmt(saved - target)}</b> ahead. 🎉</>
                : <>Saved <b>{fmt(saved)}</b> so far, <b>{fmt(target - saved)}</b> to go.</>}
            </p>
          </>
        ) : (
          <p className="meter-text">Log some income this month to see your savings target.</p>
        )}
      </section>

      {transactions.length === 0 && (
        <Empty emoji="🎯" title="Budgets need data" body="Add a few transactions and your progress bars will come alive." />
      )}

      {editing && <BudgetSheet editing={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BudgetSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const { settings, patchSettings, catOf, notify } = useStore()
  const overall = editing.kind === 'overall'
  const existingCategory = editing.kind === 'category' ? editing.category : undefined

  const free = settings.categories.filter(
    (c) => !(c.name in settings.categoryBudgets) || c.name === existingCategory,
  )
  const [category, setCategory] = useState(existingCategory ?? free[0]?.name ?? '')
  const initial = overall ? settings.monthlyBudget : settings.categoryBudgets[existingCategory ?? ''] ?? 0
  const [amount, setAmount] = useState(initial ? String(initial / 100) : '')
  const [error, setError] = useState('')

  const save = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount above zero.')
    const paise = Math.round(value * 100)
    try {
      if (overall) patchSettings({ monthlyBudget: paise })
      else {
        if (!category) return setError('Pick a category.')
        patchSettings({ categoryBudgets: { ...settings.categoryBudgets, [category]: paise } })
      }
      notify('Budget saved')
      onClose()
    } catch (e) {
      setError(messageOf(e))
    }
  }

  const remove = () => {
    if (overall) patchSettings({ monthlyBudget: 0 })
    else {
      const next = { ...settings.categoryBudgets }
      delete next[category]
      patchSettings({ categoryBudgets: next })
    }
    notify('Budget removed')
    onClose()
  }

  return (
    <Sheet title={overall ? 'Monthly budget' : existingCategory ? `${catOf(existingCategory).name} limit` : 'New category limit'} onClose={onClose}>
      {!overall && !existingCategory && (
        <div className="field">
          <span className="field-label">Category</span>
          {free.length === 0 ? (
            <p className="muted">Every category already has a limit.</p>
          ) : (
            <div className="cat-grid">
              {free.map((c) => (
                <button key={c.name} className={`cat-pick ${category === c.name ? 'on' : ''}`} onClick={() => setCategory(c.name)}>
                  <span className="tile sm" style={{ background: c.color }}>{c.emoji}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Field label="Limit per month (₹)">
        <input
          autoFocus
          inputMode="decimal"
          placeholder="e.g. 5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
        />
      </Field>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="row gap">
        {initial > 0 && <button className="btn coral grow" onClick={remove}>Remove</button>}
        <button className="btn grow" onClick={save} disabled={!overall && free.length === 0}>Save</button>
      </div>
    </Sheet>
  )
}
