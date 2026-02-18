'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import { dailyWalk } from '@/lib/dailyWalk'
import { FellowshipGroup } from '@/types'
import { supabase } from '@/lib/supabase'
import { 
  BookOpen, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Star, 
  Plus,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageCircle,
  Users,
  ArrowRight
} from 'lucide-react'

interface Reading {
  id: string
  title: string
  verse: string
  content: string
  fullContent: string
  date: string
  isCompleted: boolean
  plan?: string
  reflectionPrompts?: string[]
}

// localStorage keys
const STORAGE_KEYS = {
  STREAK: 'devotions_streak',
  LAST_COMPLETED: 'devotions_last_completed',
  TOTAL_READINGS: 'devotions_total_readings',
  REFLECTIONS: 'devotions_reflections',
  SAVED_VERSES: 'devotions_saved_verses'
}

// Mock data
const mockReadings: Reading[] = [
  {
    id: '1',
    title: 'The Lord is My Shepherd',
    verse: 'Psalm 23:1–6',
    content: 'The LORD is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters...',
    fullContent: `The LORD is my shepherd; I shall not want.
He makes me lie down in green pastures.
He leads me beside still waters.
He restores my soul.
He leads me in paths of righteousness
    for his name's sake.

Even though I walk through the valley of the shadow of death,
    I will fear no evil,
for you are with me;
    your rod and your staff,
    they comfort me.

You prepare a table before me
    in the presence of my enemies;
you anoint my head with oil;
    my cup overflows.
Surely goodness and mercy shall follow me
    all the days of my life,
and I shall dwell in the house of the LORD
    forever.`,
    date: new Date().toISOString().split('T')[0],
    isCompleted: false,
    reflectionPrompts: [
      'How does this passage remind you of God\'s care in your life?',
      'What does it mean for you to "dwell in the house of the LORD forever"?'
    ]
  }
]

const VERSE_OF_THE_DAY = {
  verse: 'John 3:16',
  text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.'
}

export default function DevotionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isSteward } = useUserProfile()
  const toast = useToast()
  
  const todayIndex = new Date().getDate() % dailyWalk.length
  const todayWalk = dailyWalk[todayIndex]

  const [todayReading, setTodayReading] = useState<Reading>(mockReadings[0])
  const [userGroups, setUserGroups] = useState<FellowshipGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  
  // State for stats (loaded from localStorage)
  const [streak, setStreak] = useState(0)
  const [totalReadings, setTotalReadings] = useState(0)
  const [lastCompletedDate, setLastCompletedDate] = useState<string | null>(null)
  
  // State for expandable sections
  const [isPassageExpanded, setIsPassageExpanded] = useState(false)
  const [reflection, setReflection] = useState('')
  
  // State for share modal
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [sharing, setSharing] = useState(false)
  
  // Load stats from localStorage on mount
  useEffect(() => {
    const savedStreak = localStorage.getItem(STORAGE_KEYS.STREAK)
    const savedTotal = localStorage.getItem(STORAGE_KEYS.TOTAL_READINGS)
    const savedLastCompleted = localStorage.getItem(STORAGE_KEYS.LAST_COMPLETED)
    
    if (savedStreak) setStreak(parseInt(savedStreak, 10))
    if (savedTotal) setTotalReadings(parseInt(savedTotal, 10))
    if (savedLastCompleted) setLastCompletedDate(savedLastCompleted)
    
    // Load saved reflection and prayer for today
    const today = new Date().toISOString().split('T')[0]
    const savedReflections = JSON.parse(localStorage.getItem(STORAGE_KEYS.REFLECTIONS) || '{}')
    
    if (savedReflections[today]) setReflection(savedReflections[today])
    
    // Check if today's reading is already completed
    if (savedLastCompleted === today) {
      setTodayReading(prev => ({ ...prev, isCompleted: true }))
    }
  }, [])
  
  // Load user groups for community section
  useEffect(() => {
    if (user?.id) {
      loadUserGroups()
    }
  }, [user?.id])
  
  const loadUserGroups = async () => {
    if (!user?.id) return
    try {
      setLoadingGroups(true)
      const groups = await FellowshipService.getUserJoinedGroups(user.id)
      setUserGroups(groups)
    } catch (error) {
      console.error('Error loading user groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }
  
  const handleMarkComplete = () => {
    const today = new Date().toISOString().split('T')[0]
    
    // Prevent double-completing on same day
    if (lastCompletedDate === today || todayReading.isCompleted) {
      toast({
        title: 'Already completed',
        description: 'You\'ve already completed today\'s reading.',
        variant: 'info',
        duration: 3000,
      })
      return
    }
    
    // Update completion status
    setTodayReading(prev => ({ ...prev, isCompleted: true }))
    setLastCompletedDate(today)
    localStorage.setItem(STORAGE_KEYS.LAST_COMPLETED, today)
    
    // Update streak
    let newStreak = streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    
    if (lastCompletedDate === yesterday) {
      // Continue streak
      newStreak = streak + 1
    } else if (lastCompletedDate !== today) {
      // New streak (gap was more than 1 day)
      newStreak = 1
    }
    
    setStreak(newStreak)
    localStorage.setItem(STORAGE_KEYS.STREAK, newStreak.toString())
    
    // Update total readings
    const newTotal = totalReadings + 1
    setTotalReadings(newTotal)
    localStorage.setItem(STORAGE_KEYS.TOTAL_READINGS, newTotal.toString())
    
    toast({
      title: 'Reading completed!',
      description: `Your streak is now ${newStreak} days. Keep it up!`,
      variant: 'success',
      duration: 3000,
    })
  }
  
  const handleCopyVerse = async () => {
    const text = `${VERSE_OF_THE_DAY.verse} - ${VERSE_OF_THE_DAY.text}`
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Verse copied!',
        description: 'The verse has been copied to your clipboard.',
        variant: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again.',
        variant: 'error',
        duration: 2000,
      })
    }
  }
  
  const handleSaveVerse = () => {
    const savedVerses = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_VERSES) || '[]')
    const today = new Date().toISOString().split('T')[0]
    const verseEntry = {
      verse: VERSE_OF_THE_DAY.verse,
      text: VERSE_OF_THE_DAY.text,
      date: today
    }
    
    // Check if already saved today
    if (!savedVerses.some((v: any) => v.date === today && v.verse === VERSE_OF_THE_DAY.verse)) {
      savedVerses.push(verseEntry)
      localStorage.setItem(STORAGE_KEYS.SAVED_VERSES, JSON.stringify(savedVerses))
      
      toast({
        title: 'Verse saved!',
        description: 'You can find saved verses in your profile.',
        variant: 'success',
        duration: 2000,
      })
    } else {
      toast({
        title: 'Already saved',
        description: 'This verse is already in your saved verses.',
        variant: 'info',
        duration: 2000,
      })
    }
  }
  
  const handleShareToGroup = () => {
    if (userGroups.length === 0) {
      router.push('/fellowship')
      return
    }
    
    // Open share modal
    if (userGroups.length > 0) {
      setSelectedGroupId(userGroups[0].id)
    }
    setShowShareModal(true)
  }
  
  const handlePostToGroup = async () => {
    if (!selectedGroupId || sharing) return
    
    setSharing(true)
    try {
      // Build formatted message
      let message = `📖 Today's Reading: ${todayReading.verse}\n`
      
      if (reflection.trim()) {
        message += `Reflection: ${reflection.trim()}\n`
      }
      
      message += `Let's discuss this together on Gathered 🙌`
      
      // Get session to include access token
      const { data: { session } } = await supabase.auth.getSession()
      
      // Post to group chat
      const response = await fetch(`/api/chat/group/${selectedGroupId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          content: message,
          type: 'devotion_share',
          metadata: {
            passageRef: todayReading.verse,
            reflection: reflection.trim() || undefined,
          },
        }),
      })
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You must be a member of this group to share')
        }
        throw new Error('Failed to post message')
      }
      
      toast({
        title: 'Shared!',
        description: 'Your devotion has been posted to the group chat.',
        variant: 'success',
        duration: 3000,
      })
      
      setShowShareModal(false)
      
      // Optional: navigate to chat after a short delay
      setTimeout(() => {
        router.push(`/chat/${selectedGroupId}`)
      }, 1500)
    } catch (error: any) {
      console.error('Error sharing to group:', error)
      toast({
        title: 'Failed to share',
        description: error.message || 'Please try again.',
        variant: 'error',
        duration: 3000,
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-50 mb-2">Devotions</h1>
              <p className="text-slate-400">Daily Bible readings</p>
            </div>
            {isSteward && (
              <button
                onClick={() => router.push('/devotions/create')}
                className="bg-gold-500 hover:bg-gold-600 text-navy-900 p-2 rounded-lg transition-colors"
                title="Create Devotional"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Stats Chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-navy-800/40 border border-gold-600/20 rounded-full px-4 py-2 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-medium text-gold-500">
                {streak}-day streak
              </span>
            </div>
            <div className="bg-navy-800/40 border border-gold-600/20 rounded-full px-4 py-2 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-medium text-gold-500">
                {totalReadings} total readings
              </span>
            </div>
          </div>
        </div>

        {/* Today's Reading */}
        <div className="mb-8 bg-navy-800/30 border border-white/10 rounded-xl p-6 hover:border-gold-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gold-500/15 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Today&apos;s Word for You</h2>
                <p className="text-sm text-slate-400">{todayReading.verse}</p>
              </div>
            </div>
            {todayReading.isCompleted ? (
              <div className="bg-gold-500/15 text-gold-500 border border-gold-600/30 px-3 py-1 rounded-full text-xs font-semibold">
                Completed ✓
              </div>
            ) : (
              <div className="bg-navy-700/50 text-slate-300 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Pending</span>
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-bold text-slate-50 mb-3">{todayReading.title}</h3>
          <p className="text-slate-300 leading-relaxed mb-4 line-clamp-3">
            {todayReading.content}
          </p>
          
          <div className="flex items-center space-x-3 mb-4">
            <button
              onClick={() => setIsPassageExpanded(!isPassageExpanded)}
              className="flex items-center space-x-2 bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <span>Read full passage</span>
              {isPassageExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {!todayReading.isCompleted && (
              <button
                onClick={handleMarkComplete}
                className="border border-gold-600/40 text-gold-500 hover:bg-gold-500/10 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Mark complete
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div className="bg-navy-900/50 rounded-lg p-4 border border-gold-500/20">
              <h4 className="text-sm font-semibold text-gold-200 mb-2">💭 Reflection</h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                {todayWalk?.reflection?.trim() ||
                  'Pause and consider what this passage reveals about God and how it applies to your life today.'}
              </p>
            </div>

            <div className="bg-navy-900/50 rounded-lg p-4 border border-gold-500/20">
              <h4 className="text-sm font-semibold text-gold-200 mb-2">🙏 Prayer</h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                {todayWalk?.prayer?.trim() ||
                  'Ask God to speak clearly and to strengthen you to live out His Word today.'}
              </p>
            </div>

            <div className="bg-navy-900/50 rounded-lg p-4 border border-gold-500/20 space-y-3">
              <label htmlFor="daily-walk-reflection" className="text-sm font-semibold text-gold-200">
                ✍️ Your reflection
              </label>
              <textarea
                id="daily-walk-reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What is God showing you through this today?"
                className="w-full px-4 py-3 border border-white/10 rounded-lg bg-navy-900/60 text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-gold-500 focus:border-gold-500 resize-none"
                rows={4}
              />
              <button
                onClick={handleShareToGroup}
                className="w-full bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-3 rounded-lg font-medium transition-colors"
              >
                Share reflection to group
              </button>
            </div>
          </div>
          
          {/* Expanded Passage Section */}
          {isPassageExpanded && (
            <div className="mt-6 pt-6 border-t border-white/10 space-y-6">
              {/* Full Passage */}
              <div className="bg-navy-900/50 rounded-lg p-4 border border-white/5">
                <p className="text-slate-200 leading-relaxed whitespace-pre-line">
                  {todayReading.fullContent}
                </p>
              </div>
              
              {/* Reflection Prompts */}
              {todayReading.reflectionPrompts && todayReading.reflectionPrompts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Reflection Questions</span>
                  </h4>
                  <ul className="space-y-2 mb-4">
                    {todayReading.reflectionPrompts.map((prompt, idx) => (
                      <li key={idx} className="text-slate-300 text-sm pl-6 relative">
                        <span className="absolute left-0 text-gold-500">•</span>
                        {prompt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
            </div>
          )}
        </div>
        
        {/* Share Modal */}
        {showShareModal && userGroups.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-navy-800 border border-white/10 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Share to Group</h3>
              
              {/* Group Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg bg-navy-900/60 text-slate-50 focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                >
                  {userGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.location ? `- ${group.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Message Preview */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message Preview
                </label>
                <div className="bg-navy-900/50 rounded-lg p-4 border border-white/5">
                  <p className="text-slate-200 text-sm whitespace-pre-wrap">
                    📖 Today&apos;s Reading: {todayReading.verse}
                    {reflection.trim() && `\nReflection: ${reflection.trim()}`}
                    {'\n'}Let&apos;s discuss this together on Gathered 🙌
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 border border-white/10 text-slate-300 hover:bg-navy-700/50 px-4 py-2 rounded-lg font-medium transition-colors"
                  disabled={sharing}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePostToGroup}
                  disabled={sharing || !selectedGroupId}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-navy-900 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {sharing ? 'Posting...' : 'Post to group'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verse of the Day */}
        <div className="mb-8 bg-gradient-to-br from-navy-800/40 to-indigo-800/40 border border-gold-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-50 mb-1">Verse of the Day</h3>
              <p className="text-sm text-gold-500">{VERSE_OF_THE_DAY.verse}</p>
            </div>
            <Star className="w-6 h-6 text-gold-500" />
          </div>
          <p className="text-slate-200 leading-relaxed mb-4 italic">
            &quot;{VERSE_OF_THE_DAY.text}&quot;
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopyVerse}
              className="flex items-center space-x-2 border border-gold-600/40 text-gold-500 hover:bg-gold-500/10 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy verse</span>
            </button>
            <button
              onClick={handleSaveVerse}
              className="flex items-center space-x-2 border border-gold-600/40 text-gold-500 hover:bg-gold-500/10 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Star className="w-4 h-4" />
              <span>Save verse</span>
            </button>
          </div>
        </div>

        {/* Community Tie-in */}
        {loadingGroups ? (
          <div className="bg-navy-800/30 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-slate-400">Loading groups...</p>
          </div>
        ) : userGroups.length > 0 ? (
          <div className="bg-navy-800/30 border border-white/10 rounded-xl p-6 hover:border-gold-500/30 transition-colors">
            <div className="flex items-center space-x-3 mb-3">
              <Users className="w-5 h-5 text-gold-500" />
              <h3 className="text-lg font-semibold text-slate-50">
                Discuss today&apos;s reading in {userGroups[0].name}
              </h3>
            </div>
            <p className="text-slate-300 text-sm mb-4">
              Share your reflections and insights with your group.
            </p>
            <button
              onClick={() => router.push(`/fellowship/${userGroups[0].id}`)}
              className="flex items-center space-x-2 bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <span>Open group</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-navy-800/30 border border-white/10 rounded-xl p-6 hover:border-gold-500/30 transition-colors">
            <div className="flex items-center space-x-3 mb-3">
              <Users className="w-5 h-5 text-gold-500" />
              <h3 className="text-lg font-semibold text-slate-50">
                Join a group to discuss
              </h3>
            </div>
            <p className="text-slate-300 text-sm mb-4">
              Connect with others and share your devotional journey.
            </p>
            <button
              onClick={() => router.push('/fellowship')}
              className="flex items-center space-x-2 border border-gold-600/40 text-gold-500 hover:bg-gold-500/10 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <span>Explore groups</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
