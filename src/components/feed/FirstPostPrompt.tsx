'use client'

import { Sparkles } from 'lucide-react'

interface Props {
  onCompose: () => void
}

export default function FirstPostPrompt({ onCompose }: Props) {
  return (
    <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 to-navy-800/40 p-5 text-center space-y-3">
      <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center mx-auto">
        <Sparkles className="w-5 h-5 text-gold-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Share something today</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          A reflection, a verse, a prayer — your words could encourage someone in your community.
        </p>
      </div>
      <button
        onClick={onCompose}
        className="inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-5 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
      >
        Make your first post
      </button>
    </div>
  )
}
