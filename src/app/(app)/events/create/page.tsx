'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import BackButton from '@/components/BackButton'
import { EventService } from '@/lib/event-service'
import { FellowshipService } from '@/lib/fellowship-service'
import { Event, FellowshipGroup } from '@/types'
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
} from 'lucide-react'

export default function CreateEventPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const { profile, isSteward, isLoading: profileLoading } = useUserProfile()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userGroups, setUserGroups] = useState<FellowshipGroup[]>([])
  const [prefillGroup, setPrefillGroup] = useState<FellowshipGroup | null>(null)
  const [loadingGroup, setLoadingGroup] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!profileLoading && !user) {
      router.replace('/auth/login')
      return
    }
  }, [user, profileLoading, router])

  // Redirect if user is not a Steward
  useEffect(() => {
    if (!profileLoading && profile) {
      if (!isSteward) {
        toast({
          title: 'Access Restricted',
          description: 'Only Stewards can create events.',
          variant: 'error',
          duration: 4000,
        })
        router.replace('/dashboard')
      }
    }
  }, [profile, isSteward, profileLoading, router, toast])
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'bible_study' as Event['event_type'],
    location: '',
    is_virtual: false,
    virtual_link: '',
    virtual_platform: 'zoom' as Event['virtual_platform'],
    start_time: '',
    end_time: '',
    max_attendees: '',
    group_id: '',
    requires_rsvp: true,
    allow_guests: true,
    tags: '',
  })

  // Load group and prefill data from URL query params
  useEffect(() => {
    const groupId = searchParams?.get('group_id')
    const title = searchParams?.get('title')
    const description = searchParams?.get('description')
    const tags = searchParams?.get('tags')
    const locationHint = searchParams?.get('location_hint')
    const timeHint = searchParams?.get('time_hint')

    if (groupId && user) {
      loadPrefillGroup(groupId)
    }

    // Prefill form fields from query params (from suggestion cards)
    if (title || description || tags || locationHint || timeHint) {
      setFormData(prev => ({
        ...prev,
        ...(title && { title }),
        ...(description && { description }),
        ...(tags && { tags }),
        ...(locationHint && { location: locationHint }),
      }))
    }
  }, [searchParams, user])

  const loadPrefillGroup = async (groupId: string) => {
    try {
      setLoadingGroup(true)
      const group = await FellowshipService.getGroup(groupId)
      if (group) {
        setPrefillGroup(group)
        // Prefill group_id in form
        setFormData(prev => ({
          ...prev,
          group_id: groupId
        }))
      }
    } catch (error) {
      console.error('Error loading group for prefill:', error)
      // Don't show error to user, just silently fail
    } finally {
      setLoadingGroup(false)
    }
  }

  // Load user groups if user is a steward (optional feature)
  useEffect(() => {
    if (user && isSteward) {
      loadUserGroups()
    }
  }, [user, isSteward])

  const loadUserGroups = async () => {
    try {
      const groups = await FellowshipService.getGroups(user?.id)
      setUserGroups(groups)
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const eventData = {
        title: formData.title,
        description: formData.description,
        event_type: formData.event_type,
        location: formData.location || undefined,
        is_virtual: formData.is_virtual,
        virtual_link: formData.is_virtual ? formData.virtual_link : undefined,
        virtual_platform: formData.is_virtual ? formData.virtual_platform : undefined,
        start_time: formData.start_time,
        end_time: formData.end_time,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : undefined,
        is_recurring: false,
        group_id: formData.group_id || undefined,
        requires_rsvp: formData.requires_rsvp,
        allow_guests: formData.allow_guests,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        created_by: user.id,
        is_active: true,
      }

      const event = await EventService.createEvent(eventData)
      toast({ title: 'Event created!', variant: 'success', duration: 3000 })
      router.push(`/events/${event.id}`)
    } catch (err: any) {
      // Show specific error message from backend (e.g., "Only Stewards can create events")
      const errorMessage = err.message || 'Failed to create event'
      setError(errorMessage)
      
      // If it's an authorization error, redirect to dashboard
      if (errorMessage.includes('Only Stewards') || errorMessage.includes('403')) {
        toast({
          title: 'Access Restricted',
          description: errorMessage,
          variant: 'error',
          duration: 4000,
        })
        setTimeout(() => router.replace('/dashboard'), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'bible_study':
        return <BookOpen className="w-4 h-4" />
      case 'prayer_meeting':
        return <Sparkles className="w-4 h-4" />
      case 'worship':
        return <Heart className="w-4 h-4" />
      case 'evangelism':
        return <Megaphone className="w-4 h-4" />
      case 'community_service':
        return <HeartHandshake className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  // Show loading while checking auth and role
  if (profileLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render form if user is not a Steward
  if (!isSteward) {
    return null
  }

  return (
    <>
      <BackButton label="Create Event" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Group Prefill Banner */}
        {prefillGroup && (
          <div className="mb-6 bg-gradient-to-br from-navy-800/40 to-indigo-800/40 border border-gold-500/30 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center border border-gold-500/30">
                <Users className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Hosting for:</p>
                <p className="font-semibold text-gold-500">{prefillGroup.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPrefillGroup(null)
                setFormData(prev => ({ ...prev, group_id: '' }))
                // Remove query param from URL
                router.replace('/events/create')
              }}
              className="text-sm text-gray-400 hover:text-gold-500 transition-colors"
            >
              Remove
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Basic Information</h2>
            
            <div className="space-y-6">
              {/* Event Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Event Title *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g., Weekly Bible Study - Book of Romans"
                  value={formData.title}
                  onChange={handleChange}
                />
              </div>

              {/* Event Type */}
              <div>
                <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Event Type *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { value: 'bible_study', label: 'Bible Study', icon: <BookOpen className="w-4 h-4" /> },
                    { value: 'prayer_meeting', label: 'Prayer Meeting', icon: <Sparkles className="w-4 h-4" /> },
                    { value: 'worship', label: 'Worship', icon: <Heart className="w-4 h-4" /> },
                    { value: 'fellowship', label: 'Fellowship', icon: <Users className="w-4 h-4" /> },
                    { value: 'evangelism', label: 'Evangelism', icon: <Megaphone className="w-4 h-4" /> },
                    { value: 'community_service', label: 'Community Service', icon: <HeartHandshake className="w-4 h-4" /> },
                    { value: 'other', label: 'Other', icon: <Calendar className="w-4 h-4" /> },
                  ].map((type) => (
                    <label key={type.value} className="relative">
                      <input
                        type="radio"
                        name="event_type"
                        value={type.value}
                        checked={formData.event_type === type.value}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.event_type === type.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {type.icon}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {type.label}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  required
                  className="input-field"
                  placeholder="Describe your event, what participants can expect, and any special instructions..."
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              {/* Fellowship Group */}
              {userGroups.length > 0 && (
                <div>
                  <label htmlFor="group_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fellowship Group (Optional)
                  </label>
                  <select
                    id="group_id"
                    name="group_id"
                    className="input-field"
                    value={formData.group_id}
                    onChange={handleChange}
                  >
                    <option value="">No group association</option>
                    {userGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Date & Time</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Time */}
              <div>
                <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date & Time *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="start_time"
                    name="start_time"
                    type="datetime-local"
                    required
                    className="input-field pl-10"
                    value={formData.start_time}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* End Time */}
              <div>
                <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date & Time *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="end_time"
                    name="end_time"
                    type="datetime-local"
                    required
                    className="input-field pl-10"
                    value={formData.end_time}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Location & Virtual Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Location & Format</h2>
            
            <div className="space-y-6">
              {/* Event Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Event Format
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="is_virtual"
                      value="false"
                      checked={!formData.is_virtual}
                      onChange={handleChange}
                      className="mr-3"
                    />
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">In-Person Event</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Physical location required
                        </div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="is_virtual"
                      value="true"
                      checked={formData.is_virtual}
                      onChange={handleChange}
                      className="mr-3"
                    />
                    <div className="flex items-center space-x-2">
                      <Monitor className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Virtual Event</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Online meeting link required
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Location */}
              {!formData.is_virtual && (
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="location"
                      name="location"
                      type="text"
                      required={!formData.is_virtual}
                      className="input-field pl-10"
                      placeholder="e.g., First Baptist Church, Room 201"
                      value={formData.location}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}

              {/* Virtual Settings */}
              {formData.is_virtual && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="virtual_platform" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Virtual Platform
                    </label>
                    <select
                      id="virtual_platform"
                      name="virtual_platform"
                      className="input-field"
                      value={formData.virtual_platform}
                      onChange={handleChange}
                    >
                      <option value="zoom">Zoom</option>
                      <option value="teams">Microsoft Teams</option>
                      <option value="google_meet">Google Meet</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="virtual_link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Meeting Link *
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        id="virtual_link"
                        name="virtual_link"
                        type="url"
                        required={formData.is_virtual}
                        className="input-field pl-10"
                        placeholder="https://zoom.us/j/..."
                        value={formData.virtual_link}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RSVP & Attendance */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">RSVP & Attendance</h2>
            
            <div className="space-y-6">
              {/* Max Attendees */}
              <div>
                <label htmlFor="max_attendees" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Attendees (Optional)
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="max_attendees"
                    name="max_attendees"
                    type="number"
                    min="1"
                    className="input-field pl-10"
                    placeholder="Leave empty for unlimited"
                    value={formData.max_attendees}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* RSVP Settings */}
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="requires_rsvp"
                    checked={formData.requires_rsvp}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Require RSVP</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Participants must RSVP to attend
                    </div>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="allow_guests"
                    checked={formData.allow_guests}
                    onChange={handleChange}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Allow Guests</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Participants can bring guests
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Tags</h2>
            
            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags (Optional)
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  className="input-field pl-10"
                  placeholder="e.g., young adults, prayer, scripture study, community service"
                  value={formData.tags}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Separate tags with commas. Tags help others find your event.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Event...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}








