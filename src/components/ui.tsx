import { useEffect } from 'react'
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Icons — chunky 2.8px strokes to match the neo-brutalist borders     */
/* ------------------------------------------------------------------ */

const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5',
  list: 'M9 6h12M9 12h12M9 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M5 20V11M12 20V4M19 20v-7',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.8-4.8',
  up: 'M7 17 17 7M8 7h9v9',
  down: 'M17 7 7 17M16 17H7V8',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  check: 'M4.5 12.5l5 5L19.5 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19.5 8.5l-4-4L4 16v4ZM13.5 6.5l4 4',
  bell: 'M6 9a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9ZM10 21h4',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M4 20h16',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 7.2A17 17 0 0 0 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  refresh: 'M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  tag: 'M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01',
  wand: 'M5 19 17 7M14 4l2-1 1 2-1 2M19 9l2 1-1 2M8 3l.8 1.7L10.5 5.5 8.8 6.3 8 8l-.8-1.7L5.5 5.5l1.7-.8L8 3Z',
  shield: 'M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3ZM9 12l2 2 4-4',
  sms: 'M4 5h16v11H9l-5 4V5ZM8 9h8M8 12.5h5',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
}

export function Icon({ name, size = 22, stroke = 2.8 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.plus} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Sheets and dialogs                                                  */
/* ------------------------------------------------------------------ */

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
}

export function Sheet({
  title,
  onClose,
  children,
  tone,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  tone?: string
}) {
  useEscape(onClose)
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className={`sheet ${tone ? `tone ${tone}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEscape(onCancel)
  return (
    <div className="overlay center" onClick={onCancel}>
      <section className="dialog card" role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">{body}</p>
        <div className="row gap">
          <button className="btn white grow" onClick={onCancel}>Cancel</button>
          <button className={`btn grow ${danger ? 'coral' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

export function Stepper({
  value,
  display,
  onMinus,
  onPlus,
  onValueClick,
  label,
}: {
  value: number
  display: string
  onMinus: () => void
  onPlus: () => void
  onValueClick?: () => void
  label: string
}) {
  return (
    <div className="stepper" data-value={value}>
      <button className="icon-btn white" onClick={onMinus} aria-label={`Decrease ${label}`}>
        <Icon name="minus" />
      </button>
      {onValueClick ? (
        <button className="stepper-value linkish" onClick={onValueClick} aria-label={`Set ${label} exactly`}>
          {display}
        </button>
      ) : (
        <strong className="stepper-value">{display}</strong>
      )}
      <button className="icon-btn white" onClick={onPlus} aria-label={`Increase ${label}`}>
        <Icon name="plus" />
      </button>
    </div>
  )
}

/** Chunky progress bar. Turns yellow near the limit and coral (striped) when over. */
export function Meter({ ratio, tall, goal }: { ratio: number; tall?: boolean; goal?: boolean }) {
  // `goal` meters (savings) are never alarming — filling them up is the point.
  const state = goal ? 'ok' : ratio > 1 ? 'over' : ratio > 0.8 ? 'warn' : 'ok'
  return (
    <div
      className={`meter ${tall ? 'tall' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.round(ratio * 100))}
    >
      <div className={`meter-fill ${state}`} style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }} />
    </div>
  )
}

export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty card">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p className="muted">{body}</p>
      {action}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
  group,
}: {
  label: string
  children: ReactNode
  hint?: string
  group?: boolean
}) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </Tag>
  )
}
