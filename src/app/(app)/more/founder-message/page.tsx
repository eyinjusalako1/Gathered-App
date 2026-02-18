'use client'

import Link from 'next/link'
import {
  FOUNDER_MESSAGE_CONTENT,
  FOUNDER_MESSAGE_DATE,
  FOUNDER_MESSAGE_VERSION,
} from '@/components/FounderMessageModal'

export default function FounderMessagePage() {
  return (
    <div className="min-h-screen bg-navy-900 text-slate-100 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-500">
            Founder Message
          </p>
          <h1 className="text-2xl font-semibold">{FOUNDER_MESSAGE_CONTENT.title}</h1>
          <p className="text-xs text-slate-400">
            {FOUNDER_MESSAGE_VERSION} · {FOUNDER_MESSAGE_DATE}
          </p>
        </div>

        <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <p className="text-sm text-slate-200 leading-relaxed">
            {FOUNDER_MESSAGE_CONTENT.intro}
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            {FOUNDER_MESSAGE_CONTENT.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gold-400 flex-shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 pt-2">
            <a
              href={FOUNDER_MESSAGE_CONTENT.feedbackEmail}
              className="w-full text-center rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2.5 text-sm font-semibold text-gold-100 hover:bg-gold-500/20 transition-colors"
            >
              Send feedback
            </a>
            <Link
              href="/more/whats-new"
              className="w-full text-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-gold-500/30 hover:text-gold-100 transition-colors"
            >
              What&apos;s New
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}




