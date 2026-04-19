'use client'

import { useEffect, useMemo, useState } from 'react'
import { Church, Loader2, LocateFixed, Lock, MapPin, Search, Users } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import ChurchCard from '@/components/discovery/ChurchCard'
import type { Church as ChurchType, ChurchStats } from '@/types/church'

interface PersonResult {
  id: string
  name: string
  city: string | null
  bio: string | null
  interests: string[]
  avatar_url: string | null
  why_suggested: string | null
  connection_status?: 'none' | 'pending' | 'accepted'
}

interface GroupResult {
  id: string
  name: string
  description: string | null
  group_type: string
  location: string | null
  member_count: number
  max_members: number | null
  tags: string[]
  is_private: boolean
  join_status: 'none' | 'pending' | 'member'
}

interface GeoResult {
  display_name: string
  lat: string
  lon: string
  city?: string | null
  county?: string | null
  country?: string | null
  postcode?: string | null
}

type ActiveTab = 'people' | 'groups' | 'churches'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: ActiveTab
}

const RADIUS_OPTIONS = [1, 2, 5, 10, 25]
const DEFAULT_RADIUS = 1
const RADIUS_STORAGE_KEY = 'gathered_discover_radius_miles_v1'
const LAST_COORDS_STORAGE_KEY = 'gathered_discover_last_coords_v1'

export default function SearchModal({ isOpen, onClose, initialTab }: SearchModalProps) {
  const toast = useToast()
  const { profile } = useUserProfile()
  const profileCity = profile?.city?.trim() || null

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab || 'people')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [people, setPeople] = useState<PersonResult[]>([])
  const [groups, setGroups] = useState<GroupResult[]>([])
  const [churches, setChurches] = useState<ChurchType[]>([])
  const [loading, setLoading] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null)
  const [churchStats, setChurchStats] = useState<Record<string, ChurchStats>>({})
  const [settingChurchId, setSettingChurchId] = useState<string | null>(null)
  const [currentMyChurchId, setCurrentMyChurchId] = useState<string | null>(null)

  const [locationMode, setLocationMode] = useState<'near_me' | 'my_city' | 'custom'>('my_city')
  const [customLocation, setCustomLocation] = useState('')
  const [debouncedLocation, setDebouncedLocation] = useState('')
  const [resolvedLocation, setResolvedLocation] = useState<GeoResult | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoResolved, setGeoResolved] = useState(false)

  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS)
  const [sortOption, setSortOption] = useState<'best' | 'nearest'>('best')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoAllowed, setGeoAllowed] = useState(false)
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')

  useEffect(() => {
    if (!isOpen) return
    setActiveTab(initialTab || 'people')
  }, [isOpen, initialTab])

  useEffect(() => {
    if (!isOpen) return
    const storedRadius = typeof window !== 'undefined'
      ? window.localStorage.getItem(RADIUS_STORAGE_KEY)
      : null
    if (storedRadius && !Number.isNaN(Number(storedRadius))) {
      setRadiusMiles(Number(storedRadius))
    }

    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LAST_COORDS_STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { lat: number; lng: number }
          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            setCoords(parsed)
          }
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLocation(customLocation.trim()), 400)
    return () => clearTimeout(timer)
  }, [customLocation])

  useEffect(() => {
    if (!isOpen) return
    const hasGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator
    setGeoAllowed(hasGeolocation)
    if (!hasGeolocation || !navigator.permissions?.query) return
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        setGeoPermission(status.state)
        status.onchange = () => setGeoPermission(status.state)
      })
      .catch(() => {
        setGeoPermission('unknown')
      })
  }, [isOpen])

  useEffect(() => {
    if (locationMode !== 'custom' || debouncedLocation.length === 0) {
      setResolvedLocation(null)
      setGeoResolved(false)
      return
    }

    let isMounted = true
    setGeoLoading(true)
    setGeoResolved(false)
    fetch(`/api/geo/geocode?q=${encodeURIComponent(debouncedLocation)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!isMounted) return
        if (data.error) {
          toast({ title: data.error, variant: 'error' })
          setResolvedLocation(null)
          return
        }
        const [first] = data.results || []
        setResolvedLocation(first || null)
      })
      .catch(() => {
        if (!isMounted) return
        setResolvedLocation(null)
      })
      .finally(() => {
        if (!isMounted) return
        setGeoLoading(false)
        setGeoResolved(true)
      })

    return () => {
      isMounted = false
    }
  }, [debouncedLocation, locationMode, toast])

  useEffect(() => {
    if (!isOpen) return
    if (activeTab === 'people') void loadPeople()
    else if (activeTab === 'groups') void loadGroups()
    else void loadChurches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, activeTab, locationMode, resolvedLocation, radiusMiles, coords, sortOption, isOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(RADIUS_STORAGE_KEY, String(radiusMiles))
  }, [radiusMiles])

  const locationLabel = useMemo(() => {
    if (locationMode === 'near_me') return coords ? 'Near me' : 'Near me'
    if (locationMode === 'my_city') return profileCity ? `Near ${profileCity}` : 'My city'
    if (locationMode === 'custom') {
      return resolvedLocation?.display_name || debouncedLocation || 'Custom location'
    }
    return ''
  }, [coords, debouncedLocation, locationMode, profileCity, resolvedLocation])

  const handleLocationMode = (mode: 'near_me' | 'my_city' | 'custom') => {
    setLocationMode(mode)
    if (mode === 'near_me') handleNearMe()
  }

  const handleNearMe = () => {
    if (!geoAllowed) return
    if (geoPermission === 'denied') {
      toast({ title: 'Location is blocked in browser settings', variant: 'error' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = { lat: position.coords.latitude, lng: position.coords.longitude }
        setCoords(nextCoords)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LAST_COORDS_STORAGE_KEY, JSON.stringify(nextCoords))
        }
      },
      () => {
        toast({ title: 'Location access denied', variant: 'error' })
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const getLocationParams = () => {
    if (locationMode === 'near_me' && coords) {
      return { lat: coords.lat, lng: coords.lng }
    }
    if (locationMode === 'my_city' && profileCity) {
      return { city: profileCity }
    }
    if (locationMode === 'custom') {
      if (resolvedLocation) {
        const latValue = parseFloat(resolvedLocation.lat)
        const lngValue = parseFloat(resolvedLocation.lon)
        if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
          return { lat: latValue, lng: lngValue }
        }
        return { city: resolvedLocation.city || resolvedLocation.postcode || debouncedLocation }
      }
      if (debouncedLocation) {
        return { city: debouncedLocation }
      }
    }
    return {}
  }

  const loadPeople = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setPeople([]); return }

      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const params = new URLSearchParams()
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (radiusMiles) params.set('radius_miles', String(radiusMiles))
      const locationParams = getLocationParams()
      if ('city' in locationParams && locationParams.city) params.set('city', locationParams.city)
      if ('lat' in locationParams && locationParams.lat && 'lng' in locationParams && locationParams.lng) {
        params.set('lat', String(locationParams.lat))
        params.set('lng', String(locationParams.lng))
      }

      const response = await fetch(`/api/discover/people?${params.toString()}`, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) throw new Error('Unable to load people')

      const data = await response.json()
      let peopleResults = (data.people || []) as PersonResult[]

      if (sortOption === 'nearest') {
        const city = ('city' in locationParams ? locationParams.city : null) || null
        if (city) {
          peopleResults = [...peopleResults].sort((a, b) => {
            const aMatch = a.city?.toLowerCase().includes(city.toLowerCase()) ? 0 : 1
            const bMatch = b.city?.toLowerCase().includes(city.toLowerCase()) ? 0 : 1
            if (aMatch !== bMatch) return aMatch - bMatch
            return a.name.localeCompare(b.name)
          })
        }
      }

      setPeople(peopleResults)
    } catch (error: any) {
      toast({ title: error.message || 'Failed to load people', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setGroups([]); return }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }

      const params = new URLSearchParams()
      if (debouncedQuery) params.set('q', debouncedQuery)
      // Groups use city text filter only — no lat/lng radius
      const locationParams = getLocationParams()
      if ('city' in locationParams && locationParams.city) {
        params.set('city', locationParams.city)
      } else if ('lat' in locationParams) {
        // near_me mode: pass city from profile as fallback since groups have no coords
        if (profileCity) params.set('city', profileCity)
      }

      const response = await fetch(`/api/discover/groups?${params.toString()}`, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) throw new Error('Unable to load groups')

      const data = await response.json()
      setGroups(data.groups || [])
    } catch (error: any) {
      toast({ title: error.message || 'Failed to load groups', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadChurches = async () => {
    if (locationMode === 'custom' && debouncedLocation && !geoResolved) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (radiusMiles) params.set('radius_miles', String(radiusMiles))
      const locationParams = getLocationParams()
      if ('lat' in locationParams && locationParams.lat && 'lng' in locationParams && locationParams.lng) {
        params.set('lat', String(locationParams.lat))
        params.set('lng', String(locationParams.lng))
      } else if ('city' in locationParams && locationParams.city) {
        params.set('city', locationParams.city)
      }

      const response = await fetch(`/api/discover/churches?${params.toString()}`)
      if (!response.ok) throw new Error('Unable to load churches')
      const data = await response.json()
      if (data.error) toast({ title: data.error, variant: 'error' })

      let churchResults = (data.churches || []) as ChurchType[]
      if (sortOption === 'best') {
        churchResults = [...churchResults].sort((a, b) => a.name.localeCompare(b.name))
      } else {
        churchResults = [...churchResults].sort((a, b) => {
          if (a.distance_miles == null) return 1
          if (b.distance_miles == null) return -1
          return a.distance_miles - b.distance_miles
        })
      }
      setChurches(churchResults)
      await loadChurchStats(churchResults.map((c) => c.id))
    } catch (error: any) {
      toast({ title: error.message || 'Failed to load churches', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadChurchStats = async (ids: string[]) => {
    if (ids.length === 0) { setChurchStats({}); setCurrentMyChurchId(null); return }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }
      const response = await fetch(`/api/churches/stats?ids=${encodeURIComponent(ids.join(','))}`, { headers })
      if (!response.ok) return
      const data = await response.json()
      const statsList = (data.stats || []) as ChurchStats[]
      const nextStats: Record<string, ChurchStats> = {}
      let myChurchId: string | null = null
      statsList.forEach((stat) => {
        nextStats[stat.id] = stat
        if (stat.is_my_church) myChurchId = stat.id
      })
      setChurchStats(nextStats)
      setCurrentMyChurchId(myChurchId)
    } catch {
      // ignore
    }
  }

  const handleConnect = async (person: PersonResult) => {
    if (connectingId) return
    setConnectingId(person.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch('/api/connections/request', {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipientId: person.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send connection request')
      toast({ title: 'Connection request sent', variant: 'success' })
      setPeople((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, connection_status: 'pending' } : p))
      )
    } catch (error: any) {
      toast({ title: error.message || 'Failed to send request', variant: 'error' })
    } finally {
      setConnectingId(null)
    }
  }

  const handleJoinGroup = async (group: GroupResult) => {
    if (joiningGroupId) return
    setJoiningGroupId(group.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Not authenticated')

      if (group.is_private) {
        const { error } = await supabase.from('join_requests').insert([{
          group_id: group.id,
          user_id: session.user.id,
          status: 'pending',
        }])
        if (error) throw error
        toast({ title: 'Join request sent', variant: 'success' })
      } else {
        const { error } = await supabase.from('group_memberships').insert([{
          group_id: group.id,
          user_id: session.user.id,
          role: 'member',
          status: 'active',
          joined_at: new Date().toISOString(),
        }])
        if (error) throw error
        toast({ title: `Joined ${group.name}`, variant: 'success' })
      }

      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? { ...g, join_status: group.is_private ? 'pending' : 'member', member_count: g.member_count + (group.is_private ? 0 : 1) }
            : g
        )
      )
    } catch (error: any) {
      toast({ title: error.message || 'Failed to join group', variant: 'error' })
    } finally {
      setJoiningGroupId(null)
    }
  }

  const handleSetMyChurch = async (church: ChurchType) => {
    if (settingChurchId) return
    const hasDifferent = currentMyChurchId && currentMyChurchId !== church.id
    if (hasDifferent) {
      const currentName = churches.find((c) => c.id === currentMyChurchId)?.name || 'your current church'
      const confirmed = window.confirm(`Change your church from ${currentName} to ${church.name}?`)
      if (!confirmed) return
    }

    setSettingChurchId(church.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch('/api/profile/set-church', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'set',
          church: {
            id: church.id, name: church.name, lat: church.lat, lng: church.lng,
            address: church.address, city: church.city, postcode: church.postcode,
            denomination: church.denomination, website: church.website, source: church.source,
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to set church')
      toast({ title: 'Updated your church', variant: 'success' })
      await loadChurchStats(churches.map((item) => item.id))
    } catch (error: any) {
      toast({ title: error.message || 'Unable to set church', variant: 'error' })
    } finally {
      setSettingChurchId(null)
    }
  }

  const handleIncreaseRadius = () => {
    const currentIndex = RADIUS_OPTIONS.indexOf(radiusMiles)
    if (currentIndex === -1 || currentIndex === RADIUS_OPTIONS.length - 1) return
    setRadiusMiles(RADIUS_OPTIONS[currentIndex + 1])
  }

  const searchPlaceholder =
    activeTab === 'people'
      ? 'Search by name, city, interests…'
      : activeTab === 'groups'
      ? 'Search by name, type, location…'
      : 'Search churches by name, city, postcode…'

  const emptyTitle =
    activeTab === 'people'
      ? debouncedQuery ? 'No people found' : 'No people to show yet'
      : activeTab === 'groups'
      ? debouncedQuery ? 'No groups found' : 'No groups to show yet'
      : `No churches found within ${radiusMiles} miles of ${locationLabel || 'your area'}`

  const emptyDescription =
    activeTab === 'people'
      ? debouncedQuery ? 'Try a different name or interest.' : 'Search by name or city to find believers near you.'
      : activeTab === 'groups'
      ? debouncedQuery ? 'Try a different name, type, or location.' : 'Search by name or location to find a group.'
      : 'Try increasing the radius or searching a new location.'

  const resultCount =
    activeTab === 'people' ? people.length
    : activeTab === 'groups' ? groups.length
    : churches.length

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Search"
      footer={
        <div className="px-4 py-3 text-xs text-slate-400">
          © OpenStreetMap contributors
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search input */}
        <div className="flex items-center gap-2 bg-navy-800/60 border border-white/10 rounded-2xl px-4 py-3">
          <Search className="w-5 h-5 text-gold-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none text-sm"
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-navy-800/50 rounded-xl p-1">
          {(
            [
              { id: 'people', label: 'People', icon: Users },
              { id: 'groups', label: 'Groups', icon: Users },
              { id: 'churches', label: 'Churches', icon: Church },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id)
                setSortOption(id === 'churches' ? 'nearest' : 'best')
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === id
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Location + filters bar (hidden for groups when no city) */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-gold-500/40 hover:text-gold-200"
          >
            {locationLabel || 'Any location'}
            {activeTab !== 'groups' && ` • ${radiusMiles} mi`}
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-xs font-semibold text-gold-100 hover:bg-gold-500/20"
          >
            Filters
          </button>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-navy-800/40 border border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {/* People results */}
        {!loading && activeTab === 'people' && (
          <div className="space-y-4">
            {people.map((person) => (
              <div
                key={person.id}
                className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/60 hover:shadow-[0_0_25px_rgba(212,175,55,0.25)] transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gold-500/20 border border-gold-500/30 overflow-hidden flex items-center justify-center text-sm font-bold text-gold-100 shrink-0">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      person.name?.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white truncate">{person.name}</h4>
                        {person.city && <p className="text-xs text-slate-400">{person.city}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConnect(person)}
                        disabled={connectingId === person.id || person.connection_status === 'pending'}
                        className="rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-gold-600 disabled:opacity-60 shrink-0"
                      >
                        {person.connection_status === 'pending' ? 'Pending' : 'Connect'}
                      </button>
                    </div>
                    {person.bio && (
                      <p className="mt-1.5 text-xs text-slate-300 line-clamp-1">{person.bio}</p>
                    )}
                    {person.interests?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {person.interests.slice(0, 4).map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-200"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    {person.why_suggested && (
                      <p className="mt-2 text-xs text-gold-200">{person.why_suggested}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Groups results */}
        {!loading && activeTab === 'groups' && (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/40 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-white">{group.name}</h4>
                      {group.is_private && (
                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                        {group.group_type}
                      </span>
                      {group.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gold-400" />
                          {group.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {group.member_count}
                        {group.max_members ? ` / ${group.max_members}` : ''} members
                      </span>
                    </div>
                    {group.description && (
                      <p className="mt-2 text-xs text-slate-400 line-clamp-2">{group.description}</p>
                    )}
                    {group.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {group.join_status === 'member' ? (
                      <span className="rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-300">
                        Joined
                      </span>
                    ) : group.join_status === 'pending' ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400">
                        Requested
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoinGroup(group)}
                        disabled={joiningGroupId === group.id}
                        className="rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-gold-600 disabled:opacity-60 flex items-center gap-1"
                      >
                        {joiningGroupId === group.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : group.is_private ? 'Request' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Churches results */}
        {!loading && activeTab === 'churches' && (
          <div className="space-y-3">
            {churches.map((church) => (
              <ChurchCard
                key={church.id}
                church={church}
                stats={churchStats[church.id]}
                onSetMyChurch={handleSetMyChurch}
                isSetting={settingChurchId === church.id}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && resultCount === 0 && (
          <div className="py-10 text-center space-y-3">
            <h3 className="text-base font-semibold text-white">{emptyTitle}</h3>
            <p className="text-sm text-slate-400">{emptyDescription}</p>
            {activeTab === 'churches' && (
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleIncreaseRadius}
                  className="w-full rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gold-600"
                >
                  Increase radius
                </button>
                <button
                  type="button"
                  onClick={() => handleLocationMode('custom')}
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-gold-500/30"
                >
                  Try another location
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters sheet */}
      <BottomSheet isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-4">
          <div className="flex gap-2 bg-navy-800/30 rounded-xl p-1">
            {(['near_me', 'my_city', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleLocationMode(mode)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  locationMode === mode ? 'bg-gold-500 text-navy-900' : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode === 'near_me' && <LocateFixed className="w-3.5 h-3.5" />}
                {mode === 'my_city' && <MapPin className="w-3.5 h-3.5" />}
                {mode === 'custom' && <Search className="w-3.5 h-3.5" />}
                {mode === 'near_me' ? 'Near me' : mode === 'my_city' ? 'My city' : 'Custom'}
              </button>
            ))}
          </div>

          {locationMode === 'custom' && (
            <div className="space-y-1.5">
              <input
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Type a city or postcode…"
                className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-gold-500/60"
              />
              <p className="text-xs text-slate-400">
                {geoLoading ? 'Resolving location…' : `Searching near ${locationLabel}`}
              </p>
            </div>
          )}

          {/* Radius — not shown for groups tab */}
          {activeTab !== 'groups' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  Radius: {radiusMiles} miles{activeTab === 'people' ? ' (beta)' : ''}
                </p>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as 'best' | 'nearest')}
                  className="bg-navy-800/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
                >
                  {activeTab === 'people' ? (
                    <>
                      <option value="best">Best match</option>
                      <option value="nearest">Nearest (beta)</option>
                    </>
                  ) : (
                    <>
                      <option value="nearest">Nearest</option>
                      <option value="best">Best match (name)</option>
                    </>
                  )}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setRadiusMiles(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      radiusMiles === option
                        ? 'border-gold-500 bg-gold-500/20 text-gold-100'
                        : 'border-white/10 bg-white/5 text-slate-200'
                    }`}
                  >
                    {option} mi
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="w-full rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-gold-400 transition-colors"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </BottomSheet>
  )
}
