'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bell, Mail, MessageSquare, Calendar, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

function NotificationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  
  // Determine back href based on where we came from
  const backHref = from === 'profile' ? '/profile' : '/settings'

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
      <div className="bg-white dark:bg-navy-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky z-40" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              {/* Use explicit href instead of router.back() - context-aware based on where we came from */}
              <Link href={backHref} className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">Back</span>
              </Link>
              <h1 className="text-xl font-bold text-navy-900 dark:text-white">
                Notifications
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Notification Settings */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
            Notification Preferences
          </h3>
          <div className="space-y-4">
            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Push Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 dark:peer-focus:ring-gold-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gold-500"></div>
              </label>
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive email updates</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 dark:peer-focus:ring-gold-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gold-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
            Notification Types
          </h3>
          <div className="space-y-4">
            {/* Messages */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Messages</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">New messages and replies</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 dark:peer-focus:ring-gold-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gold-500"></div>
              </label>
            </div>

            {/* Events */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Events</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Event reminders and updates</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 dark:peer-focus:ring-gold-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gold-500"></div>
              </label>
            </div>

            {/* Fellowship Groups */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Fellowship Groups</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Group updates and announcements</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-300 dark:peer-focus:ring-gold-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gold-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function NotificationsSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-beige-50 dark:bg-navy-900 flex items-center justify-center">Loading...</div>}>
      <NotificationsContent />
    </Suspense>
  )
}

