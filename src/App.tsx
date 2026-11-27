import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { handleBack, useBackHandler } from './lib/backStack'
import { Icon } from './components/ui'
import { Intro } from './components/Intro'
import { TxnDetailSheet, TxnFormSheet } from './components/TxnSheets'
import { Budget } from './screens/Budget'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import { StoreProvider, ToastHost, useStore } from './store/AppStore'
import type { Tab, Transaction } from './lib/types'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/intro.css'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'list' },
  { id: 'stats', label: 'Stats', icon: 'chart' },
  { id: 'budget', label: 'Budget', icon: 'target' },
]

type Sheet =
  | { kind: 'add' }
  | { kind: 'detail'; id: number }
  | { kind: 'edit'; txn: Transaction }
  | null

function Shell() {
  const { transactions, introOpen, refreshAutoTrack, notify } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [showSettings, setShowSettings] = useState(false)
  const lastBackRef = useRef(0)

  // Any layer above the tabs registers its own handler. Once those are closed,
  // a non-Home tab goes Home before the exit confirmation is allowed.
  useBackHandler(tab !== 'home', () => setTab('home'))

  // The only native back listener. In the browser (or without the plugin)
  // nothing is registered, so the JS layer stack is simply unused.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return undefined
    let handle: { remove: () => void } | undefined
    let cancelled = false
    const onBack = () => {
      if (handleBack()) {
        lastBackRef.current = 0
        return
      }
      const now = Date.now()
      if (now - lastBackRef.current < 2000) {
        void CapacitorApp.exitApp().catch(() => {})
      } else {
        lastBackRef.current = now
        notify('Press back again to exit')
      }
    }
    void CapacitorApp.addListener('backButton', onBack)
      .then((registered) => {
        if (cancelled) registered.remove()
        else handle = registered
      })
      .catch(() => {})
    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [notify])

  // Resolve the open transaction from live data so edits/deletes stay in sync.
  const detail = sheet?.kind === 'detail' ? transactions.find((t) => t.id === sheet.id) : undefined
  const open = (t: Transaction) => setSheet({ kind: 'detail', id: t.id })

  return (
    <div className="app">
      <main id="main">
        {tab === 'home' && (
          <Home onOpen={open} onAdd={() => setSheet({ kind: 'add' })} go={setTab} openSettings={() => setShowSettings(true)} />
        )}
        {tab === 'history' && <History onOpen={open} />}
        {tab === 'stats' && <Stats onOpen={open} />}
        {tab === 'budget' && <Budget />}
      </main>

      <button className="fab" onClick={() => setSheet({ kind: 'add' })} aria-label="Add transaction">
        <Icon name="plus" size={32} stroke={3.4} />
      </button>

      <nav className="nav" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id)
              window.scrollTo({ top: 0 })
            }}
          >
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {sheet?.kind === 'add' && <TxnFormSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'edit' && <TxnFormSheet initial={sheet.txn} onClose={() => setSheet(null)} />}
      {detail && (
        <TxnDetailSheet txn={detail} onClose={() => setSheet(null)} onEdit={(txn) => setSheet({ kind: 'edit', txn })} />
      )}

      {showSettings && (
        <Settings
          onClose={() => {
            setShowSettings(false)
            void refreshAutoTrack()
          }}
        />
      )}

      {introOpen && <Intro />}

      <ToastHost />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
