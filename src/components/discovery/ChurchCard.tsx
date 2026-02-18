'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Navigation, Share2, Bookmark, CheckCircle, MoreHorizontal } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { Church, ChurchStats } from '@/types/church'
import { getSavedChurches, isChurchSaved, setSavedChurches } from '@/lib/saved-churches'

interface ChurchCardProps {
  church: Church
  stats?: ChurchStats
  onSetMyChurch?: (church: Church) => void
  isSetting?: boolean
}

export default function ChurchCard({ church, stats, onSetMyChurch, isSetting }: ChurchCardProps) {
  const toast = useToast()
  const [savedChurches, setSavedChurchesState] = useState<Church[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setSavedChurchesState(getSavedChurches())
  }, [])

  const isSaved = useMemo(
    () => isChurchSaved(savedChurches, church.id),
    [savedChurches, church.id]
  )

  const handleSave = () => {
    const next = [...savedChurches]
    if (isChurchSaved(next, church.id)) {
      const filtered = next.filter((saved) => saved.id !== church.id)
      setSavedChurchesState(filtered)
      setSavedChurches(filtered)
      toast({ title: 'Removed from saved churches', variant: 'success' })
    } else {
      const updated = [church, ...next]
      setSavedChurchesState(updated)
      setSavedChurches(updated)
      toast({ title: 'Saved to your churches', variant: 'success' })
    }
    setMenuOpen(false)
  }

  const handleOpenMaps = () => {
    const query = church.lat && church.lng
      ? `${church.lat},${church.lng}`
      : encodeURIComponent(church.address || church.name)
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleShare = async () => {
    const shareText = `${church.name}${church.address ? ` — ${church.address}` : ''}`
    const shareUrl =
      church.lat && church.lng
        ? `https://www.google.com/maps/search/?api=1&query=${church.lat},${church.lng}`
        : undefined

    if (navigator.share) {
      try {
        await navigator.share({
          title: church.name,
          text: shareText,
          url: shareUrl,
        })
        setMenuOpen(false)
        return
      } catch {
        // Ignore share cancellation
      }
    }

    if (!navigator.clipboard) {
      toast({ title: 'Sharing not available on this device', variant: 'error' })
      setMenuOpen(false)
      return
    }

    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      toast({ title: 'Link copied to clipboard', variant: 'success' })
    } else {
      await navigator.clipboard.writeText(shareText)
      toast({ title: 'Details copied to clipboard', variant: 'success' })
    }
    setMenuOpen(false)
  }

  return (
    <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/60 hover:shadow-[0_0_25px_rgba(212,175,55,0.25)] transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-lg font-semibold text-white truncate">{church.name}</h4>
              {typeof church.distance_miles === 'number' && (
                <span className="text-xs text-gold-200">
                  {church.distance_miles.toFixed(1)} mi
                </span>
              )}
              {stats?.is_my_church && (
                <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/20 bg-gold-500/5 px-1.5 py-0.5 text-[10px] text-gold-200">
                  <CheckCircle className="w-2.5 h-2.5" />
                  My church
                </span>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="rounded-full border border-white/5 bg-white/5/50 p-1.5 text-slate-300 hover:border-gold-500/30 hover:text-gold-200"
                aria-label="More actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl border border-white/10 bg-navy-900/95 shadow-lg backdrop-blur">
                  <button
                    onClick={handleSave}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {isSaved ? 'Unsave' : 'Save'}
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              )}
            </div>
          </div>
          {(church.address || church.city || church.postcode) && (
            <div className="mt-2 flex items-start gap-2 text-sm text-slate-300">
              <MapPin className="w-4 h-4 text-gold-400 mt-0.5" />
              <span className="line-clamp-2">
                {church.address || [church.city, church.postcode].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {stats && (
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              {stats.members_count > 0 ? (
                <p>
                  <span className="text-gold-200 font-semibold">{stats.members_count}</span> members on Gathered
                </p>
              ) : (
                <p className="text-xs text-gold-300">Be the first from Gathered ✨</p>
              )}
              {stats.connections_count > 0 && (
                <p>
                  <span className="text-gold-200 font-semibold">{stats.connections_count}</span> of your connections go here
                </p>
              )}
            </div>
          )}
          {church.denomination && (
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs text-gold-200">
                {church.denomination}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2">
          <div className="flex flex-wrap gap-1.5">
            {onSetMyChurch && (
              <button
                onClick={() => onSetMyChurch(church)}
                disabled={stats?.is_my_church || isSetting}
                className="flex items-center gap-2 rounded-full border border-gold-500/50 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-100 hover:bg-gold-500/20 disabled:opacity-60"
              >
                {stats?.is_my_church ? 'My church' : 'Set as my church'}
              </button>
            )}
            <button
              onClick={handleOpenMaps}
              className="flex items-center gap-2 rounded-full border border-gold-500/50 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-100 hover:bg-gold-500/20"
            >
              <Navigation className="w-3.5 h-3.5" />
              Open in Maps
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

