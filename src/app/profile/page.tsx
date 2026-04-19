'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings, Bell, User, Mail, MapPin, Church, Calendar, Camera, Heart, Clock, Edit } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import ProfileEditModal from '@/components/ProfileEditModal'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { profile, uploadAvatar, uploadCoverPhoto, updateProfile } = useUserProfile()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'events':
        router.push('/events')
        break
      case 'chat':
        router.push('/chat')
        break
      case 'fellowships':
        router.push('/fellowship')
        break
      case 'devotions':
        router.push('/devotions')
        break
      case 'home':
        router.push('/dashboard')
        break
      default:
        break
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'error',
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
        variant: 'error',
      })
      return
    }

    setUploading(true)
    try {
      await uploadAvatar(file)
      toast({
        title: 'Profile picture updated',
        description: 'Your profile picture has been updated successfully',
        variant: 'success',
      })
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload profile picture',
        variant: 'error',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      }
    }

  const handleEditProfile = () => {
    setIsEditModalOpen(true)
  }

  const handleSaveProfile = async (profileData: any) => {
    try {
      // If avatar is a data URL (base64), we need to upload it first
      let avatarUrl = profileData.avatarUrl
      if (avatarUrl && avatarUrl.startsWith('data:image')) {
        // Convert data URL to blob and upload
        try {
          const response = await fetch(avatarUrl)
          const blob = await response.blob()
          const file = new File([blob], 'avatar.jpg', { type: blob.type })
          avatarUrl = await uploadAvatar(file)
        } catch (uploadError: any) {
          console.error('Error uploading avatar:', uploadError)
          // Continue without avatar if upload fails
          avatarUrl = profile?.avatar_url || null
        }
      }

      // If cover photo is a data URL (base64), we need to upload it first
      let coverImageUrl = profileData.coverImageUrl
      if (coverImageUrl && coverImageUrl.startsWith('data:image')) {
        // Convert data URL to blob and upload
        try {
          const response = await fetch(coverImageUrl)
          const blob = await response.blob()
          const file = new File([blob], 'cover.jpg', { type: blob.type })
          coverImageUrl = await uploadCoverPhoto(file)
        } catch (uploadError: any) {
          console.error('Error uploading cover photo:', uploadError)
          // Continue without cover photo if upload fails
          coverImageUrl = profile?.cover_image_url || null
        }
      }

      // Update profile fields
      await updateProfile({
        name: profileData.name || null,
        bio: profileData.bio || null,
        city: profileData.location || null,
        interests: profileData.interests && profileData.interests.length > 0 ? profileData.interests : null,
        availability: profileData.availability && profileData.availability.length > 0 ? profileData.availability : null,
        growth_focus: profileData.growthFocus || null,
        avatar_url: avatarUrl || null,
        cover_image_url: coverImageUrl || null,
      })

      // Update user metadata (denomination, name) in auth.users
      if (user && (profileData.denomination !== undefined || profileData.name !== undefined)) {
        const { supabase } = await import('@/lib/supabase')
        const metadata: any = { ...user.user_metadata }
        
        if (profileData.denomination !== undefined) {
          metadata.church_affiliation = profileData.denomination || null
        }
        if (profileData.name !== undefined) {
          metadata.name = profileData.name || null
        }

        const { error: metadataError } = await supabase.auth.updateUser({
          data: metadata
        })

        if (metadataError) {
          console.error('Error updating user metadata:', metadataError)
          // Don't fail the whole update if metadata update fails
        }
      }
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
        variant: 'success',
      })
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update profile',
        variant: 'error',
      })
    }
  }

  // Prepare profile data for the edit modal
  const profileDataForModal = {
    name: user?.user_metadata?.name || profile?.name || '',
    bio: profile?.bio || '',
    location: profile?.city || user?.user_metadata?.location || '',
    denomination: user?.user_metadata?.church_affiliation || '',
    growthFocus: profile?.growth_focus || '',
    interests: profile?.interests || [],
    availability: profile?.availability || [],
    avatarUrl: profile?.avatar_url || '',
    coverImageUrl: profile?.cover_image_url || '',
  }

  return (
    <div className="min-h-screen bg-beige-50 dark:bg-navy-900 pb-20" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="bg-white dark:bg-navy-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky z-40" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Link href="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <h1 className="text-xl font-bold text-navy-900 dark:text-white">
                Profile
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleEditProfile}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Edit Profile"
              >
                <Edit className="w-5 h-5" />
              </button>
              <Link 
                href="/settings/notifications?from=profile" 
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 relative"
              >
                <Bell className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold-500 rounded-full"></div>
              </Link>
              <Link 
                href="/settings" 
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Profile Header */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Profile"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gold-500"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-gold-500 to-gold-600 rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
              )}
              <button
                onClick={handleAvatarClick}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-7 h-7 bg-[#F5C451] rounded-full flex items-center justify-center border-2 border-white dark:border-navy-800 hover:bg-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Change profile picture"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0F1433]"></div>
                ) : (
                  <Camera className="w-4 h-4 text-[#0F1433]" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                {user?.user_metadata?.name || profile?.name || 'User'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>
          
          {/* Bio Section */}
          {profile?.bio && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link 
              href="/settings/notifications?from=profile"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-white">Notifications</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gold-500 rounded-full"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
              </div>
            </Link>
            <Link 
              href="/settings"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-white">Settings</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* Interests Section */}
        {profile?.interests && profile.interests.length > 0 && (
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-3 flex items-center space-x-2">
              <Heart className="w-5 h-5 text-gold-500" />
              <span>Interests</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-300 rounded-full text-sm font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Availability Section */}
        {profile?.availability && profile.availability.length > 0 && (
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-navy-900 dark:text-white mb-3 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gold-500" />
              <span>Availability</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.availability.map((time, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                >
                  {time}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Profile Information */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-navy-900 dark:text-white mb-4">
            Profile Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-gray-900 dark:text-white">{user?.email}</p>
              </div>
            </div>
            {(profile?.city || user?.user_metadata?.location) && (
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                  <p className="text-gray-900 dark:text-white">
                    {profile?.city || user?.user_metadata?.location}
                  </p>
                </div>
              </div>
            )}
            {user?.user_metadata?.church_affiliation && (
              <div className="flex items-center space-x-3">
                <Church className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Church</p>
                  <p className="text-gray-900 dark:text-white">{user.user_metadata.church_affiliation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveProfile}
        currentProfile={profileDataForModal}
      />
    </div>
  )
}

