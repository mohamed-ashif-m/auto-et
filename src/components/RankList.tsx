import type { ReactNode } from 'react'

export interface RankItem {
  key: string
  label: string
  sub?: string
  value: number
  color: string
  emoji?: string
}

/** Ranked horizontal bars — used for top categories and top merchants. */
export function RankList({
  items,
  format,
  empty,
  onItemClick,
}: {
  items: RankItem[]
  format: (v: number) => string
  empty?: ReactNode
  onItemClick?: (item: RankItem) => void
}) {
  if (items.length === 0) return <>{empty ?? <p className="muted">Nothing here yet.</p>}</>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ol className="rank">
      {items.map((item, i) => {
        const content = (
          <>
            <span className="rank-n">{i + 1}</span>
            <span className="tile sm" style={{ background: item.color }}>{item.emoji ?? '•'}</span>
            <span className="rank-body">
              <span className="rank-head">
                <span className="rank-name">{item.label}</span>
                <strong>{format(item.value)}</strong>
              </span>
              <span className="rank-bar">
                <span style={{ width: `${Math.max(4, (item.value / max) * 100)}%`, background: item.color }} />
              </span>
              {item.sub && <span className="rank-sub">{item.sub}</span>}
            </span>
            {onItemClick && <span className="rank-arrow">›</span>}
          </>
        )

        return (
          <li key={item.key} className={onItemClick ? 'rank-clickable' : ''}>
            {onItemClick ? (
              <button
                type="button"
                className="rank-action"
                onClick={() => onItemClick(item)}
                aria-label={`View details for ${item.label}`}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ol>
  )
}
