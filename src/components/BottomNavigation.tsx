'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Home, Calendar, MessageCircle, Users, BookOpen, Compass } from 'lucide-react'
import { useUnreadActivity } from '@/hooks/useUnreadActivity'
import { usePendingConnections } from '@/hooks/usePendingConnections'

interface BottomNavProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'fellowships', label: 'Fellowships', icon: Users },
  { id: 'devotions', label: 'Devotions', icon: BookOpen },
  { id: 'discover', label: 'Discover', icon: Compass }
]

export default function BottomNavigation({ activeTab = 'home', onTabChange }: BottomNavProps) {
  const pathname = usePathname()
  const [currentTab, setCurrentTab] = useState(activeTab)
  const { hasUnread } = useUnreadActivity()
  const { pendingCount } = usePendingConnections()
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  // Sync with prop changes
  useEffect(() => {
    setCurrentTab(activeTab)
  }, [activeTab])

  // Hide nav when the software keyboard is open on chat pages
  useEffect(() => {
    const isChatPage = pathname?.startsWith('/chat/')
    if (!isChatPage) {
      setKeyboardVisible(false)
      return
    }

    if (typeof window === 'undefined' || !window.visualViewport) return

    // Capture the full-screen height once as a stable baseline.
    // window.innerHeight is NOT used inside the handler because iOS updates
    // it when the keyboard opens, making it useless as a reference point.
    const baselineHeight = window.innerHeight

    const handleResize = () => {
      const viewportHeight = window.visualViewport!.height
      // Keyboard is open when the visual viewport has shrunk by more than
      // 150px from baseline. This threshold ignores iOS Safari URL-bar
      // hide/show (which is typically <100px) but catches any real keyboard.
      setKeyboardVisible(baselineHeight - viewportHeight > 150)
    }

    window.visualViewport!.addEventListener('resize', handleResize)
    return () => window.visualViewport!.removeEventListener('resize', handleResize)
  }, [pathname])

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId)
    onTabChange?.(tabId)
  }

  if (keyboardVisible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-white/5 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-around py-2 px-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all duration-200 flex-1 max-w-[80px] ${
                  isActive
                    ? 'text-[#F5C451] bg-[#F5C451]/10 dark:bg-[#F5C451]/10'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className={`relative ${
                  isActive ? 'scale-110' : 'scale-100'
                } transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${
                    isActive ? 'text-[#F5C451]' : ''
                  }`} />
                  {/* Unread Activity Badge - shows on home tab when there's unread activity */}
                  {tab.id === 'home' && hasUnread && !isActive && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-navy-900" />
                  )}
                  {/* Pending connections badge - shows on Discover tab */}
                  {tab.id === 'discover' && pendingCount > 0 && !isActive && (
                    <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-[#F5C451] rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-navy-900 leading-none px-0.5">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    </div>
                  )}
                </div>
                <span className={`text-xs font-semibold mt-1 ${
                  isActive ? 'text-[#F5C451]' : ''
                }`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}






