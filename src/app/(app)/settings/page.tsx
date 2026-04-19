'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { ArrowLeft, Bell, User, Shield, Moon, Globe, LogOut, Sun, RotateCcw, MessageSquare } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { profile, invalidate } = useUserProfile()
  const toast = useToast()
  const [isRestartingOnboarding, setIsRestartingOnboarding] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const showDeveloperTools = profile?.role === 'steward'

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'events':
        router.push('/events')
        break
      case 'chat':
        router.push('/chat')
        break
      case 'fellowships':
        router.push('/fellowship')
        break
      case 'devotions':
        router.push('/devotions')
        break
      case 'home':
        router.push('/dashboard')
        break
      default:
        break
    }
  }

  const handleRestartOnboarding = async () => {
    setIsRestartingOnboarding(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Your session expired. Please log in again.')
      }

      const response = await fetch('/api/dev/restart-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to restart onboarding')
      }

      localStorage.removeItem('gathered_user_profile')

      toast({
        title: 'Onboarding restarted',
        description: 'Redirecting you into the onboarding flow now.',
        variant: 'success',
        duration: 2500,
      })

      invalidate()
      router.push('/onboarding')
    } catch (error: any) {
      toast({
        title: 'Could not restart onboarding',
        description: error.message || 'Please try again.',
        variant: 'error',
        duration: 4000,
      })
    } finally {
      setIsRestartingOnboarding(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white dark:bg-navy-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky z-40" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Link href="/profile" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <h1 className="text-xl font-bold text-navy-900 dark:text-white">
                Settings
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Settings Sections */}
        <div className="space-y-4">
          {/* Account Settings */}
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
              Account
            </h3>
            <div className="space-y-2">
              <Link 
                href="/profile"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-900 dark:text-white">Profile</span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
              </Link>
              <Link 
                href="/settings/notifications"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-900 dark:text-white">Notifications</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gold-500 rounded-full"></div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
              Preferences
            </h3>
            <div className="space-y-2">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {mounted && theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                  <span className="text-gray-900 dark:text-white">
                    {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {mounted && theme === 'dark' ? 'On' : 'Off'}
                </span>
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-900 dark:text-white">Language</span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
              </button>
            </div>
          </div>

          {/* Privacy & Security */}
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
              Privacy & Security
            </h3>
            <div className="space-y-2">
              <Link
                href="/settings/privacy"
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-900 dark:text-white">Privacy Settings</span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
              </Link>
            </div>
          </div>

          {/* Sign Out */}
          {showDeveloperTools && (
            <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                Developer Tools
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Internal testing tools for replaying onboarding without creating a new account.
              </p>
              <button
                onClick={handleRestartOnboarding}
                disabled={isRestartingOnboarding}
                className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg border border-gold-500/40 bg-gold-500/10 text-gold-700 dark:text-gold-200 hover:bg-gold-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRestartingOnboarding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    <span className="font-medium">Restarting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-5 h-5" />
                    <span className="font-medium">Restart onboarding</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Send Feedback */}
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <a
              href="https://gathered-app.com/#feedback"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5 text-gold-500" />
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Send Feedback 💬</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Help us improve Gathered</p>
                </div>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
            </a>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

    </>
  )
}


