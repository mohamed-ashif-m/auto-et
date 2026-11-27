import { Fragment, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { moveCategory, reorderCategories } from '../lib/categories'
import type { Category } from '../lib/types'
import { Icon } from './ui'

interface DragState {
  id: string
  pointerId: number
  grabOffset: number
  y: number
  from: number
  to: number
  rect: { top: number; left: number; width: number; height: number }
  scrollEl: HTMLElement | null
}

interface Props {
  categories: Category[]
  onEdit: (category: Category) => void
  onReorder: (categories: Category[]) => void
}

/**
 * Pointer-event reordering. Only the handle disables touch scrolling, so the
 * rest of the settings page still scrolls normally. The rAF loop exists only
 * while a drag is active and is cancelled on drop.
 */
export function CategoryOrderList({ categories, onEdit, onReorder }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const rafRef = useRef<number | null>(null)
  const detachRef = useRef<(() => void) | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const stopDrag = () => {
    detachRef.current?.()
    detachRef.current = null
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    dragRef.current = null
    setDrag(null)
  }

  useEffect(() => () => stopDrag(), [])

  const updateTarget = (state: DragState, y: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]')
    let index = 0
    if (rows) {
      for (const row of Array.from(rows)) {
        if (row.dataset.catId === state.id) continue
        const rect = row.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) break
        index += 1
      }
    }
    const to = Math.max(0, Math.min(categories.length - 1, index))
    if (to !== state.to) {
      state.to = to
      setDrag({ ...state })
    }
  }

  const onHandleDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    category: Category,
    index: number,
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    const row = e.currentTarget.closest('[data-cat-id]') as HTMLElement | null
    if (!row) return

    const rect = row.getBoundingClientRect()
    const state: DragState = {
      id: category.id,
      pointerId: e.pointerId,
      grabOffset: e.clientY - rect.top,
      y: e.clientY,
      from: index,
      to: index,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      scrollEl: row.closest('.page-overlay') as HTMLElement | null,
    }
    dragRef.current = state
    setDrag(state)

    const finish = () => {
      const current = dragRef.current
      if (!current || current.pointerId !== state.pointerId) return
      const target = current.to
      const from = current.from
      stopDrag()
      if (target !== from) onReorder(reorderCategories(categories, from, target))
    }
    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current
      if (!current || ev.pointerId !== current.pointerId) return
      ev.preventDefault()
      current.y = ev.clientY
      updateTarget(current, ev.clientY)
      setDrag({ ...current })
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== state.pointerId) return
      finish()
    }
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== state.pointerId) return
      stopDrag()
    }

    detachRef.current?.()
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    detachRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }

    const tick = () => {
      const current = dragRef.current
      if (!current) return
      const scrollEl = current.scrollEl
      if (scrollEl) {
        const bounds = scrollEl.getBoundingClientRect()
        const edge = 56
        if (current.y < bounds.top + edge) scrollEl.scrollTop -= 12
        else if (current.y > bounds.bottom - edge) scrollEl.scrollTop += 12
      }
      // The rows moved under the finger while auto-scrolling, so recompute.
      updateTarget(current, current.y)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const moveBy = (id: string, delta: number) => {
    onReorder(moveCategory(categories, id, delta))
  }

  const rowInner = (c: Category, index: number, ghost = false) => (
    <>
      {ghost ? (
        <span className="drag-handle static" aria-hidden="true">≡</span>
      ) : (
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag to reorder ${c.name}`}
          title="Drag to reorder (arrow keys also work)"
          onPointerDown={(e) => onHandleDown(e, c, index)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              moveBy(c.id, e.key === 'ArrowUp' ? -1 : 1)
            }
          }}
        >
          ≡
        </button>
      )}
      <button
        type="button"
        className="cat-edit txn"
        tabIndex={ghost ? -1 : undefined}
        onClick={() => !ghost && onEdit(c)}
      >
        <span className="tile" style={{ background: c.color }}>{c.emoji}</span>
        <span className="txn-main">
          <span className="txn-title">{c.name}</span>
          <span className="txn-sub">{c.builtin ? 'Predefined' : 'Custom'}</span>
        </span>
        {!ghost && <Icon name="edit" size={18} />}
      </button>
      <span className="cat-move" aria-hidden={ghost}>
        <button
          type="button"
          className="icon-btn sm white"
          aria-label={`Move ${c.name} up`}
          tabIndex={ghost ? -1 : undefined}
          disabled={ghost || index === 0}
          onClick={() => moveBy(c.id, -1)}
        >
          <Icon name="up" size={14} />
        </button>
        <button
          type="button"
          className="icon-btn sm white"
          aria-label={`Move ${c.name} down`}
          tabIndex={ghost ? -1 : undefined}
          disabled={ghost || index === categories.length - 1}
          onClick={() => moveBy(c.id, 1)}
        >
          <Icon name="down" size={14} />
        </button>
      </span>
    </>
  )

  const withoutDrag = drag ? categories.filter((c) => c.id !== drag.id) : categories
  const dragged = drag ? categories.find((c) => c.id === drag.id) : undefined
  const placeholder = drag ? (
    <div className="drag-placeholder" style={{ height: drag.rect.height }} aria-hidden="true" />
  ) : null

  return (
    <div className="card list cat-order-list" ref={listRef}>
      {withoutDrag.map((c, i) => (
        <Fragment key={c.id}>
          {drag && i === drag.to && placeholder}
          <div className={`cat-row ${drag?.id === c.id ? 'dragging' : ''}`} data-cat-id={c.id}>
            {rowInner(c, i)}
          </div>
        </Fragment>
      ))}
      {drag && drag.to === withoutDrag.length && placeholder}
      {drag && dragged && (
        <div
          className="cat-row cat-ghost"
          aria-hidden="true"
          style={{
            top: drag.y - drag.grabOffset,
            left: drag.rect.left,
            width: drag.rect.width,
          }}
        >
          {rowInner(dragged, drag.from, true)}
        </div>
      )}
    </div>
  )
}
