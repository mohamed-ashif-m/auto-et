import { afterEach, describe, expect, it, vi } from 'vitest'
import { backStackSize, handleBack, pushBackHandler, type BackHandlerRef } from '../src/lib/backStack'

const ref = (fn: () => void): BackHandlerRef => ({ current: fn })

// A handler stays registered until its component unmounts, so every test
// simulates that unmount with the unregister function returned by push.
afterEach(() => {
  expect(backStackSize()).toBe(0)
})

describe('backStack: native back layer stack', () => {
  it('reports nothing handled when the stack is empty', () => {
    expect(handleBack()).toBe(false)
  })

  it('runs only the top-most handler (LIFO)', () => {
    const lower = vi.fn()
    const upper = vi.fn()
    const removeLower = pushBackHandler(ref(lower))
    const removeUpper = pushBackHandler(ref(upper))

    expect(handleBack()).toBe(true)
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()

    removeUpper() // top layer unmounted
    expect(handleBack()).toBe(true)
    expect(lower).toHaveBeenCalledTimes(1)

    removeLower()
  })

  it('uses the latest callback without re-registering or reordering the stack', () => {
    const stale = vi.fn()
    const latest = vi.fn()
    const lower = vi.fn()
    const removeLower = pushBackHandler(ref(lower))
    const handler = ref(stale)
    const removeUpper = pushBackHandler(handler)

    handler.current = latest // simulates a re-render with fresh state
    expect(backStackSize()).toBe(2)
    expect(handleBack()).toBe(true)
    expect(latest).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
    expect(lower).not.toHaveBeenCalled()

    removeUpper()
    removeLower()
  })

  it('unwinds a Confirm over a Sheet one layer at a time', () => {
    const closeSheet = vi.fn()
    const cancelConfirm = vi.fn()
    const removeSheet = pushBackHandler(ref(closeSheet))
    const removeConfirm = pushBackHandler(ref(cancelConfirm))

    expect(handleBack()).toBe(true)
    expect(cancelConfirm).toHaveBeenCalledTimes(1)
    expect(closeSheet).not.toHaveBeenCalled()

    removeConfirm() // Confirm unmounted after cancel
    expect(handleBack()).toBe(true)
    expect(closeSheet).toHaveBeenCalledTimes(1)

    removeSheet()
    expect(handleBack()).toBe(false)
  })

  it('leaves no stale handler when a sheet closes and another opens in one commit', () => {
    const detailClose = vi.fn()
    const removeDetail = pushBackHandler(ref(detailClose))

    const editClose = vi.fn()
    const removeEdit = pushBackHandler(ref(editClose))

    removeDetail() // identity-based cleanup, even when removal is out of order
    expect(backStackSize()).toBe(1)

    expect(handleBack()).toBe(true)
    expect(editClose).toHaveBeenCalledTimes(1)
    expect(detailClose).not.toHaveBeenCalled()
    expect(handleBack()).toBe(true) // handler stays until its own unmount
    expect(editClose).toHaveBeenCalledTimes(2)

    removeEdit()
    expect(handleBack()).toBe(false)
  })

  it('removes an entry from the middle and tolerates a repeated cleanup', () => {
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()
    const removeA = pushBackHandler(ref(a))
    const removeB = pushBackHandler(ref(b))
    const removeC = pushBackHandler(ref(c))

    removeB()
    removeB() // React StrictMode / double cleanup must not pop another layer
    expect(backStackSize()).toBe(2)

    handleBack() // c
    expect(c).toHaveBeenCalledTimes(1)
    removeC()

    handleBack() // a
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()

    removeA()
  })

  it('leaves the stack empty after 20 open/close cycles (no leaked handlers)', () => {
    for (let i = 0; i < 20; i += 1) {
      const close = vi.fn()
      const remove = pushBackHandler(ref(close))
      expect(handleBack()).toBe(true)
      expect(close).toHaveBeenCalledTimes(1)
      remove()
      expect(backStackSize()).toBe(0)
    }
    expect(handleBack()).toBe(false)
  })
})
