import { useMemo, useState } from 'react'
import { ICON_GROUPS, renderCategoryIcon } from '../icons'

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

const DEFAULT_GROUP = ICON_GROUPS[0]?.id ?? 'other'

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState(DEFAULT_GROUP)

  const searchTerm = query.trim().toLowerCase()

  const visibleIcons = useMemo(() => {
    if (searchTerm) {
      const matches = new Set<string>()

      for (const group of ICON_GROUPS) {
        const groupMatches = group.label
          .toLowerCase()
          .includes(searchTerm)

        for (const icon of group.icons) {
          if (
            groupMatches ||
            icon.toLowerCase().includes(searchTerm)
          ) {
            matches.add(icon)
          }
        }
      }

      return [...matches]
    }

    return (
      ICON_GROUPS.find((group) => group.id === activeGroup)
        ?.icons ?? []
    )
  }, [activeGroup, searchTerm])

  return (
    <div className="icon-picker">
      <div className="icon-preview">
        <span className="icon-preview-badge">
          {renderCategoryIcon(value, 24)}
        </span>
        <div>
          <strong>{value || 'Tag'}</strong>
          <p>Tap any icon below to select it</p>
        </div>
      </div>

      <input
        className="icon-search"
        type="search"
        placeholder={`Search ${ICON_GROUPS.reduce(
          (total, group) => total + group.icons.length,
          0,
        )} icons...`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {!searchTerm && (
        <div className="icon-group-tabs" role="tablist">
          {ICON_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroup === group.id}
              className={
                activeGroup === group.id ? 'active-icon-group' : ''
              }
              onClick={() => setActiveGroup(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      {visibleIcons.length > 0 ? (
        <div className="icon-grid" role="listbox">
          {visibleIcons.map((iconName) => {
            const isSelected = value === iconName

            return (
              <button
                key={iconName}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={iconName}
                title={iconName}
                className={
                  isSelected ? 'selected-icon-button' : ''
                }
                onClick={() => onChange(iconName)}
              >
                {renderCategoryIcon(iconName, 20)}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="icon-empty">
          No icons match “{query.trim()}”.
        </p>
      )}
    </div>
  )
}
