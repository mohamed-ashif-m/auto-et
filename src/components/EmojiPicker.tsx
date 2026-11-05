import { useMemo, useState } from 'react'
import { WHATSAPP_EMOJI_GROUPS } from '../lib/emojis'
import { Icon } from './ui'

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (emoji: string) => void
}) {
  const [activeGroup, setActiveGroup] = useState<string>('smileys')
  const [search, setSearch] = useState('')
  const [customInput, setCustomInput] = useState('')

  const filteredEmojis = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      const group = WHATSAPP_EMOJI_GROUPS.find((g) => g.id === activeGroup)
      return group ? group.emojis : []
    }
    // Search across all groups
    const matches: Array<{ char: string; keywords: string[] }> = []
    const seen = new Set<string>()
    for (const group of WHATSAPP_EMOJI_GROUPS) {
      for (const item of group.emojis) {
        if (
          item.char.includes(q) ||
          item.keywords.some((k) => k.includes(q))
        ) {
          if (!seen.has(item.char)) {
            seen.add(item.char)
            matches.push(item)
          }
        }
      }
    }
    return matches
  }, [activeGroup, search])

  const applyCustom = () => {
    const trimmed = customInput.trim()
    if (trimmed) {
      onChange(trimmed)
      setCustomInput('')
    }
  }

  return (
    <div className="wa-emoji-picker">
      <div className="wa-emoji-search-row">
        <div className="wa-search-wrap">
          <Icon name="search" size={16} />
          <input
            type="text"
            className="wa-search-input"
            value={search}
            placeholder="Search WhatsApp emojis (e.g. food, car, cash)…"
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="wa-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      {!search && (
        <div className="wa-category-tabs" role="tablist" aria-label="Emoji categories">
          {WHATSAPP_EMOJI_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroup === group.id}
              className={`wa-tab-btn ${activeGroup === group.id ? 'active' : ''}`}
              title={group.name}
              onClick={() => setActiveGroup(group.id)}
            >
              <span className="wa-tab-icon">{group.icon}</span>
            </button>
          ))}
        </div>
      )}

      <div className="wa-emoji-scroll-area">
        {filteredEmojis.length === 0 ? (
          <div className="wa-empty-search">
            <p className="muted">No emojis found for "{search}"</p>
          </div>
        ) : (
          <div className="emoji-grid wa-grid">
            {filteredEmojis.map((e) => (
              <button
                key={e.char}
                type="button"
                className={`emoji-pick ${value === e.char ? 'on' : ''}`}
                onClick={() => onChange(e.char)}
                aria-label={`Use ${e.char}`}
              >
                {e.char}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="wa-custom-emoji-row">
        <input
          type="text"
          className="wa-custom-input"
          value={customInput}
          maxLength={4}
          placeholder="Or paste / type any emoji"
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applyCustom()
            }
          }}
        />
        <button
          type="button"
          className="btn sm"
          onClick={applyCustom}
          disabled={!customInput.trim()}
        >
          Use
        </button>
      </div>
    </div>
  )
}
