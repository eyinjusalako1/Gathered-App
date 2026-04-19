'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePendingConnections } from '@/hooks/usePendingConnections'
import {
  User,
  Calendar,
  Users,
  Award,
  Settings,
  MapPin,
  Edit,
  ChevronRight,
  Sparkles,
  Bookmark,
  BookOpen,
  Heart,
  MessageCircle,
  Shield,
} from 'lucide-react'
import Image from 'next/image'
import type { Church } from '@/types/church'
import ChurchCard from '@/components/discovery/ChurchCard'
import { getSavedChurches } from '@/lib/saved-churches'

export default function MorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const { acceptedCount } = usePendingConnections()
  // Extract name from profile
  const displayName = profile?.name || user?.email?.split('@')[0] || 'User'
  const firstName = displayName.split(' ')[0] || displayName
  const [savedChurches, setSavedChurches] = useState<Church[]>([])

  useEffect(() => {
    setSavedChurches(getSavedChurches())
  }, [])

  const menuItems = [
    {
      id: 'whats-new',
      label: "What's New",
      icon: Sparkles,
      route: '/more/whats-new',
      description: 'Recent updates to Gathered',
      comingSoon: false
    },
    {
      id: 'saved-verses',
      label: 'Saved Verses',
      icon: Bookmark,
      route: '/more/saved-verses',
      description: 'Verses you\'ve saved from devotions',
      comingSoon: false
    },
    {
      id: 'founder-message',
      label: 'Founder Message',
      icon: MessageCircle,
      route: '/more/founder-message',
      description: 'A note from the founder',
      comingSoon: false
    },
    {
      id: 'reflections',
      label: 'Saved Reflections',
      icon: BookOpen,
      route: '/more/reflections',
      description: 'Your devotional reflections',
      comingSoon: false
    },
    {
      id: 'prayers',
      label: 'Saved Prayers',
      icon: Heart,
      route: '/more/prayers',
      description: 'Your devotional prayers',
      comingSoon: false
    },
    {
      id: 'connections',
      label: 'My Connections',
      icon: Users,
      route: '/more/connections',
      description: acceptedCount > 0 ? `${acceptedCount} connection${acceptedCount === 1 ? '' : 's'}` : 'People you\'ve connected with',
      comingSoon: false
    },
    {
      id: 'community-guidelines',
      label: 'Community Guidelines',
      icon: Shield,
      route: '/community-guidelines',
      description: 'Safety rules and expectations',
      comingSoon: false
    },
    {
      id: 'badges',
      label: 'Badges',
      icon: Award,
      route: '#',
      description: 'Your achievements',
      comingSoon: true
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      route: '/settings',
      description: 'App preferences and account'
    }
  ]

  const handleItemClick = (item: typeof menuItems[0]) => {
    if (item.comingSoon) {
      return // Don't navigate if coming soon
    }
    if (item.route !== '#') {
      router.push(item.route)
    }
  }

  const getInitials = () => {
    if (profile?.name) {
      const nameParts = profile.name.trim().split(' ')
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      }
      return profile.name[0].toUpperCase()
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-50">More</h1>
        </div>

        {/* User Mini Profile Card */}
        <div className="mb-6 bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/30 transition-all">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              {profile?.avatar_url ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold-500/30">
                  <Image
                    src={profile.avatar_url}
                    alt={profile?.name || 'User'}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 border-2 border-gold-500/30 flex items-center justify-center">
                  <span className="text-xl font-semibold text-gold-500">
                    {getInitials()}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-50 truncate">
                {profile?.name || user?.email?.split('@')[0] || 'User'}
              </h2>
              {profile?.city && (
                <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{profile.city}</span>
                </div>
              )}
            </div>

            {/* Edit Button */}
            <button
              onClick={() => router.push('/profile')}
              className="px-4 py-2 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-500 text-sm font-medium hover:bg-gold-500/20 transition-colors flex items-center gap-2"
            >
              <Edit className="w-3 h-3" />
              Edit
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isComingSoon = item.comingSoon

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                disabled={isComingSoon}
                className={`w-full flex items-center gap-4 p-4 bg-navy-900/40 border border-white/10 rounded-xl hover:border-gold-500/30 transition-all ${
                  isComingSoon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isComingSoon 
                    ? 'bg-slate-700/30 text-slate-500' 
                    : 'bg-gold-500/10 text-gold-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-50">
                      {item.label}
                    </h3>
                    {isComingSoon && (
                      <span className="px-2 py-0.5 text-xs bg-purple-500/15 text-purple-300 border border-purple-400/30 rounded-full">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
                {!isComingSoon && (
                  <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* Saved Churches */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-50">Saved Churches</h2>
            <button
              onClick={() => router.push('/discover')}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              Find more
            </button>
          </div>
          {savedChurches.length === 0 ? (
            <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-5 text-center">
              <p className="text-sm text-slate-300">No saved churches yet.</p>
              <p className="mt-2 text-xs text-slate-500">
                Save churches from Discovery to see them here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedChurches.map((church) => (
                <ChurchCard key={church.id} church={church} />
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Gathered App
          </p>
        </div>
      </div>
    </div>
  )
}

