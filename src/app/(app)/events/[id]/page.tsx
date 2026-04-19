'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/ui/Toast'
import { EventService } from '@/lib/event-service'
import { FellowshipService } from '@/lib/fellowship-service'
import { Event, EventRSVP, FellowshipGroup } from '@/types'
import { 
  MapPin, 
  Calendar, 
  Clock,
  Users,
  Monitor,
  Globe,
  Tag,
  BookOpen,
  Sparkles,
  Heart,
  Megaphone,
  HeartHandshake,
  Settings,
  CheckCircle,
  UserPlus,
  MessageCircle,
  Share2,
  Copy,
  Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [rsvps, setRsvps] = useState<EventRSVP[]>([])
  const [userRsvp, setUserRsvp] = useState<EventRSVP | null>(null)
  const [eventGroup, setEventGroup] = useState<FellowshipGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [showRsvpModal, setShowRsvpModal] = useState(false)
  const toast = useToast()
  const [rsvpStatus, setRsvpStatus] = useState<'going' | 'not_going'>('going')
  const [guestCount, setGuestCount] = useState(0)
  const [rsvpNotes, setRsvpNotes] = useState('')
  const [eventId, setEventId] = useState<string>('')

  // Resolve params (handle both Promise and direct params for Next.js 14/15 compatibility)
  useEffect(() => {
    const resolveParams = async () => {
      try {
        // In Next.js 14, params is typically an object, in Next.js 15 it might be a Promise
        const resolvedParams = params instanceof Promise ? await params : params
        const id = resolvedParams?.id || ''
        if (id) {
          setEventId(id)
        }
      } catch (error) {
        console.error('Error resolving params:', error)
      }
    }
    resolveParams()
  }, [params])

  const loadEventData = async (id: string) => {
    if (!id) return
    
    try {
      setLoading(true)
      
      console.log('Loading event with ID:', id)
      
      const [eventData, rsvpsData] = await Promise.all([
        EventService.getEvent(id.trim()),
        EventService.getEventRSVPs(id.trim())
      ])

      console.log('Event data received:', eventData ? 'Found' : 'Not found', eventData?.id)

      if (!eventData) {
        // Event not found
        console.warn('Event not found for ID:', id)
        setEvent(null)
        setRsvps([])
        return
      }

      setEvent(eventData)
      setRsvps(rsvpsData)

      // Load group if event is associated with a group
      if (eventData.group_id) {
        try {
          const group = await FellowshipService.getGroup(eventData.group_id)
          setEventGroup(group)
        } catch (error) {
          console.error('Error loading event group:', error)
          // Silently fail, don't break the page
        }
      }

      if (user) {
        const userRsvpData = await EventService.getUserRSVP(id.trim(), user.id)
        setUserRsvp(userRsvpData)
        if (userRsvpData) {
          setRsvpStatus(userRsvpData.status === 'not_going' ? 'not_going' : 'going')
          setGuestCount(userRsvpData.guest_count || 0)
          setRsvpNotes(userRsvpData.notes || '')
        }
      }
    } catch (error: any) {
      console.error('Error loading event data:', error)
      console.error('Event ID was:', id)
      console.error('Error details:', error.message, error.code)
      // If event not found, set event to null to show error state
      if (error?.message?.includes('not found') || error?.code === 'PGRST116' || error?.code === 'PGRST301') {
        setEvent(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) {
      loadEventData(eventId)
    }
  }, [eventId, user])

  const handleRsvp = async () => {
    if (!user || !event) return

    setRsvpLoading(true)
    try {
      // For non-RSVP events, default to 'going' status
      const status = event.requires_rsvp ? rsvpStatus : 'going'
      await EventService.rsvpToEvent(eventId, user.id, status, guestCount, rsvpNotes)
      await loadEventData(eventId)
      setShowRsvpModal(false)
      toast({ title: status === 'going' ? "You're going!" : 'RSVP updated', variant: 'success', duration: 3000 })
    } catch (error: any) {
      console.error('RSVP error:', error)
      toast({ title: error.message || 'Failed to join event', variant: 'error', duration: 4000 })
    } finally {
      setRsvpLoading(false)
    }
  }

  const handleLeaveEvent = async () => {
    if (!user || !event) return

    if (!confirm('Are you sure you want to leave this event?')) return

    setRsvpLoading(true)
    try {
      // Set RSVP status to "not_going" to effectively leave the event
      await EventService.rsvpToEvent(eventId, user.id, 'not_going', 0, '')
      await loadEventData(eventId) // Refresh data
    } catch (error: any) {
      toast({ title: error.message || 'Failed to leave event', variant: 'error', duration: 4000 })
    } finally {
      setRsvpLoading(false)
    }
  }

  const copyEventLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: 'Link copied!', variant: 'success', duration: 2000 })
  }

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'bible_study':
        return <BookOpen className="w-6 h-6" />
      case 'prayer_meeting':
        return <Sparkles className="w-6 h-6" />
      case 'worship':
        return <Heart className="w-6 h-6" />
      case 'evangelism':
        return <Megaphone className="w-6 h-6" />
      case 'community_service':
        return <HeartHandshake className="w-6 h-6" />
      default:
        return <Calendar className="w-6 h-6" />
    }
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'bible_study':
        return 'bg-gold-100 text-gold-600 dark:bg-gold-900 dark:text-gold-400'
      case 'prayer_meeting':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400'
      case 'worship':
        return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
      case 'evangelism':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
      case 'community_service':
        return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
      default:
        return 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric',
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    }
  }

  const getRsvpStatusColor = (status: string) => {
    switch (status) {
      case 'going':
        return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
      case 'maybe':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400'
      case 'not_going':
        return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading event details...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Event Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <button onClick={() => router.push('/events')} className="btn-primary">
            Back to Events
          </button>
        </div>
      </div>
    )
  }

  const isFull = !!event.max_attendees && event.rsvp_count >= event.max_attendees
  const { date, time } = formatEventDate(event.start_time)
  const endTime = new Date(event.end_time).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })

  return (
    <>
      <BackButton label={event.title} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getEventTypeColor(event.event_type)}`}>
              {getEventTypeIcon(event.event_type)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                  {event.is_virtual ? (
                    <Monitor className="w-4 h-4" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span>{event.is_virtual ? 'Virtual Event' : 'In-Person Event'}</span>
                </div>
                <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{event.rsvp_count} going</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={copyEventLink}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Share event"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">About This Event</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>

            {/* Event Details */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Event Details</h2>
              <div className="space-y-4">
                {/* Date & Time */}
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Date & Time</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {date} at {time} - {endTime}
                    </div>
                  </div>
                </div>

                {/* Location */}
                {event.location && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Location</div>
                      <div className="text-gray-600 dark:text-gray-400">{event.location}</div>
                    </div>
                  </div>
                )}

                {/* Group Association */}
                {eventGroup && (
                  <div className="flex items-start space-x-3">
                    <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Hosted by</div>
                      <Link 
                        href={`/fellowship/${eventGroup.id}`}
                        className="text-gold-500 hover:text-gold-600 dark:text-gold-400 dark:hover:text-gold-300 flex items-center space-x-1 transition-colors"
                      >
                        <span>{eventGroup.name}</span>
                        <LinkIcon className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Virtual Link */}
                {event.is_virtual && event.virtual_link && (
                  <div className="flex items-start space-x-3">
                    <Globe className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Virtual Meeting</div>
                      <a 
                        href={event.virtual_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-500 break-all"
                      >
                        {event.virtual_link}
                      </a>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Platform: {event.virtual_platform}
                      </div>
                    </div>
                  </div>
                )}

                {/* Attendees */}
                <div className="flex items-start space-x-3">
                  <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Attendees</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {event.rsvp_count} going
                      {event.max_attendees && ` (max ${event.max_attendees})`}
                    </div>
                  </div>
                </div>

                {/* Recurring */}
                {event.is_recurring && (
                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Recurring Event</div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {event.recurrence_pattern} event
                        {event.recurrence_end_date && ` until ${new Date(event.recurrence_end_date).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP / Join */}
            {user && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {event.requires_rsvp ? 'RSVP' : 'Join Event'}
                </h3>
                
                {userRsvp ? (
                  <div className="space-y-3">
                    <div className={`px-3 py-2 rounded-lg text-sm font-medium ${getRsvpStatusColor(userRsvp.status)}`}>
                      You&apos;re {userRsvp.status === 'going' ? 'going' : userRsvp.status === 'maybe' ? 'maybe going' : 'not going'}
                    </div>
                    {userRsvp.guest_count && userRsvp.guest_count > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Bringing {userRsvp.guest_count} guest{userRsvp.guest_count !== 1 ? 's' : ''}
                      </div>
                    )}
                    {userRsvp.notes && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Note: {userRsvp.notes}
                      </div>
                    )}
                    <div className="flex space-x-2">
                      {event.requires_rsvp && (
                        <button
                          onClick={() => setShowRsvpModal(true)}
                          className="flex-1 btn-secondary"
                        >
                          Update RSVP
                        </button>
                      )}
                      {userRsvp.status === 'going' && (
                        <button
                          onClick={handleLeaveEvent}
                          disabled={rsvpLoading}
                          className={event.requires_rsvp ? "flex-1 btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" : "w-full btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"}
                        >
                          Leave Event
                        </button>
                      )}
                    </div>
                  </div>
                ) : isFull ? (
                  <div className="w-full text-center py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium">
                    This event is full
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (event.requires_rsvp) {
                        setShowRsvpModal(true)
                      } else {
                        handleRsvp()
                      }
                    }}
                    disabled={rsvpLoading}
                    className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>{rsvpLoading ? 'Joining...' : 'Join Event'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Attendees */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Attendees ({rsvps.filter(r => r.status === 'going').length})
              </h3>
              <div className="space-y-3">
                {rsvps.filter(r => r.status === 'going').slice(0, 5).map((rsvp) => {
                  const userProfile = (rsvp as any).user_profile
                  const userName = userProfile?.name || 'Unknown User'
                  const userInitial = userName.charAt(0).toUpperCase()
                  return (
                  <div key={rsvp.id} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                        {userInitial}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {userName}
                      </div>
                      {rsvp.guest_count && rsvp.guest_count > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          +{rsvp.guest_count} guest{rsvp.guest_count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })}
                {rsvps.filter(r => r.status === 'going').length > 5 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 text-center pt-2">
                    +{rsvps.filter(r => r.status === 'going').length - 5} more attendees
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* RSVP Modal */}
      {showRsvpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">RSVP to Event</h3>
            
            <div className="space-y-4">
              {isFull && !userRsvp && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-400">
                  This event is full — no more spots available.
                </div>
              )}
              {/* RSVP Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Will you attend?
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'going', label: 'Going' },
                    { value: 'not_going', label: 'Not Going' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="rsvpStatus"
                        value={option.value}
                        checked={rsvpStatus === option.value}
                        onChange={(e) => setRsvpStatus(e.target.value as 'going' | 'not_going')}
                        className="mr-3"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Guest Count */}
              {event.allow_guests && (
                <div>
                  <label htmlFor="guestCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Guests
                  </label>
                  <input
                    id="guestCount"
                    type="number"
                    min="0"
                    max="10"
                    className="input-field"
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label htmlFor="rsvpNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="rsvpNotes"
                  className="input-field"
                  rows={3}
                  placeholder="Any additional information..."
                  value={rsvpNotes}
                  onChange={(e) => setRsvpNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowRsvpModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRsvp}
                disabled={rsvpLoading || (isFull && !userRsvp && rsvpStatus === 'going')}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rsvpLoading ? 'Saving...' : 'Save RSVP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


