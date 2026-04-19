'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ConnectionUser {
  id: string
  name: string
  avatar_url: string | null
  city: string | null
  bio: string | null
  interests: string[]
}

export interface Connection {
  id: string
  requester_id: string
  recipient_id: string
  status: string
  created_at: string
  other_user: ConnectionUser
}

export function usePendingConnections() {
  const [incoming, setIncoming] = useState<Connection[]>([])
  const [accepted, setAccepted] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConnections = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIncoming([])
        setAccepted([])
        return
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      }

      const response = await fetch('/api/connections/list', { headers, credentials: 'include' })
      if (!response.ok) {
        setIncoming([])
        setAccepted([])
        return
      }

      const data = await response.json()
      setIncoming(data.incoming || [])
      setAccepted(data.accepted || [])
    } catch {
      setIncoming([])
      setAccepted([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  return {
    incoming,
    accepted,
    pendingCount: incoming.length,
    acceptedCount: accepted.length,
    loading,
    refetch: fetchConnections,
  }
}
