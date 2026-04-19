'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'gathered_notifications_dismissed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(STORAGE_KEY) === 'true') return
    setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  const handleEnable = async () => {
    setLoading(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notifications blocked. Enable them in your browser settings.')
        setLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('VAPID key not configured')

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (!res.ok) throw new Error('Failed to save subscription')

      dismiss()
    } catch (err: any) {
      console.error('Notification enable failed:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <section className="rounded-2xl border border-gold-500/30 bg-navy-800/80 p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-gold-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1">
            Stay connected to your community
          </p>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            Get notified when your streak is at risk, your group is active, or someone connects with you.
          </p>

          {error && (
            <p className="text-xs text-red-400 mb-2">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Enabling…' : 'Enable notifications'}
            </button>
            <button
              onClick={dismiss}
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
