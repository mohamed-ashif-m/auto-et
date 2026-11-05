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

// Names of the first nine match the ones the Android layer already knew about,
// so every existing transaction keeps its category.
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Online Payment', emoji: '💳', color: COLORS.blue, builtin: true },
  { name: 'Cash', emoji: '💵', color: COLORS.peach, builtin: true },
  { name: 'Food & Dining', emoji: '🍔', color: COLORS.orange, builtin: true },
  { name: 'Groceries', emoji: '🛒', color: COLORS.green, builtin: true },
  { name: 'Transport', emoji: '🚌', color: COLORS.yellow, builtin: true },
  { name: 'Shopping', emoji: '🛍️', color: COLORS.pink, builtin: true },
  { name: 'Bills & Utilities', emoji: '💡', color: COLORS.violet, builtin: true },
  { name: 'Healthcare', emoji: '💊', color: COLORS.coral, builtin: true },
  { name: 'Entertainment', emoji: '🎬', color: COLORS.teal, builtin: true },
  { name: 'Education', emoji: '🎓', color: COLORS.sky, builtin: true },
  { name: 'Salary', emoji: '💼', color: COLORS.lime, builtin: true },
  { name: 'Other', emoji: '📦', color: COLORS.stone, builtin: true },
]

export const FALLBACK_CATEGORY: Category = {
  name: 'Other',
  emoji: '📦',
  color: COLORS.stone,
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
