import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import BottomNavigation from '@/components/BottomNavigation'

function getActiveTab(pathname: string): string {
  if (pathname.startsWith('/dashboard') || pathname === '/') return 'home'
  if (pathname.startsWith('/events')) return 'events'
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/fellowship')) return 'fellowships'
  if (pathname.startsWith('/devotions')) return 'devotions'
  if (pathname.startsWith('/more') || pathname.startsWith('/profile') || pathname.startsWith('/settings')) return 'more'
  return 'home'
}

function getPathnameFromHeaders(): string {
  const headerList = headers()
  const raw =
    headerList.get('x-pathname') ||
    headerList.get('next-url') ||
    headerList.get('x-nextjs-pathname') ||
    ''

  if (!raw) return ''
  if (raw.startsWith('http')) {
    try {
      return new URL(raw).pathname
    } catch {
      return ''
    }
  }
  return raw
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = getPathnameFromHeaders()

  async function handleTabChange(tab: string) {
    'use server'
    switch (tab) {
      case 'home':
        return redirect('/dashboard')
      case 'events':
        return redirect('/events')
      case 'chat':
        return redirect('/chat')
      case 'fellowships':
        return redirect('/fellowship')
      case 'devotions':
        return redirect('/devotions')
      case 'more':
        return redirect('/more')
      default:
        break
    }
  }

  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (user && !pathname.startsWith('/onboarding')) {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('onboarding_completed,onboarding_version')
      .eq('id', user.id)
      .single()

    const onboardingVersion = profile?.onboarding_version ?? 0

    if (error || !profile) {
      redirect('/onboarding')
    }

    if (profile.onboarding_completed !== true || onboardingVersion < 2) {
      redirect('/onboarding')
    }
  }

  const activeTab = getActiveTab(pathname)

  return (
    <div className="flex flex-col min-h-screen bg-beige-50 dark:bg-navy-900">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}


