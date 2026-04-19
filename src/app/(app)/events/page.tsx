'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useUserProfile } from '@/hooks/useUserProfile'
import { EventService } from '@/lib/event-service'
import { Event } from '@/types'
import { 
  Plus, 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  Clock,
  Filter,
  Monitor,
  Globe,
  BookOpen,
  Heart,
  Megaphone,
  HeartHandshake,
  Sparkles,
  Settings
} from 'lucide-react'

export default function EventsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { isSteward } = useUserProfile()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterVirtual, setFilterVirtual] = useState<string>('all')
  const [error, setError] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    setError(false)
    setLoading(true)
    try {
      const data = await EventService.getUpcomingEvents(user?.id, 50)
      setEvents(data)
    } catch (err) {
      console.error('Error loading events:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesType = filterType === 'all' || event.event_type === filterType
    const matchesVirtual = filterVirtual === 'all' || 
                          (filterVirtual === 'virtual' && event.is_virtual) ||
                          (filterVirtual === 'in-person' && !event.is_virtual)
    
    return matchesSearch && matchesType && matchesVirtual
  })

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'bible_study':
        return <BookOpen className="w-5 h-5" />
      case 'prayer_meeting':
        return <Sparkles className="w-5 h-5" />
      case 'worship':
        return <Heart className="w-5 h-5" />
      case 'evangelism':
        return <Megaphone className="w-5 h-5" />
      case 'community_service':
        return <HeartHandshake className="w-5 h-5" />
      default:
        return <Calendar className="w-5 h-5" />
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
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading events...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Couldn't load events</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Something went wrong. Please try again.</p>
          <button onClick={loadEvents} className="btn-primary">Try again</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Events & Bible Studies</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Discover and join Christian events in your community
              </p>
            </div>
            
            {isSteward && (
              <button
                onClick={() => router.push('/events/create')}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Event</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search events..."
                  className="input-field pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <select
                className="input-field"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="bible_study">Bible Study</option>
                <option value="prayer_meeting">Prayer Meeting</option>
                <option value="worship">Worship</option>
                <option value="fellowship">Fellowship</option>
                <option value="evangelism">Evangelism</option>
                <option value="community_service">Community Service</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Virtual Filter */}
            <div>
              <select
                className="input-field"
                value={filterVirtual}
                onChange={(e) => setFilterVirtual(e.target.value)}
              >
                <option value="all">All Events</option>
                <option value="virtual">Virtual Only</option>
                <option value="in-person">In-Person Only</option>
              </select>
            </div>

          </div>
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No events found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm || filterType !== 'all' || filterVirtual !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Be the first to create an event in your community!'
              }
            </p>
            {user && (
              <button
                onClick={() => router.push('/events/create')}
                className="btn-primary"
              >
                Create First Event
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const { date, time } = formatEventDate(event.start_time)
              return (
                <div key={event.id} className="card hover:shadow-lg transition-shadow cursor-pointer"
                     onClick={() => router.push(`/events/${event.id}`)}>
                  {/* Event Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getEventTypeColor(event.event_type)}`}>
                        {getEventTypeIcon(event.event_type)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {event.title}
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          {event.is_virtual ? (
                            <Monitor className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-4 h-4" />
                          )}
                          <span>{event.is_virtual ? 'Virtual' : 'In-Person'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {event.description}
                  </p>

                  {/* Date & Time */}
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>{date}</span>
                    <Clock className="w-4 h-4 ml-2" />
                    <span>{time}</span>
                  </div>

                  {/* Location */}
                  {event.location && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}

                  {/* RSVP Count */}
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <Users className="w-4 h-4" />
                    <span>
                      {event.rsvp_count} going
                      {event.max_attendees && ` / ${event.max_attendees} max`}
                    </span>
                  </div>

                  {/* Tags */}
                  {event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {event.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {event.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                          +{event.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/events/${event.id}`)
                    }}
                    className="w-full btn-primary"
                  >
                    {event.requires_rsvp ? 'RSVP Now' : 'View Details'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}








