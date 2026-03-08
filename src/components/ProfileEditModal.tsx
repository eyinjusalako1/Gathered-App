'use client'

import React, { useState, useRef, useEffect } from 'react'
import { 
  Camera, 
  MapPin, 
  BookOpen, 
  User, 
  Save,
  X,
  Clock,
} from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { useToast } from '@/components/ui/Toast'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (profileData: any) => void
  currentProfile: any
}

export default function ProfileEditModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentProfile 
}: ProfileEditModalProps) {
  const toast = useToast()
  const [formData, setFormData] = useState({
    name: currentProfile?.name || '',
    bio: currentProfile?.bio || '',
    location: currentProfile?.location || '',
    denomination: currentProfile?.denomination || '',
    growthFocus: currentProfile?.growthFocus || '',
    interests: currentProfile?.interests || [],
    availability: currentProfile?.availability || [],
    avatarUrl: currentProfile?.avatarUrl || '',
    coverImageUrl: currentProfile?.coverImageUrl || ''
  })

  const [newInterest, setNewInterest] = useState('')
  const [newAvailability, setNewAvailability] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isOpen && currentProfile) {
      setFormData({
        name: currentProfile?.name || '',
        bio: currentProfile?.bio || '',
        location: currentProfile?.location || '',
        denomination: currentProfile?.denomination || '',
        growthFocus: currentProfile?.growthFocus || '',
        interests: currentProfile?.interests || [],
        availability: currentProfile?.availability || [],
        avatarUrl: currentProfile?.avatarUrl || '',
        coverImageUrl: currentProfile?.coverImageUrl || ''
      })
      setNewInterest('')
      setNewAvailability('')
    }
  }, [currentProfile, isOpen])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddInterest = () => {
    if (newInterest.trim() && !formData.interests.includes(newInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }))
      setNewInterest('')
    }
  }

  const handleRemoveInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter((i: string) => i !== interest)
    }))
  }

  const handleAddAvailability = () => {
    if (newAvailability.trim() && !formData.availability.includes(newAvailability.trim())) {
      setFormData(prev => ({
        ...prev,
        availability: [...prev.availability, newAvailability.trim()]
      }))
      setNewAvailability('')
    }
  }

  const handleRemoveAvailability = (availability: string) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.filter((a: string) => a !== availability)
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Call the onSave callback which will handle the actual save
      await onSave(formData)
      
      // Close the sheet (onSave will show success/error toast)
      onClose()
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: 'Failed to update profile',
        variant: 'error',
        duration: 2000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInterestKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddInterest()
    }
  }

  const handleAvailabilityKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddAvailability()
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      footer={
        <div className="flex space-x-3 px-4 pb-4 pt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/20 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 bg-[#F5C451] text-[#0F1433] py-3 rounded-xl font-semibold hover:bg-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0F1433]"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Profile Picture */}
        <div className="text-center">
          <div className="relative inline-block">
            {formData.avatarUrl ? (
              <img
                src={formData.avatarUrl}
                alt={formData.name || 'Profile'}
                className="w-20 h-20 rounded-full object-cover border-4 border-[#0F1433] mx-auto mb-3"
              />
            ) : (
              <div className="w-20 h-20 bg-[#F5C451] rounded-full flex items-center justify-center border-4 border-[#0F1433] mx-auto mb-3">
                <span className="text-xl font-bold text-[#0F1433]">
                  {formData.name.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-1 bg-[#0F1433] border-2 border-[#F5C451] rounded-full text-[#F5C451] hover:bg-[#0F1433]/90 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              
              // Use setTimeout to avoid React error #423 (updating component during render)
              const reader = new FileReader()
              reader.onload = () => {
                setTimeout(() => {
                  setFormData(prev => ({
                    ...prev,
                    avatarUrl: typeof reader.result === 'string' ? reader.result : prev.avatarUrl
                  }))
                }, 0)
              }
              reader.onerror = () => {
                console.error('Error reading avatar file')
              }
              reader.readAsDataURL(file)
            }}
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="text-[#F5C451] text-sm font-medium hover:text-[#D4AF37] transition-colors min-h-[44px]"
          >
            Change Photo
          </button>
        </div>

        {/* Cover Photo */}
        <div className="text-center">
          <div className="relative">
            {formData.coverImageUrl ? (
              <img
                src={formData.coverImageUrl}
                alt="Cover"
                className="w-full h-24 object-cover rounded-xl border border-[#D4AF37]/40 mb-2"
              />
            ) : (
              <div className="w-full h-24 bg-gradient-to-r from-[#D4AF37] to-[#F5C451] rounded-xl mb-2"></div>
            )}
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute top-2 right-2 p-2 bg-[#0F1433]/70 rounded-full text-[#F5C451] hover:bg-[#0F1433]/90 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              
              // Use setTimeout to avoid React error #423 (updating component during render)
              const reader = new FileReader()
              reader.onload = () => {
                setTimeout(() => {
                  setFormData(prev => ({
                    ...prev,
                    coverImageUrl: typeof reader.result === 'string' ? reader.result : prev.coverImageUrl
                  }))
                }, 0)
              }
              reader.onerror = () => {
                console.error('Error reading cover photo file')
              }
              reader.readAsDataURL(file)
            }}
          />
          <button
            onClick={() => coverInputRef.current?.click()}
            className="text-[#F5C451] text-sm font-medium hover:text-[#D4AF37] transition-colors min-h-[44px]"
          >
            Change Cover Photo
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Full Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] min-h-[44px]"
            placeholder="Enter your full name"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            rows={3}
            className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <MapPin className="w-4 h-4 inline mr-2" />
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] min-h-[44px]"
            placeholder="City, State"
          />
        </div>

        {/* Denomination */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <BookOpen className="w-4 h-4 inline mr-2" />
            Denomination
          </label>
          <select
            value={formData.denomination}
            onChange={(e) => handleInputChange('denomination', e.target.value)}
            className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] min-h-[44px] [&>option]:bg-[#0F1433] [&>option]:text-white"
            style={{ color: formData.denomination ? '#ffffff' : 'rgba(255, 255, 255, 0.6)' }}
          >
            <option value="" className="bg-[#0F1433] text-white/60">Select denomination</option>
            <option value="Non-denominational" className="bg-[#0F1433] text-white">Non-denominational</option>
            <option value="Baptist" className="bg-[#0F1433] text-white">Baptist</option>
            <option value="Methodist" className="bg-[#0F1433] text-white">Methodist</option>
            <option value="Presbyterian" className="bg-[#0F1433] text-white">Presbyterian</option>
            <option value="Lutheran" className="bg-[#0F1433] text-white">Lutheran</option>
            <option value="Catholic" className="bg-[#0F1433] text-white">Catholic</option>
            <option value="Episcopal" className="bg-[#0F1433] text-white">Episcopal</option>
            <option value="Pentecostal" className="bg-[#0F1433] text-white">Pentecostal</option>
            <option value="Other" className="bg-[#0F1433] text-white">Other</option>
          </select>
        </div>

        {/* Growth Focus */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <BookOpen className="w-4 h-4 inline mr-2" />
            Growth Focus
          </label>
          <select
            value={formData.growthFocus}
            onChange={(e) => handleInputChange('growthFocus', e.target.value)}
            className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] min-h-[44px] [&>option]:bg-[#0F1433] [&>option]:text-white"
            style={{ color: formData.growthFocus ? '#ffffff' : 'rgba(255, 255, 255, 0.6)' }}
          >
            <option value="" className="bg-[#0F1433] text-white/60">Select focus</option>
            <option value="peace" className="bg-[#0F1433] text-white">Peace</option>
            <option value="discipline" className="bg-[#0F1433] text-white">Discipline</option>
            <option value="identity" className="bg-[#0F1433] text-white">Identity</option>
            <option value="purpose" className="bg-[#0F1433] text-white">Purpose</option>
            <option value="relationships" className="bg-[#0F1433] text-white">Relationships</option>
            <option value="bible" className="bg-[#0F1433] text-white">Understanding the Bible</option>
          </select>
        </div>

        {/* Interests */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Interests
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyPress={handleInterestKeyPress}
              className="flex-1 bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] min-h-[44px]"
              placeholder="Add an interest"
            />
            <button
              onClick={handleAddInterest}
              className="bg-[#F5C451] text-[#0F1433] px-4 py-2 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors min-h-[44px]"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.interests.map((interest: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-white/10 text-white/80 text-sm rounded-full border border-[#D4AF37]/30 flex items-center gap-2"
              >
                <span>{interest}</span>
                <button
                  onClick={() => handleRemoveInterest(interest)}
                  className="text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={`Remove ${interest}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            <Clock className="w-4 h-4 inline mr-2" />
            Availability
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newAvailability}
              onChange={(e) => setNewAvailability(e.target.value)}
              onKeyPress={handleAvailabilityKeyPress}
              className="flex-1 bg-white/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] min-h-[44px]"
              placeholder="e.g., Weekends, Weekday evenings"
            />
            <button
              onClick={handleAddAvailability}
              className="bg-[#F5C451] text-[#0F1433] px-4 py-2 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors min-h-[44px]"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.availability.map((availability: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-white/10 text-white/80 text-sm rounded-full border border-[#D4AF37]/30 flex items-center gap-2"
              >
                <span>{availability}</span>
                <button
                  onClick={() => handleRemoveAvailability(availability)}
                  className="text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={`Remove ${availability}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
