import { useEffect, useRef } from 'react'

/**
 * LIFO stack of "close this layer" handlers. The app shell listens for the
 * native back button once; every mounted layer registers here while it is
 * active, so the top-most layer is always the one that handles a back press.
 *
 * No timers, polling or history entries: this is purely event driven.
 */

export type BackHandler = () => void
export type BackHandlerRef = { current: BackHandler }

const stack: BackHandlerRef[] = []

/** Register a mutable handler reference; returns an idempotent unregister. */
export function pushBackHandler(handler: BackHandlerRef): () => void {
  stack.push(handler)
  let removed = false
  return () => {
    if (removed) return
    removed = true
    // Remove by identity, not by position: a layer can be closed while a
    // replacement layer is mounted in the same React commit.
    const index = stack.lastIndexOf(handler)
    if (index !== -1) stack.splice(index, 1)
  }
}

/** Run the top-most handler. Returns false when there is nothing to close. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top.current()
  return true
}

/** Number of registered layers (useful for tests and leak checks). */
export function backStackSize(): number {
  return stack.length
}

/**
 * Keep `handler` in a ref so re-renders never re-register or reorder the
 * stack, while the callback always sees the latest component state.
 */
export function useBackHandler(active: boolean, handler: BackHandler): void {
  const ref = useRef<BackHandler>(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!active) return undefined
    return pushBackHandler(ref)
  }, [active])
}
