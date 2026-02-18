'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { ArrowLeft, Bell, User, Shield, Moon, Globe, LogOut, Crown, Users, Sun } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import type { Role } from '@/lib/prefs'

function isValidRole(value: string | null | undefined): value is Role {
  return value === 'disciple' || value === 'steward'
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { profile, role, updateProfile, invalidate } = useUserProfile()
  const toast = useToast()
  const [isSwitchingRole, setIsSwitchingRole] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [targetRole, setTargetRole] = useState<Role | null>(null)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const currentRole = role || (isValidRole(profile?.role) ? profile.role : null)
  const isDisciple = currentRole === 'disciple'
  const isSteward = currentRole === 'steward'

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleRoleSwitchClick = () => {
    const newRole: Role = isDisciple ? 'steward' : 'disciple'
    setTargetRole(newRole)
    setShowConfirmDialog(true)
  }

  const handleConfirmRoleSwitch = async () => {
    if (!user || !targetRole || !isValidRole(targetRole)) return

    setIsSwitchingRole(true)
    setShowConfirmDialog(false)

    try {
      // Update the role in user_profiles
      await updateProfile({ role: targetRole })
      
      // Also update user_prefs for compatibility
      const { supabase } = await import('@/lib/supabase')
      const userType = targetRole === 'disciple' ? 'Disciple' : 'Steward'
      await supabase
        .from('user_prefs')
        .upsert({
          user_id: user.id,
          user_type: userType,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })

      // Invalidate cache to refresh data
      invalidate()
      
      // Clear profile cache to force refresh
      localStorage.removeItem('gathered_user_profile')
      
      // Clear and update localStorage cache
      localStorage.removeItem('gathered_user_prefs')
      localStorage.setItem('gathered_user_prefs', JSON.stringify({ userType }))

      toast({
        title: 'Role updated successfully',
        description: `You are now in ${targetRole === 'disciple' ? 'Disciple' : 'Steward'} mode. Refreshing...`,
        variant: 'success',
        duration: 3000,
      })

      // Force a hard refresh by reloading the page after redirect
      setTimeout(() => {
        router.push('/dashboard')
        // Force refresh after navigation
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }, 500)
    } catch (error: any) {
      console.error('Error switching role:', error)
      toast({
        title: 'Failed to switch role',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'error',
        duration: 4000,
      })
    } finally {
      setIsSwitchingRole(false)
      setTargetRole(null)
    }
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

  return (
    <>
      {/* Header */}
      <div className="bg-white dark:bg-navy-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
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

          {/* Role & Leadership */}
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
              Role & Leadership
            </h3>
            <div className="space-y-4">
              {/* Current Role Badge */}
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                {isSteward ? (
                  <Crown className="w-5 h-5 text-[#F5C451]" />
                ) : (
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-navy-900 dark:text-white">
                    {isSteward ? 'Steward mode' : 'Disciple mode'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {isSteward 
                      ? 'You can create events, manage fellowships, and lead your community.'
                      : 'Participate in events, join fellowships, and grow in your faith journey.'}
                  </div>
                </div>
              </div>

              {/* Switch Role Button */}
              <button
                onClick={handleRoleSwitchClick}
                disabled={isSwitchingRole}
                className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg bg-[#F5C451] text-[#0F1433] font-medium hover:bg-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSwitchingRole ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0F1433]"></div>
                    <span>Switching...</span>
                  </>
                ) : (
                  <span>
                    {isDisciple ? 'Switch to Steward (leader mode)' : 'Switch to Disciple'}
                  </span>
                )}
              </button>
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

      {/* Confirm Dialog */}
      {showConfirmDialog && targetRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
              Switch to {targetRole === 'disciple' ? 'Disciple' : 'Steward'} mode?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {targetRole === 'disciple'
                ? 'You will switch to Disciple mode. You can still participate in all activities, but you won\'t be able to create events or manage fellowships.'
                : 'You will switch to Steward (leader) mode. This allows you to create events, manage fellowships, and lead your community.'}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false)
                  setTargetRole(null)
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRoleSwitch}
                className="flex-1 px-4 py-2 rounded-lg bg-[#F5C451] text-[#0F1433] font-medium hover:bg-[#D4AF37] transition-colors"
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


