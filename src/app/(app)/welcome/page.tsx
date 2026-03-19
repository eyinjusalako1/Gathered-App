'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Church, MapPin, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import { supabase } from '@/lib/supabase'
import type { FellowshipGroup } from '@/types'
import type { Church as ChurchType } from '@/types/church'

type SuggestedPerson = {
  id: string
  name: string
  city: string | null
  avatar_url: string | null
  interests: string[]
  why_suggested: string | null
}

const getSharedInterest = (personInterests: string[], userInterests: string[]) => {
  const userInterestSet = new Set(userInterests.map((interest) => interest.toLowerCase()))
  return personInterests.find((interest) => userInterestSet.has(interest.toLowerCase())) || null
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'G'

export default function WelcomePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading } = useUserProfile()
  const toast = useToast()

  const [people, setPeople] = useState<SuggestedPerson[]>([])
  const [recommendedGroup, setRecommendedGroup] = useState<FellowshipGroup | null>(null)
  const [recommendedChurch, setRecommendedChurch] = useState<ChurchType | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectingIds, setConnectingIds] = useState<string[]>([])
  const [connectedIds, setConnectedIds] = useState<string[]>([])
  const [isJoiningGroup, setIsJoiningGroup] = useState(false)
  const [hasJoinedGroup, setHasJoinedGroup] = useState(false)
  const [isSettingChurch, setIsSettingChurch] = useState(false)
  const [hasSetChurch, setHasSetChurch] = useState(false)

  const userInterests = useMemo(() => profile?.interests || [], [profile?.interests])

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Your session expired. Please log in again.')
    }

    return session.access_token
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login')
    }
  }, [authLoading, router, user])

  useEffect(() => {
    if (!user || profileLoading) return

    let isMounted = true

    const loadWelcomeData = async () => {
      setLoading(true)

      try {
        const accessToken = await getAccessToken()

        const peopleRequest = fetch('/api/discover/people', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
          .then(async (response) => {
            if (!response.ok) {
              const data = await response.json().catch(() => ({}))
              throw new Error(data.error || 'Failed to load people')
            }
            return response.json()
          })
          .then((data) => (Array.isArray(data.people) ? data.people.slice(0, 3) : []))

        const groupsRequest = fetch('/api/welcome/recommendations', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
          .then(async (response) => {
            if (!response.ok) {
              const data = await response.json().catch(() => ({}))
              throw new Error(data.error || 'Failed to load fellowship recommendation')
            }
            return response.json()
          })
          .then((data) => data.group || null)

        const churchRequest = profile?.my_church_id
          ? Promise.resolve(null)
          : fetch(
              profile?.city
                ? `/api/discover/churches?city=${encodeURIComponent(profile.city)}`
                : '/api/discover/churches?q=Christian%20church'
            )
              .then(async (response) => {
                if (!response.ok) {
                  const data = await response.json().catch(() => ({}))
                  throw new Error(data.error || 'Failed to load churches')
                }
                return response.json()
              })
              .then((data) => (Array.isArray(data.churches) ? data.churches[0] || null : null))

        const [nextPeople, nextGroup, nextChurch] = await Promise.all([
          peopleRequest,
          groupsRequest,
          churchRequest,
        ])

        if (!isMounted) return

        setPeople(nextPeople)
        setRecommendedGroup(nextGroup)
        setRecommendedChurch(nextChurch)
        setHasSetChurch(!!profile?.my_church_id)
      } catch (error: any) {
        if (!isMounted) return
        toast({
          title: 'Unable to finish setup',
          description: error.message || 'Please try again in a moment.',
          variant: 'error',
        })
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadWelcomeData()

    return () => {
      isMounted = false
    }
  }, [profile?.city, profile?.my_church_id, profileLoading, toast, user, userInterests])

  const handleConnect = async (personId: string) => {
    try {
      setConnectingIds((prev) => [...prev, personId])

      const accessToken = await getAccessToken()

      const response = await fetch('/api/connections/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ recipientId: personId }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send connection request')
      }

      setConnectedIds((prev) => [...prev, personId])
      toast({ title: 'Connection request sent', variant: 'success' })
    } catch (error: any) {
      toast({
        title: 'Could not connect',
        description: error.message || 'Please try again.',
        variant: 'error',
      })
    } finally {
      setConnectingIds((prev) => prev.filter((id) => id !== personId))
    }
  }

  const handleJoinGroup = async () => {
    if (!user || !recommendedGroup) return

    try {
      setIsJoiningGroup(true)

      if (recommendedGroup.is_private) {
        await FellowshipService.requestToJoinGroup(recommendedGroup.id, user.id)
        toast({
          title: 'Join request sent',
          description: 'We’ll notify you when the group responds.',
          variant: 'success',
        })
      } else {
        await FellowshipService.joinGroup(recommendedGroup.id, user.id)
        toast({
          title: 'Joined fellowship',
          description: 'You’re now part of the group.',
          variant: 'success',
        })
      }

      setHasJoinedGroup(true)
    } catch (error: any) {
      toast({
        title: 'Could not join group',
        description: error.message || 'Please try again.',
        variant: 'error',
      })
    } finally {
      setIsJoiningGroup(false)
    }
  }

  const handleSetChurch = async () => {
    if (!recommendedChurch) return

    try {
      setIsSettingChurch(true)

      const accessToken = await getAccessToken()

      const response = await fetch('/api/profile/set-church', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'set',
          church: recommendedChurch,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set church')
      }

      setHasSetChurch(true)
      toast({
        title: 'Church updated',
        description: 'We’ll use this to personalize your experience.',
        variant: 'success',
      })
    } catch (error: any) {
      toast({
        title: 'Could not set church',
        description: error.message || 'Please try again.',
        variant: 'error',
      })
    } finally {
      setIsSettingChurch(false)
    }
  }

  if (authLoading || profileLoading || (!user && !authLoading)) {
    return (
      <main className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto"></div>
          <p className="mt-4 text-slate-300">Preparing your first connections...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-navy-900 text-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <section className="space-y-3">
          <span className="inline-flex items-center rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-200">
            First Connection Flow
          </span>
          <div>
            <h1 className="text-3xl font-bold text-white">Start with a few strong next steps</h1>
            <p className="mt-2 text-slate-300 max-w-2xl">
              We picked a few simple ways to help you feel at home in Gathered right away.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-navy-800/30 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-500/15">
              <Users className="h-5 w-5 text-gold-400" />
            </div>
            <div>
              <p className="text-sm text-gold-300">Step 1</p>
              <h2 className="text-lg font-semibold text-white">Suggested people</h2>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Finding people for you...</p>
          ) : people.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {people.map((person) => {
                const sharedInterest = getSharedInterest(person.interests || [], userInterests)
                const isConnecting = connectingIds.includes(person.id)
                const isConnected = connectedIds.includes(person.id)

                return (
                  <div key={person.id} className="rounded-2xl border border-white/10 bg-navy-900/50 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.name}
                          className="h-12 w-12 rounded-full object-cover border border-gold-500/30"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-sm font-semibold text-gold-200">
                          {getInitials(person.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{person.name}</p>
                        <p className="text-sm text-slate-400">{person.city || 'Gathered member'}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 min-h-[40px]">
                      {sharedInterest ? `Shared interest: ${sharedInterest}` : person.why_suggested || 'A thoughtful connection to start with'}
                    </p>
                    <button
                      onClick={() => handleConnect(person.id)}
                      disabled={isConnecting || isConnected}
                      className="w-full rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-100 transition-colors hover:bg-gold-500/20 disabled:opacity-60"
                    >
                      {isConnecting ? 'Connecting...' : isConnected ? 'Request sent' : 'Connect'}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">We’ll suggest people as more members near your profile become available.</p>
          )}
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-navy-800/30 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-500/15">
              <Users className="h-5 w-5 text-gold-400" />
            </div>
            <div>
              <p className="text-sm text-gold-300">Step 2</p>
              <h2 className="text-lg font-semibold text-white">Suggested fellowship group</h2>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Finding a group for you...</p>
          ) : recommendedGroup ? (
            <div className="rounded-2xl border border-white/10 bg-navy-900/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{recommendedGroup.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {recommendedGroup.member_count} members
                    {recommendedGroup.location ? ` · ${recommendedGroup.location}` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-200">
                  {recommendedGroup.is_private ? 'Private' : 'Open'}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                {recommendedGroup.description || 'A welcoming group to help you start building community.'}
              </p>
              <button
                onClick={handleJoinGroup}
                disabled={isJoiningGroup || hasJoinedGroup}
                className="rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-100 transition-colors hover:bg-gold-500/20 disabled:opacity-60"
              >
                {isJoiningGroup
                  ? 'Joining...'
                  : hasJoinedGroup
                    ? recommendedGroup.is_private ? 'Request sent' : 'Joined group'
                    : 'Join group'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">We’ll recommend a group as soon as we find the best fit for you.</p>
          )}
        </section>

        {!profile?.my_church_id && (
          <section className="space-y-4 rounded-3xl border border-white/10 bg-navy-800/30 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-500/15">
                <Church className="h-5 w-5 text-gold-400" />
              </div>
              <div>
                <p className="text-sm text-gold-300">Step 3</p>
                <h2 className="text-lg font-semibold text-white">Suggested church</h2>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Looking for a church near you...</p>
            ) : recommendedChurch ? (
              <div className="rounded-2xl border border-white/10 bg-navy-900/50 p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{recommendedChurch.name}</h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                    <MapPin className="h-4 w-4 text-gold-400" />
                    {typeof recommendedChurch.distance_miles === 'number'
                      ? `${recommendedChurch.distance_miles.toFixed(1)} miles away`
                      : recommendedChurch.city || recommendedChurch.address || 'Nearby church'}
                  </p>
                </div>
                <button
                  onClick={handleSetChurch}
                  disabled={isSettingChurch || hasSetChurch}
                  className="rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-100 transition-colors hover:bg-gold-500/20 disabled:opacity-60"
                >
                  {isSettingChurch ? 'Saving...' : hasSetChurch ? 'My church' : 'Set as my church'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400">We couldn’t find a church recommendation yet, but you can add one later from discovery.</p>
            )}
          </section>
        )}

        <div className="rounded-3xl border border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-navy-800/30 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">You’re ready to enter Gathered</h2>
            <p className="mt-1 text-sm text-slate-300">
              You can keep going now, and come back to any of these later.
            </p>
          </div>
          <button
            onClick={() => router.replace('/dashboard')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
          >
            <span>Enter Gathered</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  )
}
