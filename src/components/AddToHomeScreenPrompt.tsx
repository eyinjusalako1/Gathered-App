'use client'

import { useEffect, useState } from 'react'
import { Share, X } from 'lucide-react'

const STORAGE_KEY = 'gathered_pwa_prompt_dismissed'

export default function AddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY) === 'true') return

    // Don't show if already running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as any).standalone === true)
    if (isStandalone) return

    // Only show on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (!isMobile) return

    setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800/60 p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
          <Share className="w-4 h-4 text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1">
            Add Gathered to your home screen
          </p>
          {isIOS ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              Tap the <span className="text-slate-200 font-medium">Share</span> button in Safari, then{' '}
              <span className="text-slate-200 font-medium">Add to Home Screen</span> for the full app experience.
            </p>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              Tap your browser menu and select{' '}
              <span className="text-slate-200 font-medium">Add to Home Screen</span> for the full app experience.
            </p>
          )}
          <button
            onClick={dismiss}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </section>
  )
}
