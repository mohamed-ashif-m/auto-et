import type { Category } from '../plugins/transactionPlugin'
import { renderCategoryIcon } from '../icons'

interface CategoryPickerProps {
  categories: Category[]
  value: string
  onChange: (name: string) => void
}

export default function CategoryPicker({
  categories,
  value,
  onChange,
}: CategoryPickerProps) {
  return (
    <div
      className="category-picker"
      role="listbox"
      aria-label="Category"
    >
      {categories.map((category) => {
        const isSelected = value === category.name

        return (
          <button
            key={category.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={
              isSelected
                ? 'category-option selected-category'
                : 'category-option'
            }
            onClick={() => onChange(category.name)}
          >
            <span className="category-option-icon">
              {renderCategoryIcon(category.icon, 16)}
            </span>
            <span>{category.name}</span>
          </button>
        )
      })}
    </div>
  )
}
