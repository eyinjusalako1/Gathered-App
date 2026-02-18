'use client'

import AppHeader from '@/components/AppHeader'

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-navy-900">
      <AppHeader title="Community Guidelines" subtitle="Safety & trust" backHref="/more" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 text-slate-200">
        <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-2">Be kind and respectful</h2>
          <p className="text-sm text-slate-300">
            Gathered is a faith-first community. Treat others with dignity, grace, and care.
          </p>
        </section>

        <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-2">No harassment or hate</h2>
          <p className="text-sm text-slate-300">
            Harassment, threats, hate speech, or bullying are not allowed. We take reports seriously.
          </p>
        </section>

        <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-2">Keep content appropriate</h2>
          <p className="text-sm text-slate-300">
            Avoid explicit, violent, or deceptive content. Report anything that feels unsafe.
          </p>
        </section>

        <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-2">Use the safety tools</h2>
          <p className="text-sm text-slate-300">
            You can block users and report content at any time. We review reports and may take action.
          </p>
        </section>

        <section className="text-xs text-slate-400">
          For urgent safety issues, contact the team at support@gathered-app.vercel.app.
        </section>
      </div>
    </div>
  )
}



