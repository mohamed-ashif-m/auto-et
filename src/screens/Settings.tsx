import { useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Confirm, Field, Icon, Segmented, Sheet, Stepper, Toggle } from '../components/ui'
import { messageOf, useStore } from '../store/AppStore'
import { parseTransactionsCsv } from '../lib/csv'
import { ACCENTS, COLOR_LIST, EMOJI_CHOICES } from '../lib/defaults'
import type { Category, CornerStyle, ShadowStyle, ThemeMode } from '../lib/types'

type Page = 'main' | 'categories' | 'rules'

export function Settings({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<Page>('main')
  const title = page === 'main' ? 'Settings' : page === 'categories' ? 'Categories' : 'Smart rules'

  return (
    <div className="page-overlay">
      <div className="page">
        <header className="top">
          <button
            className="icon-btn white"
            onClick={() => (page === 'main' ? onClose() : setPage('main'))}
            aria-label={page === 'main' ? 'Close settings' : 'Back to settings'}
          >
            <Icon name="left" />
          </button>
          <h1 className="page-title grow">{title}</h1>
        </header>

        {page === 'main' && <Main go={setPage} />}
        {page === 'categories' && <Categories />}
        {page === 'rules' && <Rules />}
      </div>
    </div>
  )
}

function Group({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="card group">
      <h2 className="group-title"><span className="icon-chip"><Icon name={icon} size={16} /></span>{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="grow">
        <strong>{label}</strong>
        {hint && <p className="hint">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Main({ go }: { go: (p: Page) => void }) {
  const {
    settings, patchSettings, autoTrackOn, openAutoTrackSettings, refreshAutoTrack,
    rules, exportData, importTransactions ,clearAll, notify, transactions,
  } = useStore()
  const [name, setName] = useState(settings.name)
  const [confirmWipe, setConfirmWipe] = useState(false)
    const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const wipe = async () => {
    try {
      await clearAll()
      notify('All transactions deleted')
    } catch (e) {
      notify(messageOf(e), 'error')
    }
    setConfirmWipe(false)
  }
    const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same file be picked again later
    if (!file) return
    setImporting(true)
    try {
      const parsed = parseTransactionsCsv(await file.text())
      if (parsed.rows.length === 0) {
        notify(parsed.errors[0] ?? 'No transactions found in that file.', 'error')
        return
      }
      const result = await importTransactions(parsed.rows)
      const extras = [
        result.duplicates ? `${result.duplicates} already existed` : '',
        parsed.skipped ? `${parsed.skipped} unreadable` : '',
        result.failed ? `${result.failed} failed` : '',
      ].filter(Boolean)
      notify(`Imported ${result.added} transactions${extras.length ? ` (${extras.join(', ')})` : ''}`)
    } catch (err) {
      notify(messageOf(err), 'error')
    } finally {
      setImporting(false)
    }
  }

  const doExport = async () => {
    try {
      await exportData()
    } catch (e) {
      notify(messageOf(e), 'error')
    }
  }

  const enableAuto = async () => {
    try {
      await openAutoTrackSettings()
    } catch (e) {
      notify(messageOf(e), 'error')
    }
    // Re-check as soon as the user comes back to the app.
    window.setTimeout(() => void refreshAutoTrack(), 1500)
  }

  return (
    <>
      <Group title="You" icon="sparkle">
        <Field label="What should we call you?">
          <input
            type="text"
            value={name}
            maxLength={24}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => patchSettings({ name: name.trim() })}
          />
        </Field>
      </Group>

      <Group title="Look & feel" icon="palette">
        <Field label="Theme" group>
          <Segmented<ThemeMode>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => patchSettings({ theme })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'auto', label: 'Auto' },
            ]}
          />
        </Field>

        <Field label="Accent colour" group>
          <div className="swatches" role="radiogroup" aria-label="Accent colour">
            {Object.entries(ACCENTS).map(([key, a]) => (
              <button
                key={key}
                role="radio"
                aria-checked={settings.accent === key}
                aria-label={a.label}
                className={`swatch-btn ${settings.accent === key ? 'on' : ''}`}
                style={{ background: a.color }}
                onClick={() => patchSettings({ accent: key })}
              >
                {settings.accent === key && <Icon name="check" size={20} />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Corners" group>
          <Segmented<CornerStyle>
            label="Corner style"
            value={settings.corners}
            onChange={(corners) => patchSettings({ corners })}
            options={[
              { value: 'sharp', label: 'Sharp' },
              { value: 'soft', label: 'Soft' },
              { value: 'round', label: 'Round' },
            ]}
          />
        </Field>

        <Field label="Shadow depth" group>
          <Segmented<ShadowStyle>
            label="Shadow depth"
            value={settings.shadow}
            onChange={(shadow) => patchSettings({ shadow })}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'bold', label: 'Bold' },
              { value: 'heavy', label: 'Heavy' },
            ]}
          />
        </Field>

        <Row label="Hide amounts" hint="Mask amounts as ₹ •••• when someone might be looking.">
          <Toggle label="Hide amounts" on={settings.hideAmounts} onChange={(hideAmounts) => patchSettings({ hideAmounts })} />
        </Row>
      </Group>

      <Group title="Money" icon="target">
        <Row label="Month starts on" hint="Match your pay day.">
          <Stepper
            label="month start day"
            value={settings.startDay}
            display={`Day ${settings.startDay}`}
            onMinus={() => patchSettings({ startDay: Math.max(1, settings.startDay - 1) })}
            onPlus={() => patchSettings({ startDay: Math.min(28, settings.startDay + 1) })}
          />
        </Row>
        <Row label="Low-budget alert" hint="Get a notification when less than 10% of your monthly budget is left.">
          <Toggle label="Low-budget alert" on={settings.budgetAlerts} onChange={(budgetAlerts) => patchSettings({ budgetAlerts })} />
        </Row>
        <button className="nav-row" onClick={() => go('categories')}>
          <span className="grow">
            <strong>Categories</strong>
            <span className="hint">{settings.categories.length} total · add, recolour or rename</span>
          </span>
          <Icon name="right" size={20} />
        </button>
      </Group>

      <Group title="SMS auto-tracking" icon="sms">
        <div className={`status ${autoTrackOn ? 'on' : 'off'}`}>
          <span className="dot" />
          <strong>{autoTrackOn === null ? 'Checking…' : autoTrackOn ? 'Listening for bank & UPI alerts' : 'Notification access is off'}</strong>
        </div>
        <p className="hint">
          Auto Et reads payment notifications from your messages app (Google Messages, Samsung Messages) on this phone only — nothing is uploaded.
        </p>
        {!autoTrackOn && (
          <button className="btn block" onClick={() => void enableAuto()}>
            <Icon name="bell" size={18} /> Open notification access
          </button>
        )}
        <button className="nav-row" onClick={() => go('rules')}>
          <span className="grow">
            <strong>Smart rules</strong>
            <span className="hint">{rules.length ? `${rules.length} custom ${rules.length === 1 ? 'rule' : 'rules'}` : 'Teach it which words mean which category'}</span>
          </span>
          <Icon name="right" size={20} />
        </button>
      </Group>

      <Group title="Your data" icon="shield">
        <p className="hint">Everything is stored in an encrypted database on this device.</p>
                <button className="btn white block" onClick={() => fileRef.current?.click()} disabled={importing}>
          <Icon name="download" size={18} /> {importing ? 'Importing…' : 'Import from CSV'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel"
          style={{ display: 'none' }}
          onChange={(e) => void onPickFile(e)}
        />
        <button className="btn white block" onClick={() => void doExport()} disabled={transactions.length === 0}>
          <Icon name="download" size={18} /> Export as CSV
        </button>
        <button className="btn coral block" onClick={() => setConfirmWipe(true)} disabled={transactions.length === 0}>
          <Icon name="trash" size={18} /> Delete all transactions
        </button>
      </Group>

      <p className="muted center-text about">Auto Et · private expense tracker</p>

      {confirmWipe && (
        <Confirm
          title="Delete everything?"
          body={`All ${transactions.length} transactions will be permanently removed. Your settings and categories stay.`}
          confirmLabel="Delete all"
          danger
          onConfirm={() => void wipe()}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function Categories() {
  const { settings } = useStore()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  return (
    <>
      <button className="btn block" onClick={() => setEditing('new')}>
        <Icon name="plus" size={18} /> New category
      </button>

      <div className="card list">
        {settings.categories.map((c) => (
          <button key={c.name} className="txn" onClick={() => setEditing(c)}>
            <span className="tile" style={{ background: c.color }}>{c.emoji}</span>
            <span className="txn-main">
              <span className="txn-title">{c.name}</span>
              <span className="txn-sub">{c.builtin ? 'Predefined' : 'Custom'}</span>
            </span>
            <Icon name="edit" size={18} />
          </button>
        ))}
      </div>

      {editing && <CategorySheet category={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function CategorySheet({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { saveCategory, deleteCategory, notify } = useStore()
  const [name, setName] = useState(category?.name ?? '')
  const [emoji, setEmoji] = useState(category?.emoji ?? '🏷️')
  const [color, setColor] = useState(category?.color ?? COLOR_LIST[0])
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const save = async () => {
    try {
      await saveCategory({ name, emoji, color, builtin: category?.builtin }, category?.name)
      notify('Category saved')
      onClose()
    } catch (e) {
      setError(messageOf(e))
    }
  }

  const remove = async () => {
    try {
      await deleteCategory(category!.name)
      notify('Category deleted — its transactions moved to Other')
      onClose()
    } catch (e) {
      setError(messageOf(e))
      setConfirming(false)
    }
  }

  return (
    <>
      <Sheet title={category ? 'Edit category' : 'New category'} onClose={onClose}>
        <div className="cat-preview">
          <span className="tile lg" style={{ background: color }}>{emoji}</span>
          <strong>{name.trim() || 'Category name'}</strong>
        </div>

        <Field label="Name" hint={category?.builtin ? 'Predefined categories keep their name.' : undefined}>
          <input
            type="text"
            value={name}
            maxLength={40}
            disabled={category?.builtin}
            placeholder="e.g. Pets"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Icon" group>
          <div className="emoji-grid">
            {EMOJI_CHOICES.map((e) => (
              <button key={e} className={`emoji-pick ${emoji === e ? 'on' : ''}`} onClick={() => setEmoji(e)} aria-label={`Use ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colour" group>
          <div className="swatches">
            {COLOR_LIST.map((c) => (
              <button
                key={c}
                className={`swatch-btn ${color === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
              >
                {color === c && <Icon name="check" size={20} />}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="row gap">
          {category && !category.builtin && (
            <button className="btn coral grow" onClick={() => setConfirming(true)}>
              <Icon name="trash" size={18} /> Delete
            </button>
          )}
          <button className="btn grow" onClick={() => void save()}>Save</button>
        </div>
      </Sheet>

      {confirming && category && (
        <Confirm
          title={`Delete “${category.name}”?`}
          body="Its transactions will move to Other. Its budget and smart rules are removed."
          confirmLabel="Delete"
          danger
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function Rules() {
  const { rules, saveRules, settings, catOf } = useStore()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState(settings.categories[0]?.name ?? 'Other')
  const [error, setError] = useState('')

  const add = () => {
    const k = keyword.trim().toLowerCase()
    if (k.length < 2) return setError('Use at least two characters.')
    if (rules.some((r) => r.keyword === k)) return setError('You already have a rule for that word.')
    saveRules([...rules, { keyword: k, category }])
    setKeyword('')
    setError('')
  }

  return (
    <>
      <section className="card tone t-sky">
        <p>
          Auto Et already knows Swiggy, Zomato, Uber, Amazon, Netflix and many more. Add your own words here —
          they win over the built-in ones, and they also pre-fill the category when you add a transaction by hand.
        </p>
      </section>

      <section className="card">
        <h2>Add a rule</h2>
        <Field label="If the payee or message contains">
          <input type="text" value={keyword} placeholder="e.g. kumar stores" onChange={(e) => setKeyword(e.target.value)} />
        </Field>
        <Field label="Put it in">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {settings.categories.map((c) => (
              <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn block" onClick={add}><Icon name="plus" size={18} /> Add rule</button>
      </section>

      {rules.length > 0 && (
        <div className="card list">
          {rules.map((r) => {
            const c = catOf(r.category)
            return (
              <div key={r.keyword} className="txn static">
                <span className="tile" style={{ background: c.color }}>{c.emoji}</span>
                <span className="txn-main">
                  <span className="txn-title">“{r.keyword}”</span>
                  <span className="txn-sub">→ {c.name}</span>
                </span>
                <button className="icon-btn sm white" aria-label={`Delete rule ${r.keyword}`} onClick={() => saveRules(rules.filter((x) => x.keyword !== r.keyword))}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
