'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import SearchModal from '@/components/discovery/SearchModal'
import { useToast } from '@/components/ui/Toast'
import { useUserProfile } from '@/hooks/useUserProfile'
import { supabase } from '@/lib/supabase'
import type { Church } from '@/types/church'

export default function DiscoverPage() {
  const router = useRouter()
  const toast = useToast()
  const { profile } = useUserProfile()
  const [searchOpen, setSearchOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<'people' | 'churches'>('people')
  const [peoplePreview, setPeoplePreview] = useState<any[]>([])
  const [churchesPreview, setChurchesPreview] = useState<Church[]>([])
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [loadingChurches, setLoadingChurches] = useState(true)

  const profileCity = profile?.city?.trim() || null

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoadingPeople(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setPeoplePreview([])
          return
        }

        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (session.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }

        const params = new URLSearchParams()
        if (profileCity) params.set('city', profileCity)
        const response = await fetch(`/api/discover/people?${params.toString()}`, {
          credentials: 'include',
          headers,
        })

        if (!response.ok) {
          throw new Error('Unable to load people')
        }
        const data = await response.json()
        setPeoplePreview((data.people || []).slice(0, 3))
      } catch (error: any) {
        toast({ title: error.message || 'Failed to load people', variant: 'error' })
        setPeoplePreview([])
      } finally {
        setLoadingPeople(false)
      }
    }

    const loadChurchesPreview = async () => {
      try {
        setLoadingChurches(true)
        let coords: { lat: number; lng: number } | null = null
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('gathered_discover_last_coords_v1')
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as { lat: number; lng: number }
              if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                coords = parsed
              }
            } catch {
              coords = null
            }
          }
        }

        const params = new URLSearchParams()
        params.set('radius_miles', '10')
        if (coords) {
          params.set('lat', coords.lat.toString())
          params.set('lng', coords.lng.toString())
        } else if (profileCity) {
          params.set('city', profileCity)
        }

        const response = await fetch(`/api/discover/churches?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Unable to load churches')
        }
        const data = await response.json()
        setChurchesPreview((data.churches || []).slice(0, 3))
      } catch (error: any) {
        toast({ title: error.message || 'Failed to load churches', variant: 'error' })
        setChurchesPreview([])
      } finally {
        setLoadingChurches(false)
      }
    }

    void loadPreview()
    void loadChurchesPreview()
  }, [profileCity, toast])

  return (
    <div className="min-h-screen bg-navy-900 pb-24">
      <div className="bg-navy-800/50 border-b border-white/10 sticky top-0 z-40">
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
        <section className="bg-navy-800/40 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Happening around you</p>
              <p className="text-xs text-slate-400">Christians around you on Gathered right now</p>
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5/50 px-3 py-1">
                  {peoplePreview.length} people near you
                </span>
                <span className="rounded-full border border-white/10 bg-white/5/50 px-3 py-1">
                  {churchesPreview.length} churches nearby
                </span>
                <span className="rounded-full border border-white/10 bg-white/5/50 px-3 py-1">
                  Near {profileCity || 'your area'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setInitialTab('people')
                setSearchOpen(true)
              }}
              className="flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-gold-400 transition-colors"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">People near you</h2>
            <button
              onClick={() => {
                setInitialTab('people')
                setSearchOpen(true)
              }}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              See all →
            </button>
          </div>
          {loadingPeople ? (
            <div className="h-20 bg-navy-800/40 border border-white/10 rounded-2xl animate-pulse" />
          ) : peoplePreview.length === 0 ? (
            <div className="rounded-xl bg-navy-800/30 px-5 py-7 text-sm text-slate-400">
              No believers showing nearby yet. Try searching to connect.
            </div>
          ) : (
            <div className="space-y-3">
              {peoplePreview.map((person) => (
                <div
                  key={person.id}
                  className="bg-navy-900/40 border border-white/10 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-sm font-bold text-gold-100">
                      {person.avatar_url ? (
                        <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        person.name?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{person.name}</p>
                      <p className="text-xs text-slate-400">{person.city || 'Nearby'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Churches near you</h2>
            <button
              onClick={() => {
                setInitialTab('churches')
                setSearchOpen(true)
              }}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              See all →
            </button>
          </div>
          {loadingChurches ? (
            <div className="h-20 bg-navy-800/40 border border-white/10 rounded-2xl animate-pulse" />
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

