
import { useCallback, useEffect, useMemo, useState } from 'react'
import TransactionPlugin, {
  type Transaction,
} from './plugins/transactionPlugin'
import './App.css'

const formatCurrency = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100)

const CATEGORIES = [
  'Online Payment',
  'Cash',
  'Food & Dining',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Healthcare',
  'Entertainment',
  'Other',
]

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL')
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [editCategory, setEditCategory] = useState('Other')
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [categorySaving, setCategorySaving] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMerchant, setNewMerchant] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newType, setNewType] =
    useState<'EXPENSE' | 'INCOME'>('EXPENSE')

  const [newCategory, setNewCategory] = useState('Other')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const loadTransactions = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await TransactionPlugin.getTransactions()
      setTransactions(result.transactions)
    } catch (err) {
      console.error('Transaction loading failed:', err)
      setError('Unable to load transactions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])
  const handleAddTransaction = async () => {
    const amount = Number(newAmount)

    if (!newMerchant.trim()) {
      setFormError('Enter a description or merchant name.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a valid amount.')
      return
    }

    if (!/^\d+(\.\d{1,2})?$/.test(newAmount.trim())) {
      setFormError('Use up to two decimal places.')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      await TransactionPlugin.addTransaction({
        amountPaise: Math.round(amount * 100),
        merchant: newMerchant.trim(),
        type: newType,
        category: newCategory,
      })

      setNewMerchant('')
      setNewAmount('')
      setNewType('EXPENSE')
      setNewCategory('Other')
      setShowAddForm(false)

      await loadTransactions()
    } catch (err) {
      console.error('Saving transaction failed:', err)
      setFormError(
        err instanceof Error ? err.message : String(err)
      )
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCategory = async () => {
    if (!selectedTransaction) return

    setCategorySaving(true)
    setCategoryError('')

    try {
      await TransactionPlugin.updateCategory({
        transactionId: selectedTransaction.id,
        category: editCategory,
      })

      const updatedTransaction = {
        ...selectedTransaction,
        category: editCategory,
      }

      setTransactions((previous) =>
        previous.map((transaction) =>
          transaction.id === selectedTransaction.id
            ? updatedTransaction
            : transaction
        )
      )

      setSelectedTransaction(updatedTransaction)
      setIsEditingCategory(false)
    } catch (err) {
      console.error('Category update failed:', err)
      setCategoryError(
        err instanceof Error ? err.message : String(err)
      )
    } finally {
      setCategorySaving(false)
    }
  }

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  const summary = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === 'INCOME')
      .reduce((total, item) => total + item.amountPaise, 0)

    const expenses = transactions
      .filter((item) => item.type === 'EXPENSE')
      .reduce((total, item) => total + item.amountPaise, 0)

    return {
      income,
      expenses,
      balance: income - expenses,
    }
  }, [transactions])
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch = (transaction.merchant || 'Unknown merchant')
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim())

      const matchesFilter =
        filter === 'ALL' || transaction.type === filter

      return matchesSearch && matchesFilter
    })
  }, [transactions, searchQuery, filter])

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Auto Et</h1>
          <p>Your personal finance overview</p>
        </div>

        <button
          className="refresh-button"
          onClick={loadTransactions}
          disabled={loading}
          aria-label="Refresh transactions"
        >
          ↻
        </button>
      </header>

      <section className="balance-card">
        <p className="card-label">Total balance</p>
        <h2>{formatCurrency(summary.balance)}</h2>

        <div className="balance-details">
          <span>Income: {formatCurrency(summary.income)}</span>
          <span>Expenses: {formatCurrency(summary.expenses)}</span>
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-icon income-icon">↗</span>
          <p>Total income</p>
          <h3>{formatCurrency(summary.income)}</h3>
        </article>

        <article className="summary-card">
          <span className="summary-icon expense-icon">↘</span>
          <p>Total expenses</p>
          <h3>{formatCurrency(summary.expenses)}</h3>
        </article>
      </section>

      <section className="transactions-section">
        <div className="section-heading">
          <div>
            <h2>Recent transactions</h2>
            <p>{transactions.length} transactions recorded</p>
          </div>

          <button
            className="add-transaction-button"
            onClick={() => {
              setFormError('')
              setShowAddForm(true)
            }}
          >
            + Add
          </button>
        </div>
        {showAddForm && (
          <div className="manual-form">
            <h3>Add transaction</h3>

            <label htmlFor="merchant">Description / Merchant</label>
            <input
              id="merchant"
              type="text"
              placeholder="e.g. Grocery store"
              value={newMerchant}
              onChange={(e) => setNewMerchant(e.target.value)}
            />

            <label htmlFor="amount">Amount (₹)</label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 250.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />

            <label htmlFor="transaction-type">Transaction type</label>
            <select
              id="transaction-type"
              value={newType}
              onChange={(e) =>
                setNewType(e.target.value as 'EXPENSE' | 'INCOME')
              }
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
            <label htmlFor="transaction-category">Category</label>
            <select
              id="transaction-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {formError && <p className="form-error">{formError}</p>}

            <div className="form-actions">
              <button
                className="cancel-button"
                onClick={() => setShowAddForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="save-button"
                onClick={handleAddTransaction}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save transaction'}
              </button>
            </div>
          </div>
        )}
        <div className="transaction-controls">
          <input
            type="search"
            placeholder="Search merchant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-buttons">
            {(['ALL', 'EXPENSE', 'INCOME'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={filter === option ? 'active-filter' : ''}
                onClick={() => setFilter(option)}
              >
                {option === 'ALL' ? 'All' :
                  option === 'EXPENSE' ? 'Expenses' : 'Income'}
              </button>
            ))}
          </div>
        </div>
        {loading && (
          <p className="status-message">Loading transactions...</p>
        )}

        {!loading && error && (
          <div className="empty-state">
            <p>{error}</p>
            <button onClick={loadTransactions}>Try again</button>
          </div>
        )}

        {!loading && !error && filteredTransactions.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">₹</div>
            <h3>No transactions found</h3>
            <p>Try changing your search or filter.</p>
          </div>
        )}

        {!loading && !error && filteredTransactions.length > 0 && (
          <div className="transaction-list">
            {filteredTransactions.map((transaction) => {
              const isIncome = transaction.type === 'INCOME'

              return (
                <article
                  className="transaction-item"
                  key={transaction.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedTransaction(transaction)
                    setEditCategory(transaction.category || 'Other')
                    setIsEditingCategory(false)
                    setCategoryError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedTransaction(transaction)
                      setEditCategory(transaction.category || 'Other')
                      setIsEditingCategory(false)
                      setCategoryError('')
                    }
                  }}
                >
                  <div
                    className={`transaction-icon ${isIncome ? 'income-icon' : 'expense-icon'
                      }`}
                  >
                    {isIncome ? '↙' : '↗'}
                  </div>

                  <div className="transaction-info">
                    <h3>{transaction.merchant || 'Unknown merchant'}</h3>
                    <p>
                      {transaction.type} ·{' '}
                      {new Date(
                        transaction.transactionTime,
                      ).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <strong
                    className={isIncome ? 'income-text' : 'expense-text'}
                  >
                    {isIncome ? '+' : '−'}
                    {formatCurrency(transaction.amountPaise)}
                  </strong>
                </article>
              )
            })}
          </div>
        )}
      </section>
      {selectedTransaction && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedTransaction(null)}
        >
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="transaction-detail-title">Transaction details</h2>

              <button
                className="modal-close"
                onClick={() => setSelectedTransaction(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="modal-amount">
              <p>{selectedTransaction.type}</p>
              <h3>
                {formatCurrency(selectedTransaction.amountPaise)}
              </h3>
            </div>

            <div className="detail-row">
              <span>Merchant</span>
              <strong>{selectedTransaction.merchant || 'Unknown'}</strong>
            </div>


            <div className="detail-row">
              <span>Category</span>
              <strong>{selectedTransaction.category || 'Other'}</strong>

              <button
                type="button"
                onClick={() => {
                  setEditCategory(selectedTransaction.category || 'Other')
                  setIsEditingCategory(true)
                  setCategoryError('')
                }}
              >
                Edit Category
              </button>
            </div>

            {isEditingCategory && (
              <div className="manual-form">
                <label htmlFor="edit-category">Select category</label>

                <select
                  id="edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                {categoryError && (
                  <p className="form-error">{categoryError}</p>
                )}

                <div className="form-actions">
                  <button
                    className="cancel-button"
                    onClick={() => setIsEditingCategory(false)}
                    disabled={categorySaving}
                  >
                    Cancel
                  </button>

                  <button
                    className="save-button"
                    onClick={handleUpdateCategory}
                    disabled={categorySaving}
                  >
                    {categorySaving ? 'Saving...' : 'Save Category'}
                  </button>
                </div>
              </div>
            )}


            <div className="detail-row">
              <span>Transaction ID</span>
              <strong>{selectedTransaction.id}</strong>
            </div>

            <div className="detail-row">
              <span>Date and time</span>
              <strong>
                {new Date(
                  selectedTransaction.transactionTime,
                ).toLocaleString('en-IN')}
              </strong>
            </div>

            <div className="detail-row">
              <span>Currency</span>
              <strong>{selectedTransaction.currency}</strong>
            </div>

            <div className="detail-row">
              <span>Source application</span>
              <strong>
                {selectedTransaction.sourcePackage === 'com.android.shell'
                  ? 'Test notification (emulator)'
                  : selectedTransaction.sourcePackage || 'Manual entry'}
              </strong>
            </div>

            <button
              className="modal-done"
              onClick={() => setSelectedTransaction(null)}
            >
              Done
            </button>
          </section>
        </div>
      )}

      <footer className="app-footer">
        <span>Auto Et</span>
        <span>Private · Local storage</span>
      </footer>
    </main>
  )
}

export default App
