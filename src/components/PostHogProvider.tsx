'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { initPostHog, posthog } from '@/lib/posthog'

// Separated because useSearchParams requires a Suspense boundary in App Router
function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const url = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    initPostHog()
    posthog.capture('app_opened')
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) {
      posthog.reset()
      return
    }

    posthog.identify(user.id, { email: user.email ?? undefined })

    supabase
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.name) posthog.setPersonProperties({ name: data.name })
      })
  }, [user, loading])

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  )
}
