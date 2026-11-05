import { Fragment, useMemo, useState } from 'react'
import { Icon, Sheet } from './ui'
import { useStore } from '../store/AppStore'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
]

function fmtTableNum(paise: number, hide = false): string {
  if (hide) return '••••'
  const rupees = paise / 100
  const isNeg = rupees < 0
  const abs = Math.abs(rupees)
  const hasDecimals = paise % 100 !== 0
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: hasDecimals ? 2 : 0,
  }).format(abs)
  return isNeg ? `-${formatted}` : formatted
}

export function BalanceTableSheet({
  onClose,
  onSelectMonth,
}: {
  onClose: () => void
  onSelectMonth?: (year: number, month: number) => void
}) {
  const { transactions, settings, fmt } = useStore()

  // Available years from transactions
  const years = useMemo(() => {
    const set = new Set<number>()
    const currentYear = new Date().getFullYear()
    set.add(currentYear)
    for (const t of transactions) {
      set.add(new Date(t.transactionTime).getFullYear())
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [transactions])

  const [selectedYear, setSelectedYear] = useState<string>('All')

  // Filter transactions based on selected year
  const filteredTxns = useMemo(() => {
    if (selectedYear === 'All') return transactions
    const y = Number(selectedYear)
    return transactions.filter((t) => new Date(t.transactionTime).getFullYear() === y)
  }, [transactions, selectedYear])

  // Overall totals
  const totalExpense = useMemo(
    () => filteredTxns.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountPaise, 0),
    [filteredTxns],
  )
  const totalIncome = useMemo(
    () => filteredTxns.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountPaise, 0),
    [filteredTxns],
  )
  const totalBalance = totalIncome - totalExpense

  // Group by Year and Month
  const yearGroups = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const groups: Array<{
      year: number
      months: Array<{
        monthIndex: number
        name: string
        expense: number
        income: number
        balance: number
      }>
    }> = []

    const targetYears = selectedYear === 'All' ? years : [Number(selectedYear)]

    for (const yr of targetYears) {
      const maxMonth = yr === currentYear ? currentMonth : 11
      const monthsList = []

      for (let m = maxMonth; m >= 0; m--) {
        const monthTxns = transactions.filter((t) => {
          const d = new Date(t.transactionTime)
          return d.getFullYear() === yr && d.getMonth() === m
        })

        const exp = monthTxns.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountPaise, 0)
        const inc = monthTxns.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountPaise, 0)

        if (monthTxns.length > 0 || yr === currentYear) {
          monthsList.push({
            monthIndex: m,
            name: MONTH_NAMES[m],
            expense: exp,
            income: inc,
            balance: inc - exp,
          })
        }
      }

      if (monthsList.length > 0) {
        groups.push({ year: yr, months: monthsList })
      }
    }

    return groups
  }, [transactions, years, selectedYear])

  return (
    <Sheet title="Financial Table" onClose={onClose}>
      <div className="ft-view">
        {/* Top Controls: Filter & Active period badge */}
        <div className="ft-controls-row">
          <span className="ft-period-badge">
            <Icon name="chart" size={14} /> Monthly Ledger
          </span>

          <div className="ft-filter-select-wrap">
            <select
              className="ft-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Filter by year"
            >
              <option value="All">All Years</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
            <span className="ft-dropdown-arrow">▼</span>
          </div>
        </div>

        {/* Center Total Balance Summary Card (Neo-Brutalist) */}
        <section className="card tone t-violet ft-summary-hero">
          <span className="ft-summary-label">Total Balance</span>
          <h2 className="ft-balance-num">
            {settings.hideAmounts ? '••••' : fmt(totalBalance)}
          </h2>

          <div className="ft-split-stats">
            <div className="ft-split-col">
              <span className="ft-split-lbl">
                <Icon name="down" size={13} /> Expenses
              </span>
              <strong className="ft-split-val ft-val-coral">
                {fmtTableNum(totalExpense, settings.hideAmounts)}
              </strong>
            </div>
            <div className="ft-split-divider" />
            <div className="ft-split-col">
              <span className="ft-split-lbl">
                <Icon name="up" size={13} /> Income
              </span>
              <strong className="ft-split-val ft-val-lime">
                {fmtTableNum(totalIncome, settings.hideAmounts)}
              </strong>
            </div>
          </div>
        </section>

        {/* Monthly Ledger Table */}
        <section className="ft-table-wrapper">
          <table className="ft-ledger-table">
            <thead>
              <tr>
                <th className="ft-th-month">MONTH</th>
                <th className="ft-th-num">EXPENSES</th>
                <th className="ft-th-num">INCOME</th>
                <th className="ft-th-num">BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {yearGroups.map((group) => (
                <Fragment key={group.year}>
                  <tr className="ft-year-heading-row">
                    <td colSpan={4} className="ft-year-heading-td">
                      <span className="ft-year-pill">{group.year}</span>
                    </td>
                  </tr>
                  {group.months.map((m) => {
                    const isNeg = m.balance < 0
                    return (
                      <tr
                        key={`${group.year}-${m.monthIndex}`}
                        className="ft-month-row"
                        onClick={() => {
                          if (onSelectMonth) {
                            onSelectMonth(group.year, m.monthIndex)
                            onClose()
                          }
                        }}
                        title={`Select ${m.name} ${group.year}`}
                      >
                        <td className="ft-td-month">
                          <span className="ft-month-badge">{m.name}</span>
                        </td>
                        <td className="ft-td-num">
                          {fmtTableNum(m.expense, settings.hideAmounts)}
                        </td>
                        <td className="ft-td-num">
                          {fmtTableNum(m.income, settings.hideAmounts)}
                        </td>
                        <td className={`ft-td-num ${isNeg ? 'ft-neg' : 'ft-pos'}`}>
                          {fmtTableNum(m.balance, settings.hideAmounts)}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>

        <p className="muted center-text note-line" style={{ marginTop: '2px', fontSize: '11px' }}>
          💡 Tap any month row to jump directly to its summary.
        </p>
      </div>
    </Sheet>
  )
}
