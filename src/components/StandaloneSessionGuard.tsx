'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Guards against the iOS PWA isolated-localStorage problem.
 *
 * On iOS, standalone mode (home screen app) has its own localStorage that
 * does not share the Safari session. The server sees a valid cookie session
 * and renders the app, but the Supabase JS client finds no session in
 * localStorage and all client-side fetches fail — showing empty "User" state.
 *
 * Fix: when running in standalone mode, check the client-side session after
 * auth resolves. If null, redirect to login so the user authenticates once
 * within the PWA context, creating a persistent localStorage session.
 */
export default function StandaloneSessionGuard() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    if (!isStandalone) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/login?next=/dashboard')
      }
    })
  }, [router])

  return null
}
