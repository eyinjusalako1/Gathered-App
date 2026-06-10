'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'gathered_feed_onboarding_dismissed'

interface Props {
  onDismiss: () => void
}

export default function FeedOnboardingOverlay({ onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY) !== 'true') {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setVisible(false)
    onDismiss()
  }

  if (!visible) return null

  return (
    <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-navy-800/90 to-navy-900/90 p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="text-sm font-semibold text-white mb-2 pr-6">Welcome to the Faith Feed ✨</p>
      <ul className="space-y-1.5 mb-3">
        <li className="flex items-start gap-2 text-xs text-slate-300">
          <span className="text-gold-400 mt-0.5 shrink-0">•</span>
          Share reflections, prayers, verses, and testimonies with your community
        </li>
        <li className="flex items-start gap-2 text-xs text-slate-300">
          <span className="text-gold-400 mt-0.5 shrink-0">•</span>
          React with Amen 🙏, Heart ❤️, or Fire 🔥 to encourage others
        </li>
        <li className="flex items-start gap-2 text-xs text-slate-300">
          <span className="text-gold-400 mt-0.5 shrink-0">•</span>
          Your feed shows posts from people you follow — tap the ✚ button to start sharing
        </li>
      </ul>
      <button
        onClick={dismiss}
        className="inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
      >
        Got it
      </button>
    </div>
  )
}
