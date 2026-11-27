/* This module intentionally exports the provider plus its hooks/helpers. */
/* eslint-disable react-refresh/only-export-components */
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
import type { PluginListenerHandle } from '@capacitor/core'
import TransactionPlugin from '../plugins/transactionPlugin'
import type { TransactionInput } from '../plugins/transactionPlugin'
import { DEFAULT_SETTINGS, ACCENTS, COLOR_LIST } from '../lib/defaults'
import {
  categoryNameError, fallbackCategory, newCategoryId, normaliseCategories,
  otherCategoryName, planRename, resolveImportedCategoryName,
} from '../lib/categories'
import { money, moneyShort } from '../lib/format'
import { toCsv } from '../lib/analytics'
import type { ImportRow } from '../lib/csv'
import { dedupeRows, transactionsFingerprint } from '../lib/importDedupe'
import type { Category, Loan, Rule, Settings, Transaction } from '../lib/types'

const CACHE_KEY = 'autoet.settings.cache'
const RULES_CACHE_KEY = 'autoet.rules.cache'
const LOANS_CACHE_KEY = 'autoet.loans.cache'
const INTRO_KEY = 'autoet.intro.done'

/** True when this device has been used before (intro seen, or settings already saved). */
function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === '1' || localStorage.getItem(CACHE_KEY) !== null
  } catch {
    return false
  }
}

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
  autoTrackOn: boolean | null
  introOpen: boolean
  openIntro: () => void
  finishIntro: () => void

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
  importTransactions: (
    rows: ImportRow[],
  ) => Promise<{ added: number; duplicates: number; failed: number; duplicateRows: ImportRow[] }>
  openAutoTrackSettings: () => Promise<void>
  notify: (text: string, tone?: 'ok' | 'error') => void
}

const StoreContext = createContext<Store | null>(null)

/* Toasts live in their own context: showing one must not re-render every screen. */
const ToastContext = createContext<Toast | null>(null)

export function useToast(): Toast | null {
  return useContext(ToastContext)
}

export function ToastHost() {
  const toast = useToast()
  if (!toast) return null
  return (
    <div key={toast.id} className={`toast ${toast.tone}`} role="status">
      {toast.text}
    </div>
  )
}

function mergeSettings(saved: Partial<Settings> | null): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) }
  // Identity-based migration: a renamed predefined keeps its id and its place
  // in the saved list; only genuinely missing predefineds are appended.
  merged.categories = normaliseCategories(saved?.categories ?? DEFAULT_SETTINGS.categories)
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
  const firstLoadDone = useRef(false)
  // First launch ever: open the welcome tour straight away (no flash of the empty app).
  const [introOpen, setIntroOpen] = useState(() => !hasSeenIntro())

  const openIntro = useCallback(() => setIntroOpen(true), [])
  const finishIntro = useCallback(() => {
    setIntroOpen(false)
    try {
      localStorage.setItem(INTRO_KEY, '1')
    } catch {
      /* storage unavailable — the tour may show again next launch */
    }
    TransactionPlugin.setValue({ key: 'introDone', value: '1' }).catch(() => {})
  }, [])

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
  const fingerprint = useRef(transactionsFingerprint([]))
  const refreshInFlight = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async (silent = false) => {
    // Coalesce simultaneous triggers (focus + visibilitychange, native event +
    // resume) into a single bridge / SQLCipher read.
    if (refreshInFlight.current) {
      await refreshInFlight.current
      return
    }
    const task = (async () => {
      if (!silent) setLoading(true)
      try {
        const result = await TransactionPlugin.getTransactions()
        const next = result.transactions ?? []
        const nextFingerprint = transactionsFingerprint(next)
        if (nextFingerprint !== fingerprint.current) {
          fingerprint.current = nextFingerprint
          setTransactions(next)
        }
        setError('')
      } catch (err) {
        console.error('Transaction loading failed:', err)
        if (!silent) setError('Unable to load transactions. Please try again.')
      } finally {
        if (!silent) setLoading(false)
      }
    })()
    refreshInFlight.current = task
    try {
      await task
    } finally {
      refreshInFlight.current = null
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
        const [s, r, l, intro] = await Promise.all([
          TransactionPlugin.getValue({ key: 'settings' }),
          TransactionPlugin.getValue({ key: 'rules' }),
          TransactionPlugin.getValue({ key: 'loans' }),
          TransactionPlugin.getValue({ key: 'introDone' }),
        ])
        // Web storage was cleared but the encrypted DB remembers this person: skip the tour.
        if (intro.value || s.value) {
          setIntroOpen(false)
          try {
            localStorage.setItem(INTRO_KEY, '1')
          } catch {
            /* ignore */
          }
        }
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
    void Promise.resolve().then(refreshAutoTrack)
    firstLoadDone.current = true
  }, [refresh, refreshAutoTrack])

  // The native listener inserts SMS transactions even when the WebView is
  // paused. It pushes an event; there is no polling while the app is idle.
  useEffect(() => {
    let cancelled = false
    let handle: PluginListenerHandle | null = null
    void TransactionPlugin.addListener('transactionsChanged', () => {
      if (document.visibilityState !== 'visible') return // the resume handler will read it
      void refresh(true)
    })
      .then((h) => {
        if (cancelled) void h.remove()
        else handle = h
      })
      .catch((err: unknown) => console.error('Transaction event registration failed:', err))
    return () => {
      cancelled = true
      if (handle) void handle.remove()
    }
  }, [refresh])

  // Resume / visibility are the only time-driven refreshes, and they are
  // coalesced by a single one-shot timer plus the in-flight guard in refresh.
  const wakeTimer = useRef<number | null>(null)
  const wake = useCallback(() => {
    if (!firstLoadDone.current || document.visibilityState !== 'visible') return
    if (wakeTimer.current !== null) return
    wakeTimer.current = window.setTimeout(() => {
      wakeTimer.current = null
      void refresh(true)
      void refreshAutoTrack()
    }, 120)
  }, [refresh, refreshAutoTrack])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', wake)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', wake)
      if (wakeTimer.current !== null) window.clearTimeout(wakeTimer.current)
    }
  }, [wake])

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
  /** Awaiting version used by the atomic rename flow. */
  const writeSettings = useCallback((next: Settings) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    return TransactionPlugin.setValue({ key: 'settings', value: JSON.stringify(next) })
      // Budget/cycle/alert changes may cross the 10% line, so re-check natively.
      .then(() => TransactionPlugin.checkBudgetAlert())
  }, [])

  const persistSettings = useCallback(
    (next: Settings) => {
      void writeSettings(next).catch((e) => console.error('Saving settings failed:', e))
    },
    [writeSettings],
  )

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

  /** Awaiting version used by the atomic rename flow. */
  const writeRules = useCallback((next: Rule[]) => {
    localStorage.setItem(RULES_CACHE_KEY, JSON.stringify(next))
    // The Java notification listener reads this key to auto-categorise SMS payments.
    return TransactionPlugin.setValue({ key: 'rules', value: JSON.stringify(next) })
  }, [])

  const saveRules = useCallback(
    (next: Rule[]) => {
      setRules(next)
      void writeRules(next).catch((e) => console.error('Saving rules failed:', e))
    },
    [writeRules],
  )

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
      const invalid = categoryNameError(name, settings.categories, category.id)
      if (invalid) throw new Error(invalid)

      // Identity first: the sheet supplies the stable id, with the old name as
      // a fallback for callers that only know the name.
      const current =
        settings.categories.find((c) => c.id === category.id) ??
        settings.categories.find((c) => c.name === originalName)

      if (!current || current.name === name) {
        const clean: Category = current
          ? { ...current, ...category, name, id: current.id, defaultName: current.defaultName }
          : { ...category, id: category.id || newCategoryId(name), name }
        const categories = current
          ? settings.categories.map((c) => (c.id === current.id ? clean : c))
          : [...settings.categories, clean] // new customs are appended at the end
        patchSettings({ categories })
        return
      }

      // Rename (predefined categories included): all native writes are awaited
      // before React state is committed. A failure rolls the DB and both kv
      // keys back, so the user never sees half-renamed data.
      const plan = planRename(settings.categories, rules, settings.categoryBudgets, current.id, name)
      try {
        await TransactionPlugin.reassignCategory({ from: current.name, to: name })
        await writeSettings({ ...settings, ...plan })
        await writeRules(plan.rules)
        await refresh(true)
        setSettings((prev) => ({ ...prev, ...plan }))
        setRules(plan.rules)
      } catch (err) {
        try {
          await TransactionPlugin.reassignCategory({ from: name, to: current.name })
          await writeSettings(settings)
          await writeRules(rules)
          await refresh(true)
        } catch (rollbackErr) {
          console.error('Category rename rollback failed:', rollbackErr)
        }
        throw err
      }
    },
    [settings, rules, patchSettings, writeSettings, writeRules, refresh],
  )

  const deleteCategory = useCallback(
    async (name: string) => {
      const target = settings.categories.find((c) => c.name === name)
      if (!target) return
      if (target.builtin) throw new Error('Predefined categories cannot be deleted.')
      // The fallback follows the id of "Other", even if it was renamed.
      await TransactionPlugin.reassignCategory({ from: name, to: otherCategoryName(settings.categories) })
      saveRules(rules.filter((r) => r.category !== name))
      const budgets = { ...settings.categoryBudgets }
      delete budgets[name]
      patchSettings({
        categories: settings.categories.filter((c) => c.id !== target.id),
        categoryBudgets: budgets,
      })
      await refresh(true)
      void TransactionPlugin.checkBudgetAlert().catch(() => {})
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

  /** Adds parsed rows that are not exact matches already in the database. */
  const importTransactions = useCallback(
    async (rows: ImportRow[]) => {
      const { accepted, duplicates } = dedupeRows(transactions, rows)

      // Match today's names first, then ORIGINAL names of renamed predefined
      // categories; only genuinely new names become custom categories.
      const categories = [...settings.categories]
      const fallback = otherCategoryName(settings.categories)
      const resolve = (raw: string): string => {
        const mapped = resolveImportedCategoryName(raw, settings.categories)
        if (mapped) return mapped
        const name = raw.trim().slice(0, 40) || fallback
        categories.push({
          id: newCategoryId(name),
          name,
          emoji: '🏷️',
          color: COLOR_LIST[categories.length % COLOR_LIST.length],
        })
        return name
      }

      let failed = 0
      for (const row of accepted) {
        try {
          await TransactionPlugin.addTransaction({ ...row, category: resolve(row.category) })
        } catch (err) {
          console.error('Import row failed:', err)
          failed += 1
        }
      }

      if (categories.length !== settings.categories.length) patchSettings({ categories })
      await refresh(true)
      void TransactionPlugin.checkBudgetAlert().catch(() => {})
      return {
        added: accepted.length - failed,
        duplicates: duplicates.length,
        failed,
        duplicateRows: duplicates,
      }
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
    (name: string) => {
      const hit = catMap.get(name)
      if (hit) return hit
      const base = fallbackCategory(settings.categories)
      return name ? { ...base, name } : base
    },
    [catMap, settings.categories],
  )
  const fmt = useCallback((p: number) => money(p, settings.hideAmounts), [settings.hideAmounts])
  const fmtShort = useCallback(
    (p: number) => moneyShort(p, settings.hideAmounts),
    [settings.hideAmounts],
  )

  const value = useMemo<Store>(
    () => ({
      transactions,
      loading,
      error,
      settings,
      rules,
      loans,
      autoTrackOn,
      introOpen,
      openIntro,
      finishIntro,
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
    }),
    [
      transactions, loading, error, settings, rules, loans, autoTrackOn, introOpen,
      openIntro, finishIntro, fmt, fmtShort, catOf, refresh, addTransaction,
      updateTransaction, deleteTransaction, patchSettings, saveRules, saveLoans,
      saveCategory, deleteCategory, clearAll, exportData, importTransactions,
      refreshAutoTrack, openAutoTrackSettings, notify,
    ],
  )

  const toastValue = useMemo(() => toast, [toast])

  return (
    <StoreContext.Provider value={value}>
      <ToastContext.Provider value={toastValue}>{children}</ToastContext.Provider>
    </StoreContext.Provider>
  )
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export { messageOf }
