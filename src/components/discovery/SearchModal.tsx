'use client'

import { useEffect, useMemo, useState } from 'react'
import { Church, Loader2, LocateFixed, MapPin, Search, Users } from 'lucide-react'
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

interface GeoResult {
  display_name: string
  lat: string
  lon: string
  city?: string | null
  county?: string | null
  country?: string | null
  postcode?: string | null
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'people' | 'churches'
}

const RADIUS_OPTIONS = [1, 2, 5, 10, 25]
const DEFAULT_RADIUS = 1
const RADIUS_STORAGE_KEY = 'gathered_discover_radius_miles_v1'
const LAST_COORDS_STORAGE_KEY = 'gathered_discover_last_coords_v1'

export default function SearchModal({ isOpen, onClose, initialTab }: SearchModalProps) {
  const toast = useToast()
  const { profile } = useUserProfile()
  const profileCity = profile?.city?.trim() || null

  const [activeTab, setActiveTab] = useState<'people' | 'churches'>(initialTab || 'people')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [people, setPeople] = useState<PersonResult[]>([])
  const [churches, setChurches] = useState<ChurchType[]>([])
  const [loading, setLoading] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
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
    if (activeTab === 'people') {
      void loadPeople()
    } else {
      void loadChurches()
    }
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
    if (mode === 'near_me') {
      handleNearMe()
    }
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
      if (!session) {
        setPeople([])
        return
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

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

      if (!response.ok) {
        throw new Error('Unable to load people')
      }

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

  const loadChurches = async () => {
    if (locationMode === 'custom' && debouncedLocation && !geoResolved) {
      return
    }
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
      if (!response.ok) {
        throw new Error('Unable to load churches')
      }
      const data = await response.json()
      if (data.error) {
        toast({ title: data.error, variant: 'error' })
      }

      let churchResults = (data.churches || []) as ChurchType[]
      if (sortOption === 'best') {
        churchResults = [...churchResults].sort((a, b) => a.name.localeCompare(b.name))
      } else {
        churchResults = [...churchResults].sort((a, b) => {
          if (a.distance_miles === null || a.distance_miles === undefined) return 1
          if (b.distance_miles === null || b.distance_miles === undefined) return -1
          return a.distance_miles - b.distance_miles
        })
      }
      setChurches(churchResults)
      await loadChurchStats(churchResults.map((church) => church.id))
    } catch (error: any) {
      toast({ title: error.message || 'Failed to load churches', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadChurchStats = async (ids: string[]) => {
    if (ids.length === 0) {
      setChurchStats({})
      setCurrentMyChurchId(null)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }
      const response = await fetch(`/api/churches/stats?ids=${encodeURIComponent(ids.join(','))}`, {
        headers,
      })
      if (!response.ok) return
      const data = await response.json()
      const statsList = (data.stats || []) as ChurchStats[]
      const nextStats: Record<string, ChurchStats> = {}
      let myChurchId: string | null = null
      statsList.forEach((stat) => {
        nextStats[stat.id] = stat
        if (stat.is_my_church) {
          myChurchId = stat.id
        }
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
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send connection request')
      }
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
            id: church.id,
            name: church.name,
            lat: church.lat,
            lng: church.lng,
            address: church.address,
            city: church.city,
            postcode: church.postcode,
            denomination: church.denomination,
            website: church.website,
            source: church.source,
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Unable to set church')
      }
      toast({ title: 'Updated your church', variant: 'success' })
      await loadChurchStats(churches.map((item) => item.id))
    } catch (error: any) {
      toast({ title: error.message || 'Unable to set church', variant: 'error' })
    } finally {
      setSettingChurchId(null)
    }
  }

  const emptyStateCopy = useMemo(() => {
    if (loading) return null
    if (activeTab === 'people') {
      return {
        title: debouncedQuery ? 'No people found' : 'No people to show yet',
        description: debouncedQuery
          ? 'Try a different name or interest.'
          : 'Try searching by name or city to discover new connections.',
      }
    }
    const location = locationLabel || 'your area'
    return {
      title: `No churches found within ${radiusMiles} miles of ${location}`,
      description: 'Try increasing the radius or searching a new location.',
    }
  }, [activeTab, debouncedQuery, loading, locationLabel, radiusMiles])

  const handleIncreaseRadius = () => {
    const currentIndex = RADIUS_OPTIONS.indexOf(radiusMiles)
    if (currentIndex === -1 || currentIndex === RADIUS_OPTIONS.length - 1) return
    setRadiusMiles(RADIUS_OPTIONS[currentIndex + 1])
  }

  const isPeople = activeTab === 'people'

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
        <div className="flex items-center gap-2 bg-navy-800/60 border border-white/10 rounded-2xl px-4 py-3">
          <Search className="w-5 h-5 text-gold-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              isPeople
                ? 'Search people by name, city, interests…'
                : 'Search churches by name, city, postcode…'
            }
            className="flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 bg-navy-800/50 rounded-xl p-1">
          <button
            onClick={() => {
              setActiveTab('people')
              setSortOption('best')
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
              isPeople
                ? 'bg-gold-500 text-navy-900'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            People
          </button>
          <button
            onClick={() => {
              setActiveTab('churches')
              setSortOption('nearest')
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
              !isPeople
                ? 'bg-gold-500 text-navy-900'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Church className="w-4 h-4" />
            Churches
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-gold-500/40 hover:text-gold-200"
          >
            {locationLabel} • {radiusMiles} mi
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-xs font-semibold text-gold-100 hover:bg-gold-500/20"
          >
            Filters
          </button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-24 rounded-2xl bg-navy-800/40 border border-white/10 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && isPeople && (
          <div className="space-y-4">
            {people.map((person) => (
              <div
                key={person.id}
                className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/60 hover:shadow-[0_0_25px_rgba(212,175,55,0.25)] transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gold-500/20 border border-gold-500/30 overflow-hidden flex items-center justify-center text-sm font-bold text-gold-100">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      person.name?.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-lg font-semibold text-white truncate">{person.name}</h4>
                        {person.city && (
                          <p className="text-xs text-slate-400">{person.city}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConnect(person)}
                        disabled={connectingId === person.id || person.connection_status === 'pending'}
                        className="rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-gold-600 disabled:opacity-60"
                      >
                        {person.connection_status === 'pending' ? 'Pending' : 'Connect'}
                      </button>
                    </div>
                    {person.bio && (
                      <p className="mt-2 text-sm text-slate-300 line-clamp-1">{person.bio}</p>
                    )}
                    {person.interests?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {person.interests.slice(0, 4).map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    {person.why_suggested && (
                      <p className="mt-3 text-xs text-gold-200">
                        {person.why_suggested}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !isPeople && (
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

        {!loading && emptyStateCopy && (isPeople ? people.length === 0 : churches.length === 0) && (
          <div className="py-10 text-center text-slate-300 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">{emptyStateCopy.title}</h3>
              <p className="text-sm text-slate-400">{emptyStateCopy.description}</p>
            </div>
            {!isPeople && (
              <div className="flex flex-col gap-2">
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
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-gold-500/30 hover:text-gold-100"
                >
                  Try another location
                </button>
                <a
                  href="#"
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-gold-500/30 hover:text-gold-100"
                >
                  Suggest a church
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
      >
        <div className="space-y-4">
          <div className="flex gap-2 bg-navy-800/30 rounded-xl p-1">
            <button
              onClick={() => handleLocationMode('near_me')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${
                locationMode === 'near_me'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LocateFixed className="w-4 h-4" />
              Near me
            </button>
            <button
              onClick={() => handleLocationMode('my_city')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${
                locationMode === 'my_city'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapPin className="w-4 h-4" />
              My city
            </button>
            <button
              onClick={() => handleLocationMode('custom')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${
                locationMode === 'custom'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              Custom
            </button>
          </div>

          {locationMode === 'custom' && (
            <div className="space-y-2">
              <input
                value={customLocation}
                onChange={(event) => setCustomLocation(event.target.value)}
                placeholder="Type a city or postcode (e.g., Dartford, DA1)"
                className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-gold-500/60"
              />
              <div className="text-xs text-slate-400">
                {geoLoading ? 'Resolving location…' : `Searching near ${locationLabel}`}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">
                Radius: {radiusMiles} miles {isPeople ? '(beta)' : ''}
              </p>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as 'best' | 'nearest')}
                className="bg-navy-800/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
              >
                {isPeople ? (
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

