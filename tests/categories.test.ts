import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../src/lib/defaults'
import {
  categoryNameError, fallbackCategory, moveCategory, normaliseCategories,
  otherCategoryName, planRename, reorderCategories, resolveImportedCategoryName,
} from '../src/lib/categories'
import type { Category, Rule } from '../src/lib/types'

const legacy = DEFAULT_CATEGORIES.map(({ name, emoji, color, builtin }) => ({
  name, emoji, color, builtin,
}))

const withIds = (categories: Category[] = DEFAULT_CATEGORIES) =>
  categories.map((c) => ({ ...c }))

describe('normaliseCategories: migration and merge', () => {
  it('assigns ids by ORIGINAL name, keeps the saved order and appends only missing builtins', () => {
    const saved = [
      legacy[2], // Food & Dining moved to the top by an old user
      legacy[0], // Online Payment
      { name: 'Pets', emoji: '🐶', color: '#FF6B57' },
      legacy[4], // Transport
    ]
    const result = normaliseCategories(saved)
    expect(result.slice(0, 4).map((c) => [c.id, c.name])).toEqual([
      ['food', 'Food & Dining'],
      ['online-payment', 'Online Payment'],
      ['custom-pets', 'Pets'],
      ['transport', 'Transport'],
    ])
    expect(result).toHaveLength(DEFAULT_CATEGORIES.length + 1)
    expect(result.slice(4).every((c) => c.builtin)).toBe(true)
    // No default appears twice.
    expect(new Set(result.map((c) => c.id)).size).toBe(result.length)
  })

  it('does not resurrect a renamed predefined category as a duplicate', () => {
    const saved = withIds().map((c) =>
      c.id === 'food' ? { ...c, name: 'Eating Out' } : c,
    )
    const result = normaliseCategories(saved)
    const food = result.filter((c) => c.id === 'food')
    expect(food).toHaveLength(1)
    expect(food[0]).toMatchObject({ name: 'Eating Out', defaultName: 'Food & Dining', builtin: true })
    expect(result.some((c) => c.name === 'Food & Dining')).toBe(false)
    expect(result).toHaveLength(DEFAULT_CATEGORIES.length)
  })

  it('keeps the current name of a renamed "Other" and uses it as the fallback', () => {
    const saved = withIds().map((c) =>
      c.id === 'other' ? { ...c, name: 'Misc' } : c,
    )
    const result = normaliseCategories(saved)
    expect(otherCategoryName(result)).toBe('Misc')
    expect(fallbackCategory(result)).toMatchObject({ id: 'other', name: 'Misc' })
    expect(result.filter((c) => c.name === 'Other')).toHaveLength(0)
  })

  it('is deterministic for legacy customs with the same name', () => {
    const a = normaliseCategories([{ name: 'Pets', emoji: '🐶', color: '#fff' }])
    const b = normaliseCategories([{ name: 'Pets', emoji: '🐶', color: '#fff' }])
    expect(a[0].id).toBe(b[0].id)
    const two = normaliseCategories([
      { name: 'Pets', emoji: '🐶', color: '#fff' },
      { name: 'Pets', emoji: '🐱', color: '#000' },
    ])
    expect(two[0].id).not.toBe(two[1].id)
  })
})

describe('categoryNameError: validation', () => {
  const categories = withIds()

  it('rejects empty, too long and case-insensitive duplicates', () => {
    expect(categoryNameError('   ', categories)).toBe('Give the category a name.')
    expect(categoryNameError('x'.repeat(41), categories)).toBe('Keep the name under 40 characters.')
    expect(categoryNameError('gRoCeRiEs', categories)).toBe('A category with that name already exists.')
  })

  it('allows a category to keep its own name, but not another category\'s', () => {
    const food = categories.find((c) => c.id === 'food')!
    expect(categoryNameError(food.name, categories, food.id)).toBeNull()
    expect(categoryNameError('Cash', categories, food.id)).toBe('A category with that name already exists.')
  })
})

describe('planRename: one atomic data change', () => {
  const categories = withIds()
  const rules: Rule[] = [
    { keyword: 'swiggy', category: 'Food & Dining' },
    { keyword: 'uber', category: 'Transport' },
  ]
  const budgets = { 'Food & Dining': 500000, Transport: 200000 }

  it('moves the category, its rules and its budget, preserving order', () => {
    const plan = planRename(categories, rules, budgets, 'food', 'Eating Out')
    expect(plan.categories.map((c) => c.name)).toEqual(
      categories.map((c) => (c.id === 'food' ? 'Eating Out' : c.name)),
    )
    expect(plan.categories.find((c) => c.id === 'food')).toMatchObject({
      id: 'food', name: 'Eating Out', defaultName: 'Food & Dining', builtin: true,
    })
    expect(plan.rules).toEqual([
      { keyword: 'swiggy', category: 'Eating Out' },
      { keyword: 'uber', category: 'Transport' },
    ])
    expect(plan.categoryBudgets).toEqual({ 'Eating Out': 500000, Transport: 200000 })
    // No mutation of the inputs.
    expect(categories.find((c) => c.id === 'food')!.name).toBe('Food & Dining')
    expect(budgets).toEqual({ 'Food & Dining': 500000, Transport: 200000 })
  })

  it('restores the original name on reset', () => {
    const renamed = planRename(categories, rules, budgets, 'food', 'Eating Out')
    const reset = planRename(renamed.categories, renamed.rules, renamed.categoryBudgets, 'food', 'Food & Dining')
    expect(reset.categories.find((c) => c.id === 'food')!.name).toBe('Food & Dining')
    expect(reset.rules[0].category).toBe('Food & Dining')
    expect(reset.categoryBudgets).toEqual(budgets)
  })

  it('refuses a clash and does not change anything', () => {
    expect(() => planRename(categories, rules, budgets, 'food', 'cash')).toThrow(
      'A category with that name already exists.',
    )
    expect(categories.find((c) => c.id === 'food')!.name).toBe('Food & Dining')
  })
})

describe('imports use current names', () => {
  const renamed = withIds().map((c) =>
    c.id === 'groceries' ? { ...c, name: 'Fresh Food' } : c,
  )

  it('maps an ORIGINAL predefined name to the renamed category', () => {
    expect(resolveImportedCategoryName('Groceries', renamed)).toBe('Fresh Food')
    expect(resolveImportedCategoryName('  groceries  ', renamed)).toBe('Fresh Food')
    expect(resolveImportedCategoryName('Fresh Food', renamed)).toBe('Fresh Food')
    expect(resolveImportedCategoryName('Fresh food', renamed)).toBe('Fresh Food')
  })

  it('maps an empty category to the renamed Other and leaves new names alone', () => {
    const otherRenamed = renamed.map((c) =>
      c.id === 'other' ? { ...c, name: 'Misc' } : c,
    )
    expect(resolveImportedCategoryName('', otherRenamed)).toBe('Misc')
    expect(resolveImportedCategoryName('Pets', otherRenamed)).toBeNull()
  })
})

describe('ordering helpers', () => {
  const categories = withIds()

  it('moves a custom above a predefined without mutating the input', () => {
    const custom: Category = {
      id: 'custom-pets', name: 'Pets', emoji: '🐶', color: '#fff',
    }
    const list = [categories[0], categories[1], custom, categories[2]]
    const moved = reorderCategories(list, 2, 0)
    expect(moved.map((c) => c.id)).toEqual(['custom-pets', 'online-payment', 'cash', 'food'])
    expect(list.map((c) => c.id)).toEqual(['online-payment', 'cash', 'custom-pets', 'food'])
  })

  it('clamps drop indices and powers the up/down buttons', () => {
    expect(reorderCategories(categories, 0, -5)).toEqual(categories)
    expect(reorderCategories(categories, 11, 99)).toEqual(categories)
    expect(moveCategory(categories, 'food', -1)[1].id).toBe('food')
    expect(moveCategory(categories, 'food', 1)[3].id).toBe('food')
    expect(moveCategory(categories, 'unknown', 1)).toBe(categories)
  })
})
