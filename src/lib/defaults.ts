import type { Category, Settings } from './types'

export const INK = '#111111'

// The colour palette is lifted straight from the neo-brutalist references.
export const COLORS = {
  yellow: '#FFD93B',
  coral: '#FF6B57',
  lime: '#B8F04B',
  violet: '#9B8CF5',
  sky: '#6FD3EB',
  pink: '#FF8FD8',
  orange: '#FFA94D',
  green: '#4ED17E',
  blue: '#6C94FF',
  teal: '#3DDBC0',
  peach: '#FFCBA4',
  stone: '#D3CCBD',
}

export const COLOR_LIST = Object.values(COLORS)

export const ACCENTS: Record<string, { label: string; color: string }> = {
  sun: { label: 'Sun', color: COLORS.yellow },
  violet: { label: 'Violet', color: COLORS.violet },
  coral: { label: 'Coral', color: COLORS.coral },
  lime: { label: 'Lime', color: COLORS.lime },
  sky: { label: 'Sky', color: COLORS.sky },
  pink: { label: 'Pink', color: COLORS.pink },
}

// IDs are stable across renames and are also understood by the Android SMS
// categoriser. `defaultName` is the name legacy transactions, rules and
// imports used; it is never rewritten by a rename.
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'online-payment', name: 'Online Payment', defaultName: 'Online Payment', emoji: '💳', color: COLORS.blue, builtin: true },
  { id: 'cash', name: 'Cash', defaultName: 'Cash', emoji: '💵', color: COLORS.peach, builtin: true },
  { id: 'food', name: 'Food & Dining', defaultName: 'Food & Dining', emoji: '🍔', color: COLORS.orange, builtin: true },
  { id: 'groceries', name: 'Groceries', defaultName: 'Groceries', emoji: '🛒', color: COLORS.green, builtin: true },
  { id: 'transport', name: 'Transport', defaultName: 'Transport', emoji: '🚌', color: COLORS.yellow, builtin: true },
  { id: 'shopping', name: 'Shopping', defaultName: 'Shopping', emoji: '🛍️', color: COLORS.pink, builtin: true },
  { id: 'bills', name: 'Bills & Utilities', defaultName: 'Bills & Utilities', emoji: '💡', color: COLORS.violet, builtin: true },
  { id: 'healthcare', name: 'Healthcare', defaultName: 'Healthcare', emoji: '💊', color: COLORS.coral, builtin: true },
  { id: 'entertainment', name: 'Entertainment', defaultName: 'Entertainment', emoji: '🎬', color: COLORS.teal, builtin: true },
  { id: 'education', name: 'Education', defaultName: 'Education', emoji: '🎓', color: COLORS.sky, builtin: true },
  { id: 'salary', name: 'Salary', defaultName: 'Salary', emoji: '💼', color: COLORS.lime, builtin: true },
  { id: 'other', name: 'Other', defaultName: 'Other', emoji: '📦', color: COLORS.stone, builtin: true },
]

export const FALLBACK_CATEGORY: Category = {
  id: 'other',
  name: 'Other',
  defaultName: 'Other',
  emoji: '📦',
  color: COLORS.stone,
  builtin: true,
}

export const EMOJI_CHOICES = [
  '🍔', '☕', '🍕', '🍺', '🛒', '🚌', '🚗', '⛽', '✈️', '🏠', '💡', '📱',
  '💊', '🏥', '🎬', '🎮', '🎵', '📚', '🎓', '👕', '🛍️', '🎁', '💈', '🐶',
  '👶', '💼', '💰', '💳', '💵', '🏦', '📈', '🧾', '🔧', '🏋️', '🌴', '🎂',
]

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  theme: 'light',
  accent: 'sun',
  corners: 'soft',
  shadow: 'bold',
  hideAmounts: false,
  startDay: 1,
  monthlyBudget: 0,
  categoryBudgets: {},
  savingsPct: 20,
  budgetAlerts: true,
  categories: DEFAULT_CATEGORIES,
}
