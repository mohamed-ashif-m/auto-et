import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import TransactionPlugin from '../plugins/transactionPlugin'
import type { TransactionInput } from '../plugins/transactionPlugin'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, ACCENTS, FALLBACK_CATEGORY, COLOR_LIST } from '../lib/defaults'
import { money, moneyShort } from '../lib/format'
import { toCsv } from '../lib/analytics'
import type { ImportRow } from '../lib/csv'
import type { Category, Loan, Rule, Settings, Transaction } from '../lib/types'

const CACHE_KEY = 'autoet.settings.cache'
const RULES_CACHE_KEY = 'autoet.rules.cache'
const LOANS_CACHE_KEY = 'autoet.loans.cache'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

interface Store {
  transactions: Transaction[]
  loading: boolean
  error: string
  settings: Settings
  rules: Rule[]
  loans: Loan[]
  toast: Toast | null
  autoTrackOn: boolean | null

  fmt: (paise: number) => string
  fmtShort: (paise: number) => string
  catOf: (name: string) => Category

  refresh: (silent?: boolean) => Promise<void>
  addTransaction: (input: TransactionInput) => Promise<void>
  updateTransaction: (id: number, input: TransactionInput & { transactionTime: number }) => Promise<void>
  deleteTransaction: (id: number) => Promise<void>
  patchSettings: (patch: Partial<Settings>) => void
  saveRules: (rules: Rule[]) => void
  saveLoans: (loans: Loan[]) => void
  saveCategory: (category: Category, originalName?: string) => Promise<void>
  deleteCategory: (name: string) => Promise<void>
  clearAll: () => Promise<void>
  exportData: () => Promise<void>
  refreshAutoTrack: () => Promise<void>
    importTransactions: (rows: ImportRow[]) => Promise<{ added: number; duplicates: number; failed: number }>
  openAutoTrackSettings: () => Promise<void>
  notify: (text: string, tone?: 'ok' | 'error') => void
}

const StoreContext = createContext<Store | null>(null)

function mergeSettings(saved: Partial<Settings> | null): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) }
  // Make sure every predefined category still exists, even if added in a later release.
  const byName = new Map((saved?.categories ?? []).map((c) => [c.name, c]))
  const builtins = DEFAULT_CATEGORIES.map((c) => ({ ...c, ...(byName.get(c.name) ?? {}), builtin: true }))
  const customs = (saved?.categories ?? []).filter((c) => !c.builtin)
  merged.categories = [...builtins, ...customs]
  if (!ACCENTS[merged.accent]) merged.accent = 'sun'
  return merged
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<Settings>(() =>
    mergeSettings(readCache<Settings>(CACHE_KEY)),
  )
  const [rules, setRules] = useState<Rule[]>(() => readCache<Rule[]>(RULES_CACHE_KEY) ?? [])
  const [loans, setLoans] = useState<Loan[]>(() => readCache<Loan[]>(LOANS_CACHE_KEY) ?? [])
  const [toast, setToast] = useState<Toast | null>(null)
  const [autoTrackOn, setAutoTrackOn] = useState<boolean | null>(null)
  const settingsLoaded = useRef(false)

  /* ---------- theme -> DOM ---------- */
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'auto' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    root.dataset.corners = settings.corners
    root.dataset.shadow = settings.shadow
    root.style.setProperty('--accent', ACCENTS[settings.accent]?.color ?? ACCENTS.sun.color)
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme, settings.corners, settings.shadow, settings.accent])

  /* ---------- toasts ---------- */
  const notify = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ id: Date.now(), text, tone })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  /* ---------- transactions ---------- */
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const result = await TransactionPlugin.getTransactions()
      setTransactions(result.transactions)
      setError('')
    } catch (err) {
      console.error('Transaction loading failed:', err)
      if (!silent) setError('Unable to load transactions. Please try again.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const refreshAutoTrack = useCallback(async () => {
    try {
      const r = await TransactionPlugin.isNotificationAccessEnabled()
      setAutoTrackOn(r.enabled)
    } catch {
      setAutoTrackOn(null)
    }
  }, [])

  // First load: settings + transactions + auto-track status.
  useEffect(() => {
    void (async () => {
      try {
        const [s, r, l] = await Promise.all([
          TransactionPlugin.getValue({ key: 'settings' }),
          TransactionPlugin.getValue({ key: 'rules' }),
          TransactionPlugin.getValue({ key: 'loans' }),
        ])
        if (s.value) setSettings(mergeSettings(JSON.parse(s.value)))
        if (r.value) setRules(JSON.parse(r.value))
        if (l.value) setLoans(JSON.parse(l.value))
      } catch (err) {
        console.error('Settings loading failed:', err)
      } finally {
        settingsLoaded.current = true
      }
    })()
    void refresh()
    void refreshAutoTrack()
  }, [refresh, refreshAutoTrack])

  // New SMS transactions arrive while the app is open or in the background.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') {
        void refresh(true)
        void refreshAutoTrack()
      }
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    const timer = window.setInterval(wake, 15000)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.clearInterval(timer)
    }
  }, [refresh, refreshAutoTrack])

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      await TransactionPlugin.addTransaction(input)
      await refresh(true)
      void TransactionPlugin.checkBudgetAlert().catch(() => {})
    },
    [refresh],
  )

  const updateTransaction = useCallback(
    async (id: number, input: TransactionInput & { transactionTime: number }) => {
      await TransactionPlugin.updateTransaction({ ...input, transactionId: id })
      await refresh(true)
      void TransactionPlugin.checkBudgetAlert().catch(() => {})
    },
    [refresh],
  )

  const deleteTransaction = useCallback(
    async (id: number) => {
      await TransactionPlugin.deleteTransaction({ transactionId: id })
      await refresh(true)
    },
    [refresh],
  )

  /* ---------- settings ---------- */
  const persistSettings = useCallback((next: Settings) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    TransactionPlugin.setValue({ key: 'settings', value: JSON.stringify(next) })
      // Budget/cycle/alert changes may cross the 10% line, so re-check natively.
      .then(() => TransactionPlugin.checkBudgetAlert())
      .catch((e) => console.error('Saving settings failed:', e))
  }, [])

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        persistSettings(next)
        return next
      })
    },
    [persistSettings],
  )

  const saveRules = useCallback((next: Rule[]) => {
    setRules(next)
    localStorage.setItem(RULES_CACHE_KEY, JSON.stringify(next))
    // The Java notification listener reads this key to auto-categorise SMS payments.
    TransactionPlugin.setValue({ key: 'rules', value: JSON.stringify(next) }).catch((e) =>
      console.error('Saving rules failed:', e),
    )
  }, [])

  const saveLoans = useCallback((next: Loan[]) => {
    setLoans(next)
    localStorage.setItem(LOANS_CACHE_KEY, JSON.stringify(next))
    TransactionPlugin.setValue({ key: 'loans', value: JSON.stringify(next) }).catch((e) =>
      console.error('Saving loans failed:', e),
    )
  }, [])

  const saveCategory = useCallback(
    async (category: Category, originalName?: string) => {
      const name = category.name.trim()
      if (!name) throw new Error('Give the category a name.')
      if (name.length > 40) throw new Error('Keep the name under 40 characters.')
      const clash = settings.categories.some(
        (c) => c.name.toLowerCase() === name.toLowerCase() && c.name !== originalName,
      )
      if (clash) throw new Error('A category with that name already exists.')

      const renamed = originalName && originalName !== name
      if (renamed) {
        const original = settings.categories.find((c) => c.name === originalName)
        if (original?.builtin) throw new Error('Predefined categories keep their name.')
        await TransactionPlugin.reassignCategory({ from: originalName, to: name })
        saveRules(rules.map((r) => (r.category === originalName ? { ...r, category: name } : r)))
        await refresh(true)
      }

      const clean: Category = { ...category, name }
      const exists = settings.categories.some((c) => c.name === (originalName ?? name))
      const categories = exists
        ? settings.categories.map((c) => (c.name === (originalName ?? name) ? { ...c, ...clean } : c))
        : [...settings.categories, clean]

      const budgets = { ...settings.categoryBudgets }
      if (renamed && originalName in budgets) {
        budgets[name] = budgets[originalName]
        delete budgets[originalName]
      }
      patchSettings({ categories, categoryBudgets: budgets })
    },
    [settings.categories, settings.categoryBudgets, rules, saveRules, patchSettings, refresh],
  )

  const deleteCategory = useCallback(
    async (name: string) => {
      const target = settings.categories.find((c) => c.name === name)
      if (!target) return
      if (target.builtin) throw new Error('Predefined categories cannot be deleted.')
      await TransactionPlugin.reassignCategory({ from: name, to: 'Other' })
      saveRules(rules.filter((r) => r.category !== name))
      const budgets = { ...settings.categoryBudgets }
      delete budgets[name]
      patchSettings({
        categories: settings.categories.filter((c) => c.name !== name),
        categoryBudgets: budgets,
      })
      await refresh(true)
    },
    [settings.categories, settings.categoryBudgets, rules, saveRules, patchSettings, refresh],
  )

  const clearAll = useCallback(async () => {
    await TransactionPlugin.clearAllTransactions()
    await refresh(true)
  }, [refresh])

  const exportData = useCallback(async () => {
    const stamp = new Date().toISOString().slice(0, 10)
    await TransactionPlugin.exportCsv({
      csv: toCsv([...transactions].sort((a, b) => b.transactionTime - a.transactionTime)),
      fileName: `auto-et-${stamp}.csv`,
    })
  }, [transactions])
    /** Adds parsed CSV rows, skipping ones that already exist and creating unknown categories. */
  const importTransactions = useCallback(
    async (rows: ImportRow[]) => {
      const keyOf = (time: number, paise: number, type: string, merchant: string) =>
        `${time}|${paise}|${type}|${merchant.trim().toLowerCase()}`
      const known = new Set(
        transactions.map((t) => keyOf(t.transactionTime, t.amountPaise, t.type, t.merchant || '')),
      )

      // Match categories case-insensitively; anything new becomes a custom category.
      const categories = [...settings.categories]
      const resolve = (raw: string): string => {
        const name = raw.trim().slice(0, 40)
        if (!name) return 'Other'
        const hit = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
        if (hit) return hit.name
        categories.push({ name, emoji: '🏷️', color: COLOR_LIST[categories.length % COLOR_LIST.length] })
        return name
      }

      let added = 0
      let duplicates = 0
      let failed = 0

      for (const row of rows) {
        const key = keyOf(row.transactionTime, row.amountPaise, row.type, row.merchant)
        if (known.has(key)) {
          duplicates += 1
          continue
        }
        try {
          await TransactionPlugin.addTransaction({ ...row, category: resolve(row.category) })
          known.add(key)
          added += 1
        } catch (err) {
          console.error('Import row failed:', err)
          failed += 1
        }
      }

      if (categories.length !== settings.categories.length) patchSettings({ categories })
      await refresh(true)
      void TransactionPlugin.checkBudgetAlert().catch(() => {})
      return { added, duplicates, failed }
    },
    [transactions, settings.categories, patchSettings, refresh],
  )
  const openAutoTrackSettings = useCallback(async () => {
    await TransactionPlugin.openNotificationAccessSettings()
  }, [])

  /* ---------- derived helpers ---------- */
  const catMap = useMemo(
    () => new Map(settings.categories.map((c) => [c.name, c])),
    [settings.categories],
  )
  const catOf = useCallback(
    (name: string) => catMap.get(name) ?? { ...FALLBACK_CATEGORY, name: name || 'Other' },
    [catMap],
  )
  const fmt = useCallback((p: number) => money(p, settings.hideAmounts), [settings.hideAmounts])
  const fmtShort = useCallback(
    (p: number) => moneyShort(p, settings.hideAmounts),
    [settings.hideAmounts],
  )

  const value: Store = {
    transactions,
    loading,
    error,
    settings,
    rules,
    loans,
    toast,
    autoTrackOn,
    fmt,
    fmtShort,
    catOf,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    patchSettings,
    saveRules,
    saveLoans,
    saveCategory,
    deleteCategory,
    clearAll,
    exportData,
    importTransactions,
    refreshAutoTrack,
    openAutoTrackSettings,
    notify,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export { messageOf }
