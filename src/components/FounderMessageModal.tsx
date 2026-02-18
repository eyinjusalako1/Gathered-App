'use client'

import BottomSheet from '@/components/ui/BottomSheet'

export const FOUNDER_MESSAGE_VERSION = 'v1'
export const FOUNDER_MESSAGE_DATE = 'Jan 2026'
export const FOUNDER_MESSAGE_STORAGE_KEY = 'gathered_seen_founder_message_v1'

export const FOUNDER_MESSAGE_CONTENT = {
  title: 'Welcome to Gathered (Beta)',
  intro:
    "Hey friend — I’m so glad you’re here. Thank you for joining our beta and helping us shape Gathered. Your feedback directly guides what we build next.",
  bullets: [
    'What to test: Discovery search, groups, chats, and devotions',
    'How to report bugs/feedback: Tap “Send feedback” below or email us anytime',
    'Invite friends via group invites to help us grow the community',
  ],
  feedbackEmail: 'mailto:founder@gathered.app?subject=Gathered%20Beta%20Feedback',
}

interface FounderMessageModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FounderMessageModal({ isOpen, onClose }: FounderMessageModalProps) {
  const handleConfirm = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FOUNDER_MESSAGE_STORAGE_KEY, 'true')
    }
    onClose()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={FOUNDER_MESSAGE_CONTENT.title}>
      <div className="space-y-4">
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
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
          >
            Got it
          </button>
          <a
            href={FOUNDER_MESSAGE_CONTENT.feedbackEmail}
            className="w-full text-center rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2.5 text-sm font-semibold text-gold-100 hover:bg-gold-500/20 transition-colors"
          >
            Send feedback
          </a>
        </div>
      </div>
    </BottomSheet>
  )
}




