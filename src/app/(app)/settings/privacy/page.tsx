'use client'

import React, { useEffect, useState } from 'react'
import AppHeader from '@/components/AppHeader'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

export default function PrivacySettingsPage() {
  const { profile, updateProfile } = useUserProfile()
  const toast = useToast()
  const [profileVisible, setProfileVisible] = useState(true)
  const [saving, setSaving] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; name: string; avatar_url: string | null; city: string | null }>>([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)

  useEffect(() => {
    if (profile?.discoverable !== undefined && profile?.discoverable !== null) {
      setProfileVisible(Boolean(profile.discoverable))
    }
  }, [profile?.discoverable])

  const loadBlockedUsers = async () => {
    setLoadingBlocked(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/safety/blocked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (!response.ok) return
      const data = await response.json()
      const normalized = (data.blocked || [])
        .map((item: any) => item.profile)
        .filter(Boolean)
      setBlockedUsers(normalized)
    } catch {
      // ignore
    } finally {
      setLoadingBlocked(false)
    }
  }

  const handleUnblock = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch('/api/safety/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ blocked_user_id: userId, action: 'unblock' }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to unblock')
      }
      setBlockedUsers((prev) => prev.filter((user) => user.id !== userId))
      toast({ title: 'User unblocked', variant: 'success' })
    } catch (error: any) {
      toast({ title: 'Failed to unblock', description: error.message, variant: 'error' })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({ discoverable: profileVisible })
      toast({ title: 'Privacy settings saved', variant: 'success' })
    } catch (error: any) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }
  useEffect(() => {
    void loadBlockedUsers()
  }, [])

  return (
    <>
      <AppHeader title="Privacy & Safety" subtitle="Visibility, blocking" backHref="/settings" />
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <label className="flex items-center justify-between bg-white/5 border border-[#D4AF37]/30 rounded-xl p-4 text-white">
          <span>Show profile publicly</span>
          <input type="checkbox" checked={profileVisible} onChange={(e)=>setProfileVisible(e.target.checked)} />
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#F5C451] text-[#0F1433] py-3 rounded-lg font-semibold hover:bg-[#D4AF37] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Blocked users</h2>
            <button
              type="button"
              onClick={loadBlockedUsers}
              className="text-xs text-gold-200 hover:text-gold-100"
            >
              Refresh
            </button>
          </div>
          {loadingBlocked ? (
            <div className="text-sm text-slate-400">Loading blocked users...</div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-sm text-slate-400">No blocked users yet.</div>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-10 h-10 rounded-full border border-gold-500/30"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-xs text-gold-200">
                        {user.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-white">{user.name}</div>
                      {user.city && (
                        <div className="text-xs text-slate-400">{user.city}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblock(user.id)}
                    className="text-xs text-gold-200 hover:text-gold-100"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}






