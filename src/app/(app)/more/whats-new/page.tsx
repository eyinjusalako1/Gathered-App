'use client'

import { Mail, MessageCircle, BookOpen, Compass, Sparkles } from 'lucide-react'

const updates = [
  {
    id: 'invites',
    title: 'Invite friends to your group',
    description: 'Create invite links and bring friends straight into your groups.',
    icon: Mail,
    isNew: true,
  },
  {
    id: 'group-chat',
    title: 'Group chat is live',
    description: 'Chat with your group members and build community throughout the week.',
    icon: MessageCircle,
    isNew: true,
  },
  {
    id: 'devotions',
    title: 'Share devotions with your group',
    description: 'Read daily devotions and share reflections directly into group chats.',
    icon: BookOpen,
  },
  {
    id: 'discovery',
    title: 'Improved discovery',
    description: 'Find people, groups, and events that match your interests and location.',
    icon: Compass,
  },
]

export default function WhatsNewPage() {
  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-gold-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-50">What&apos;s New</h1>
              <p className="text-sm text-slate-400">Recent updates to Gathered</p>
            </div>
          </div>
        </div>

        {/* Update Cards */}
        <div className="space-y-4">
          {updates.map((update) => {
            const Icon = update.icon
            return (
              <div
                key={update.id}
                className="bg-navy-900/40 border border-white/10 rounded-2xl p-5 transition-all hover:border-gold-500/40 hover:shadow-[0_0_20px_rgba(245,196,81,0.15)]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gold-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-50">{update.title}</h3>
                      {update.isNew && (
                        <span className="px-2 py-0.5 text-xs bg-gold-500/20 text-gold-500 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{update.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            More updates coming soon — thanks for building Gathered with us.
          </p>
        </div>
      </div>
    </div>
  )
}




