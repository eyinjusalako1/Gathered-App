'use client'

import { FOCUS_TAGS } from '@/lib/fellowship/focusTags'

interface TagChipSelectorProps {
  selected: string[]
  onChange: (selected: string[]) => void
  maxSelections?: number
}

export default function TagChipSelector({ selected, onChange, maxSelections }: TagChipSelectorProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      if (maxSelections && selected.length >= maxSelections) return
      onChange([...selected, value])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FOCUS_TAGS.map(tag => {
        const isSelected = selected.includes(tag.value)
        const isDisabled = !isSelected && !!maxSelections && selected.length >= maxSelections
        return (
          <button
            key={tag.value}
            type="button"
            onClick={() => toggle(tag.value)}
            disabled={isDisabled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all
              ${isSelected
                ? 'bg-gold-500 text-navy-900 border-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                : isDisabled
                  ? 'bg-navy-900/20 text-slate-600 border-white/5 cursor-not-allowed'
                  : 'bg-navy-900/40 text-slate-300 border-white/10 hover:border-gold-500/40 hover:text-slate-100'
              }`}
          >
            <span>{tag.emoji}</span>
            <span>{tag.label}</span>
          </button>
        )
      })}
    </div>
  )
}
