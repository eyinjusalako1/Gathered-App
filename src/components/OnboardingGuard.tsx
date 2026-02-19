'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function OnboardingGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading } = useUserProfile()

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!user) return
    if (pathname.startsWith('/onboarding')) return

    const onboardingVersion = profile?.onboarding_version ?? 0
    if (!profile || profile.onboarding_completed !== true || onboardingVersion < 2) {
      router.replace('/onboarding')
    }
  }, [
    authLoading,
    profileLoading,
    user,
    profile,
    pathname,
    router,
  ])

  return null
}
