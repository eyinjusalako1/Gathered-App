'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, MapPin, Search, CheckCircle, XCircle, Users, Loader2, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import SearchModal from '@/components/discovery/SearchModal'
import { Skeleton, SkeletonText, SkeletonAvatar } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePendingConnections } from '@/hooks/usePendingConnections'
import { supabase } from '@/lib/supabase'
import type { Church } from '@/types/church'

// ─── church cache helpers ────────────────────────────────────────────────────

const CHURCH_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const CHURCH_CACHE_PREFIX = 'gathered_church_preview_v1_'

function getChurchCacheKey(coords: { lat: number; lng: number } | null, city: string | null): string {
  if (coords) return `${CHURCH_CACHE_PREFIX}${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`
  if (city) return `${CHURCH_CACHE_PREFIX}city_${city.toLowerCase().replace(/\s+/g, '_')}`
  return `${CHURCH_CACHE_PREFIX}default`
}

function getFreshCachedChurches(key: string): Church[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw) as { ts: number; data: Church[] }
    if (Date.now() - ts > CHURCH_CACHE_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

function getStaleCachedChurches(key: string): Church[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const { data } = JSON.parse(raw) as { ts: number; data: Church[] }
    return data || null
  } catch {
    return null
  }
}

function setCachedChurches(key: string, data: Church[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const router = useRouter()
  const toast = useToast()
  const { profile } = useUserProfile()
  const [searchOpen, setSearchOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<'people' | 'groups' | 'churches'>('people')
  const [peoplePreview, setPeoplePreview] = useState<any[]>([])
  const [churchesPreview, setChurchesPreview] = useState<Church[]>([])
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [loadingChurches, setLoadingChurches] = useState(true)
  const [churchFetchError, setChurchFetchError] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const {
    incoming: pendingRequests,
    pendingCount,
    acceptedCount,
    refetch: refetchConnections,
  } = usePendingConnections()

  const profileCity = profile?.city?.trim() || null

  // ─── church fetch with timeout + cache ──────────────────────────────────────

  const loadChurchesPreview = useCallback(async () => {
    setLoadingChurches(true)
    setChurchFetchError(false)

    let coords: { lat: number; lng: number } | null = null
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('gathered_discover_last_coords_v1')
        if (raw) {
          const parsed = JSON.parse(raw) as { lat: number; lng: number }
          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            coords = parsed
          }
        }
      } catch {
        coords = null
      }
    }

    const cacheKey = getChurchCacheKey(coords, profileCity)

    // Serve fresh cache immediately — no fetch needed
    const fresh = getFreshCachedChurches(cacheKey)
    if (fresh) {
      setChurchesPreview(fresh.slice(0, 3))
      setLoadingChurches(false)
      return
    }

    const params = new URLSearchParams()
    params.set('radius_miles', '10')
    if (coords) {
      params.set('lat', coords.lat.toString())
      params.set('lng', coords.lng.toString())
    } else if (profileCity) {
      params.set('city', profileCity)
    }

    try {
      const response = await fetch(`/api/discover/churches?${params.toString()}`)
      if (!response.ok) throw new Error('Unable to load churches')
      const data = await response.json()
      const churches = (data.churches || []) as Church[]
      setCachedChurches(cacheKey, churches)
      setChurchesPreview(churches.slice(0, 3))
    } catch {
      // Fall back to stale cache before showing error UI
      const stale = getStaleCachedChurches(cacheKey)
      if (stale && stale.length > 0) {
        setChurchesPreview(stale.slice(0, 3))
      } else {
        setChurchFetchError(true)
        setChurchesPreview([])
      }
    } finally {
      setLoadingChurches(false)
    }
  }, [profileCity])

  // ─── people fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadPeoplePreview = async () => {
      try {
        setLoadingPeople(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setPeoplePreview([]); return }

        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

        const params = new URLSearchParams()
        if (profileCity) params.set('city', profileCity)
        const response = await fetch(`/api/discover/people?${params.toString()}`, {
          credentials: 'include',
          headers,
        })

        if (!response.ok) throw new Error('Unable to load people')
        const data = await response.json()
        setPeoplePreview((data.people || []).slice(0, 3))
      } catch (error: any) {
        toast({ title: error.message || 'Failed to load people', variant: 'error' })
        setPeoplePreview([])
      } finally {
        setLoadingPeople(false)
      }
    }

    void loadPeoplePreview()
    void loadChurchesPreview()
  }, [profileCity, toast, loadChurchesPreview])

  // ─── connection respond ──────────────────────────────────────────────────────

  const handleRespond = useCallback(async (connectionId: string, action: 'accept' | 'reject') => {
    setRespondingId(connectionId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ connectionId, action }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to respond')

      if (action === 'accept' && data.threadId) {
        toast({ title: "You're connected! Say hi 👋", variant: 'success' })
        router.push(`/chat/dm/${data.threadId}`)
      } else {
        toast({ title: action === 'accept' ? 'Connected!' : 'Request declined', variant: 'success' })
        refetchConnections()
      }
    } catch (error: any) {
      toast({ title: error.message || 'Something went wrong', variant: 'error' })
    } finally {
      setRespondingId(null)
    }
  }, [router, toast, refetchConnections])

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="bg-navy-800/50 border-b border-white/10 sticky z-40" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-slate-400 hover:text-slate-50 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-3">
              <Logo size="sm" showText={false} />
              <h1 className="text-lg font-bold text-white">Discover</h1>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-slate-300 hover:text-white transition-colors"
              aria-label="Search"
            >
              <Search className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-10 space-y-8">

        {/* ── Summary card ──────────────────────────────────────────────── */}
        <section className="bg-navy-800/40 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Happening around you</p>
              <p className="text-xs text-slate-400">Christians around you on Gathered right now</p>
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {peoplePreview.length} people near you
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {churchesPreview.length} churches nearby
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Near {profileCity || 'your area'}
                </span>
              </div>
            </div>
            <button
              onClick={() => { setInitialTab('people'); setSearchOpen(true) }}
              className="flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-gold-400 transition-colors shrink-0"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </section>

        {/* ── Connection requests ───────────────────────────────────────── */}
        {pendingCount > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Connection Requests</h2>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gold-500 text-navy-900 text-[10px] font-bold">
                  {pendingCount}
                </span>
              </div>
              <button
                onClick={() => router.push('/more/connections?tab=incoming')}
                className="text-xs text-gold-400 hover:text-gold-300"
              >
                View all →
              </button>
            </div>

            <div className="space-y-3">
              {pendingRequests.slice(0, 3).map((req) => (
                <div key={req.id} className="bg-navy-800/50 border border-gold-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-sm font-bold text-gold-100 shrink-0 overflow-hidden">
                      {req.other_user.avatar_url ? (
                        <img src={req.other_user.avatar_url} alt={req.other_user.name} className="w-full h-full object-cover" />
                      ) : (
                        req.other_user.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{req.other_user.name}</p>
                      {req.other_user.city && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{req.other_user.city}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRespond(req.id, 'accept')}
                        disabled={respondingId === req.id}
                        className="flex items-center gap-1 bg-gold-500 text-navy-900 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gold-400 transition-colors disabled:opacity-50"
                      >
                        {respondingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'reject')}
                        disabled={respondingId === req.id}
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                        aria-label="Decline"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {req.other_user.bio && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-1 pl-[52px]">{req.other_user.bio}</p>
                  )}
                </div>
              ))}

              {pendingCount > 3 && (
                <button
                  onClick={() => router.push('/more/connections?tab=incoming')}
                  className="w-full text-center text-xs text-gold-400 hover:text-gold-300 py-2"
                >
                  +{pendingCount - 3} more requests — View all connections →
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── My Connections card ───────────────────────────────────────── */}
        {acceptedCount > 0 && (
          <button
            onClick={() => router.push('/more/connections')}
            className="w-full bg-navy-800/40 border border-white/10 hover:border-gold-500/30 rounded-2xl p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">My Connections</p>
                <p className="text-xs text-slate-400">
                  {acceptedCount} connection{acceptedCount === 1 ? '' : 's'} · Message or view your community
                </p>
              </div>
              <span className="text-xs text-gold-400 shrink-0">View →</span>
            </div>
          </button>
        )}

        {/* ── People near you ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">People near you</h2>
            <button
              onClick={() => { setInitialTab('people'); setSearchOpen(true) }}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              See all →
            </button>
          </div>
          {loadingPeople ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-navy-900/40 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <SkeletonAvatar size="md" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonText width="1/3" />
                      <SkeletonText width="1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : peoplePreview.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-navy-900/40 p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                <Users className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-200">No believers nearby yet</p>
              <p className="text-xs text-slate-400">Try expanding your search or browse by interest</p>
              <button
                onClick={() => { setInitialTab('people'); setSearchOpen(true) }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Search people
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {peoplePreview.map((person) => (
                <div key={person.id} className="bg-navy-900/40 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-sm font-bold text-gold-100 overflow-hidden shrink-0">
                      {person.avatar_url ? (
                        <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        person.name?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{person.name}</p>
                      <p className="text-xs text-slate-400">{person.city || 'Nearby'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Churches near you ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Churches near you</h2>
            <button
              onClick={() => { setInitialTab('churches'); setSearchOpen(true) }}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              See all →
            </button>
          </div>
          {loadingChurches ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 space-y-2">
                  <SkeletonText width="1/2" />
                  <SkeletonText width="2/3" />
                  <Skeleton className="h-3 w-24 rounded-full" />
                </div>
              ))}
            </div>
          ) : churchFetchError ? (
            <div className="rounded-xl bg-navy-800/30 border border-white/10 px-5 py-6 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-400">Couldn't load churches right now.</p>
              <button
                onClick={loadChurchesPreview}
                className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 shrink-0 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : churchesPreview.length === 0 ? (
            <div className="rounded-xl bg-navy-800/30 px-5 py-7 text-sm text-slate-400">
              No churches to show yet. Try searching by name or location.
            </div>
          ) : (
            <div className="space-y-3">
              {churchesPreview.map((church) => (
                <div
                  key={church.id}
                  className="bg-navy-800/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/30 transition-colors"
                >
                  <p className="text-sm font-semibold text-white">{church.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-gold-400" />
                    <span>
                      {church.distance_miles
                        ? `${church.city || 'Nearby'} · ${church.distance_miles.toFixed(1)} mi`
                        : church.address || church.city || 'Nearby'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialTab={initialTab}
      />
    </div>
  )
}
