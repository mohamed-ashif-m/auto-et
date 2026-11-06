import { useEffect, useRef, useState } from 'react'
import type { ReactNode, TouchEvent } from 'react'
import { Icon } from './ui'
import { useStore } from '../store/AppStore'
import { ACCENTS } from '../lib/defaults'
import type { ThemeMode } from '../lib/types'

/* ------------------------------------------------------------------ */
/* First-run tour. Shown once; can be replayed from Settings.          */
/* ------------------------------------------------------------------ */

type Tone = 'violet' | 'sky' | 'yellow' | 'lime' | 'pink' | 'orange' | 'coral'

interface Step {
  icon: string
  text: ReactNode
}

interface Slide {
  id: string
  tone: Tone
  kicker: string
  title: ReactNode
  body: string
  steps: Step[]
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    tone: 'violet',
    kicker: 'Welcome',
    title: (
      <>
        Your money, on <mark>autopilot</mark>
      </>
    ),
    body: 'Auto Et logs your bank & UPI payments for you — privately, on this phone. Take the 60-second tour.',
    steps: [
      { icon: 'shield', text: <><b>Private</b> — encrypted on your device, nothing is uploaded</> },
      { icon: 'zap', text: <><b>Automatic</b> — payments are logged &amp; categorised for you</> },
      { icon: 'chart', text: <><b>Insightful</b> — budgets, trends and a calendar of your spending</> },
    ],
  },
  {
    id: 'auto',
    tone: 'sky',
    kicker: 'Auto-tracking',
    title: (
      <>
        Payments that <mark>log themselves</mark>
      </>
    ),
    body: 'Bank and UPI alerts are read on this phone, matched to a category, and OTPs are ignored. Turn it on once:',
    steps: [
      { icon: 'gear', text: <>Tap the <b>gear</b> at the top of Home</> },
      { icon: 'bell', text: <>Under <b>SMS auto-tracking</b>, tap <b>Open notification access</b></> },
      { icon: 'check', text: <>Switch on <b>Auto Et</b>, then come back here</> },
    ],
  },
  {
    id: 'add',
    tone: 'yellow',
    kicker: 'Add anything',
    title: (
      <>
        Cash, UPI, <mark>whatever</mark>
      </>
    ),
    body: 'Paid cash, or forgot to log something? Add it in a few seconds — it still counts everywhere.',
    steps: [
      { icon: 'plus', text: <>Tap the round <b>+</b> button on any screen</> },
      { icon: 'calendar', text: <>Pick an earlier date to <b>backdate</b> it</> },
      { icon: 'edit', text: <>Tap any row to <b>edit or delete</b> it</> },
    ],
  },
  {
    id: 'home',
    tone: 'lime',
    kicker: 'Home base',
    title: (
      <>
        Tap everything. <mark>Seriously.</mark>
      </>
    ),
    body: 'Home is your month at a glance — and most things on it open something deeper.',
    steps: [
      { icon: 'table', text: <>Tap the big balance card for a month-by-month <b>Financial Table</b></> },
      { icon: 'calendar', text: <>Tap the month name or the calendar icon to browse by <b>day or range</b></> },
      { icon: 'tag', text: <>Tap a category in Top spending to see <b>every payment</b> in it</> },
    ],
  },
  {
    id: 'insights',
    tone: 'pink',
    kicker: 'History & Stats',
    title: (
      <>
        Find it. <mark>Understand</mark> it.
      </>
    ),
    body: 'Two tabs for digging in when you want to know where it all went.',
    steps: [
      { icon: 'search', text: <><b>History</b>: search by payee, note or category, then filter Spent / Earned</> },
      { icon: 'chart', text: <><b>Stats</b>: flip between week, month, year and all-time</> },
      { icon: 'up', text: <>Spot your priciest day, daily average and change <b>vs. last period</b></> },
    ],
  },
  {
    id: 'budget',
    tone: 'orange',
    kicker: 'Budget',
    title: (
      <>
        Spend like you <mark>mean it</mark>
      </>
    ),
    body: "Set limits and Auto Et keeps score, with a nudge when under 10% is left.",
    steps: [
      { icon: 'target', text: <>Set a <b>monthly budget</b> to see what&apos;s left, and a safe amount per day</> },
      { icon: 'list', text: <>Add <b>category limits</b>: yellow near the line, coral when over</> },
      { icon: 'sparkle', text: <>Track a <b>savings goal</b> and any <b>loans to pay</b></> },
    ],
  },
  {
    id: 'yours',
    tone: 'coral',
    kicker: 'Make it yours',
    title: (
      <>
        Built <mark>your way</mark>
      </>
    ),
    body: 'Try a colour right now — it applies instantly. Everything else lives behind the gear on Home.',
    steps: [
      { icon: 'wand', text: <><b>Smart rules</b>: teach it that &ldquo;Zepto&rdquo; means Groceries</> },
      { icon: 'eye', text: <><b>Hide amounts</b> when someone&apos;s looking over your shoulder</> },
      { icon: 'download', text: <><b>Import / export CSV</b> any time — your data is yours</> },
    ],
  },
]

/* ---------------------------- slide art ----------------------------- */

function Art({ id }: { id: string }) {
  switch (id) {
    case 'welcome':
      return (
        <div className="mk-welcome">
          <span className="mk-logo" aria-hidden="true">₹</span>
          <span className="mk-sticker s1">AUTO</span>
          <span className="mk-sticker s2">PRIVATE</span>
          <span className="mk-sticker s3">OFFLINE</span>
        </div>
      )
    case 'auto':
      return (
        <div className="mk-flow">
          <div className="mk-sms">
            <span className="mk-sms-from"><Icon name="sms" size={14} /> HDFCBK</span>
            Rs.349.00 debited from A/c XX42 to <b>SWIGGY</b> via UPI
          </div>
          <span className="mk-arrow" aria-hidden="true"><Icon name="zap" size={22} /></span>
          <div className="mk-row">
            <span className="mk-row-emoji">🍔</span>
            <span className="mk-row-main"><b>Swiggy</b><small>Food &amp; Dining · just now</small></span>
            <b className="mk-row-amt">−₹349</b>
          </div>
        </div>
      )
    case 'add':
      return (
        <div className="mk-add">
          <div className="mk-form">
            <div className="mk-seg"><span className="on">Expense</span><span>Income</span></div>
            <div className="mk-amount">₹ 250</div>
            <div className="mk-chips">
              <span>☕ Chai with Priya</span>
              <span className="hot"><Icon name="calendar" size={12} /> Yesterday</span>
            </div>
          </div>
          <span className="mk-fab" aria-hidden="true"><Icon name="plus" size={30} stroke={3.4} /></span>
        </div>
      )
    case 'home':
      return (
        <div className="mk-home">
          <div className="mk-hero">
            <div className="mk-hero-top">
              <small>Left to spend</small>
              <span className="mk-pill"><Icon name="table" size={11} /> Financial Table ↗</span>
            </div>
            <strong>₹12,400</strong>
            <div className="mk-meter"><i style={{ width: '58%' }} /></div>
            <small>₹17,600 spent of ₹30,000 · <b>₹620</b>/day</small>
          </div>
          <span className="mk-tap" aria-hidden="true" />
          <div className="mk-mini-row">
            <span className="mk-month"><Icon name="left" size={12} /> Nov 2026 <Icon name="right" size={12} /></span>
            <span className="mk-cal"><Icon name="calendar" size={16} /></span>
          </div>
        </div>
      )
    case 'insights':
      return (
        <div className="mk-insights">
          <div className="mk-search"><Icon name="search" size={16} /> swiggy</div>
          <div className="mk-bars" aria-hidden="true">
            {[38, 62, 30, 80, 52, 94, 46].map((h, i) => (
              <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} className={i === 5 ? 'peak' : ''} />
            ))}
          </div>
          <div className="mk-tabs"><span>Week</span><span className="on">Month</span><span>Year</span><span>All</span></div>
        </div>
      )
    case 'budget':
      return (
        <div className="mk-budget">
          {[
            { e: '🍔', n: 'Food', p: 46, s: 'ok' },
            { e: '🛍️', n: 'Shopping', p: 88, s: 'warn' },
            { e: '🎬', n: 'Fun', p: 100, s: 'over' },
          ].map((r) => (
            <div key={r.n} className="mk-bud">
              <span>{r.e} {r.n}</span>
              <div className="mk-meter"><i className={r.s} style={{ width: `${r.p}%` }} /></div>
            </div>
          ))}
        </div>
      )
    default:
      return <YoursArt />
  }
}

function YoursArt() {
  const { settings, patchSettings } = useStore()
  const themes: ThemeMode[] = ['light', 'dark', 'auto']
  return (
    <div className="mk-yours">
      <div className="mk-swatches" role="group" aria-label="Accent colour">
        {Object.entries(ACCENTS).map(([key, a]) => (
          <button
            key={key}
            className={`mk-swatch ${settings.accent === key ? 'on' : ''}`}
            style={{ background: a.color }}
            onClick={() => patchSettings({ accent: key })}
            aria-label={a.label}
            aria-pressed={settings.accent === key}
          >
            {settings.accent === key && <Icon name="check" size={18} stroke={3.6} />}
          </button>
        ))}
      </div>
      <div className="mk-seg big" role="group" aria-label="Theme">
        {themes.map((t) => (
          <button key={t} className={settings.theme === t ? 'on' : ''} onClick={() => patchSettings({ theme: t })}>
            {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : 'Auto'}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------ tour -------------------------------- */

export function Intro() {
  const { settings, patchSettings, finishIntro, autoTrackOn, openAutoTrackSettings } = useStore()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const [name, setName] = useState(settings.name)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const slide = SLIDES[index]
  const last = index === SLIDES.length - 1

  const saveName = () => {
    const clean = name.trim()
    if (clean && clean !== settings.name) patchSettings({ name: clean })
  }

  const finish = () => {
    saveName()
    finishIntro()
  }

  const go = (to: number) => {
    if (to < 0 || to >= SLIDES.length || to === index) return
    if (index === 0) saveName()
    setDir(to > index ? 'fwd' : 'back')
    setIndex(to)
  }

  // Keyboard: arrows to move, Escape to skip. Latest handler kept in a ref.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e) => {
      const t = e.target as HTMLElement
      if (e.key === 'Escape') finish()
      else if (t.tagName !== 'INPUT') {
        if (e.key === 'ArrowRight') {
          if (last) finish()
          else go(index + 1)
        }
        if (e.key === 'ArrowLeft') go(index - 1)
      }
    }
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    rootRef.current?.focus()
    return () => window.removeEventListener('keydown', h)
  }, [])

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && !last) go(index + 1)
      if (dx > 0) go(index - 1)
    }
  }

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="Welcome tour" tabIndex={-1} ref={rootRef}>
      <div className="intro-inner">
        <header className="intro-top">
          <ol className="intro-progress" aria-label={`Step ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <li key={s.id}>
                <button
                  className={i === index ? 'now' : i < index ? 'done' : ''}
                  onClick={() => go(i)}
                  aria-label={`Go to step ${i + 1}: ${s.kicker}`}
                  aria-current={i === index ? 'step' : undefined}
                />
              </li>
            ))}
          </ol>
          {!last && (
            <button className="btn sm white intro-skip" onClick={finish}>
              Skip
            </button>
          )}
        </header>

        <div className="intro-scroll" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div key={slide.id} className={`intro-slide ${dir}`}>
            <div className={`intro-art card tone t-${slide.tone}`}>
              <Art id={slide.id} />
            </div>

            <span className="intro-kicker">
              <b>{index + 1}</b>/{SLIDES.length} · {slide.kicker}
            </span>
            <h1 className="intro-title">{slide.title}</h1>
            <p className="intro-body">{slide.body}</p>

            {slide.id === 'welcome' && (
              <label className="intro-name">
                <span>What should we call you? <em>(optional)</em></span>
                <input
                  type="text"
                  value={name}
                  maxLength={24}
                  placeholder="Your name"
                  autoComplete="given-name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}

            <ol className="intro-steps">
              {slide.steps.map((s, i) => (
                <li key={i} style={{ animationDelay: `${120 + i * 90}ms` }}>
                  <span className="intro-step-icon"><Icon name={s.icon} size={20} /></span>
                  <span className="intro-step-text">{s.text}</span>
                </li>
              ))}
            </ol>

            {slide.id === 'auto' &&
              (autoTrackOn === false ? (
                <button className="btn block intro-cta" onClick={() => void openAutoTrackSettings()}>
                  <Icon name="bell" size={18} /> Turn it on now
                </button>
              ) : autoTrackOn ? (
                <p className="intro-ok"><Icon name="check" size={18} stroke={3.4} /> Auto-tracking is already on — you&apos;re set!</p>
              ) : null)}
          </div>
        </div>

        <footer className="intro-foot">
          <button className="btn white intro-back" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">
            <Icon name="left" size={20} />
          </button>
          <button className="btn big grow" onClick={() => (last ? finish() : go(index + 1))}>
            {last ? (
              <>
                <Icon name="zap" size={20} /> Start tracking
              </>
            ) : (
              <>
                Next <Icon name="right" size={20} />
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}
