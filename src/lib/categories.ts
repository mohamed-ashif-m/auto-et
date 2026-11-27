import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY } from './defaults'
import type { Category, Rule } from './types'

/* Pure helpers shared by settings, imports, analytics and the drag UI.
   No storage, no timers, no randomness in the functions used by tests. */

const BY_ID = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]))
const BY_DEFAULT_NAME = new Map(
  DEFAULT_CATEGORIES.map((c) => [(c.defaultName ?? c.name).toLowerCase(), c]),
)

export const OTHER_ID = 'other'

export function isPredefinedId(id: string | undefined | null): boolean {
  return !!id && BY_ID.has(id)
}

export function defaultCategory(id: string): Category {
  return { ...(BY_ID.get(id) ?? FALLBACK_CATEGORY) }
}

/** Current display name of the "Other" category (it may have been renamed). */
export function otherCategoryName(categories: Category[]): string {
  return categories.find((c) => c.id === OTHER_ID)?.name ?? FALLBACK_CATEGORY.name
}

/** Fallback descriptor for transactions whose category is unknown/empty. */
export function fallbackCategory(categories: Category[]): Category {
  const current = categories.find((c) => c.id === OTHER_ID)
  return current
    ? { ...current }
    : { ...FALLBACK_CATEGORY, name: otherCategoryName(categories) }
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'category'
  )
}

/**
 * Migration + merge in one pure step.
 *
 * Old settings have no ids: a predefined category is recognised by its
 * ORIGINAL name, customs get a deterministic id, and the saved order is kept.
 * Only predefined categories that are genuinely missing are appended at the
 * end, so a renamed builtin never comes back as a duplicate.
 */
export function normaliseCategories(saved: unknown): Category[] {
  const raw = Array.isArray(saved) ? saved : []
  const result: Category[] = []
  const used = new Set<string>()

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const src = entry as Partial<Category>
    const name = typeof src.name === 'string' && src.name.trim() ? src.name : ''
    const givenId = typeof src.id === 'string' ? src.id.trim() : ''

    let id: string
    let builtin: boolean
    const matched =
      !givenId || used.has(givenId)
        ? BY_DEFAULT_NAME.get((src.defaultName ?? name).trim().toLowerCase())
        : undefined
    if (givenId && !used.has(givenId)) {
      id = givenId
      builtin = isPredefinedId(givenId)
    } else if (matched && !used.has(matched.id)) {
      id = matched.id
      builtin = true
    } else {
      const base = `custom-${slug(name || 'category')}`
      let n = 1
      id = base
      while (used.has(id)) {
        n += 1
        id = `${base}-${n}`
      }
      builtin = false
    }
    used.add(id)

    const canonical = builtin ? BY_ID.get(id) : undefined
    result.push({
      id,
      name: name || canonical?.defaultName || canonical?.name || 'Category',
      emoji: src.emoji?.trim() || canonical?.emoji || FALLBACK_CATEGORY.emoji,
      color: src.color?.trim() || canonical?.color || FALLBACK_CATEGORY.color,
      ...(builtin && canonical
        ? { builtin: true, defaultName: canonical.defaultName ?? canonical.name }
        : {}),
    })
  }

  for (const def of DEFAULT_CATEGORIES) {
    if (!used.has(def.id)) {
      result.push({ ...def })
      used.add(def.id)
    }
  }
  return result
}

/** Error text for a new/renamed category name, or null when it is valid. */
export function categoryNameError(
  rawName: string,
  categories: Category[],
  currentId?: string,
): string | null {
  const name = rawName.trim()
  if (!name) return 'Give the category a name.'
  if (name.length > 40) return 'Keep the name under 40 characters.'
  const clash = categories.some(
    (c) => c.id !== currentId && c.name.toLowerCase() === name.toLowerCase(),
  )
  return clash ? 'A category with that name already exists.' : null
}

export interface RenamePlan {
  categories: Category[]
  rules: Rule[]
  categoryBudgets: Record<string, number>
}

/** All non-transaction data that follows a category rename (pure, no mutation). */
export function planRename(
  categories: Category[],
  rules: Rule[],
  budgets: Record<string, number>,
  id: string,
  rawName: string,
): RenamePlan {
  const current = categories.find((c) => c.id === id)
  if (!current) throw new Error('Category not found.')
  const name = rawName.trim()
  const error = categoryNameError(name, categories, id)
  if (error) throw new Error(error)
  if (name === current.name) {
    return { categories, rules, categoryBudgets: budgets }
  }

  const nextBudgets = { ...budgets }
  if (Object.prototype.hasOwnProperty.call(nextBudgets, current.name)) {
    nextBudgets[name] = nextBudgets[current.name]
    delete nextBudgets[current.name]
  }
  return {
    categories: categories.map((c) => (c.id === id ? { ...c, name } : c)),
    rules: rules.map((r) => (r.category === current.name ? { ...r, category: name } : r)),
    categoryBudgets: nextBudgets,
  }
}

/**
 * Resolve an imported category string to a category that exists today.
 * Returns null when the file names a brand-new custom category.
 */
export function resolveImportedCategoryName(
  raw: string,
  categories: Category[],
): string | null {
  const name = raw.trim().slice(0, 40)
  if (!name) return otherCategoryName(categories)
  const lower = name.toLowerCase()
  const current = categories.find((c) => c.name.toLowerCase() === lower)
  if (current) return current.name
  // Old exports/rules use the ORIGINAL name, which must follow a rename.
  const def = BY_DEFAULT_NAME.get(lower)
  if (def) {
    const renamed = categories.find((c) => c.id === def.id)
    if (renamed) return renamed.name
  }
  return null
}

/** Move one category to another index; used by drag, arrows and buttons. */
export function reorderCategories(
  categories: Category[],
  from: number,
  to: number,
): Category[] {
  if (from < 0 || from >= categories.length) return categories
  const target = Math.max(0, Math.min(categories.length - 1, to))
  if (target === from) return categories
  const next = [...categories]
  const [item] = next.splice(from, 1)
  next.splice(target, 0, item)
  return next
}

export function moveCategory(categories: Category[], id: string, delta: number): Category[] {
  const from = categories.findIndex((c) => c.id === id)
  if (from < 0) return categories
  return reorderCategories(categories, from, from + delta)
}

/** Impure helper for categories created in the UI or by an import. */
export function newCategoryId(name = ''): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `custom-${slug(name)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}
