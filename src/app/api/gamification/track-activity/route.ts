import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { gamificationService, GamificationService } from '@/lib/gamification-service'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // userId is always derived from the auth token — never from the request body
    const userId = authUser.userId

    const body = await request.json()
    const { fellowshipId, activityType } = body

    if (!fellowshipId || !activityType) {
      return NextResponse.json(
        { error: 'Missing required fields: fellowshipId, activityType' },
        { status: 400 }
      )
    }

    // If Supabase not configured, use mock data
    if (!isSupabaseConfigured()) {
      console.log('[Mock] Tracking activity:', { userId, fellowshipId, activityType })
      
      // Simulate tracking
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return NextResponse.json({
        success: true,
        message: 'Activity tracked (mock mode)',
        points: 1
      })
    }

    // Real implementation with Supabase
    const today = new Date().toISOString().split('T')[0]
    
    // Log activity
    const { data: activityData, error: activityError } = await supabase
      .from('faith_flames')
      .insert({
        user_id: userId,
        fellowship_id: fellowshipId,
        activity_date: today,
        activity_type: activityType,
        activity_count: 1,
        points_awarded: 1
      })

    if (activityError) {
      console.error('Error tracking activity:', activityError)
      return NextResponse.json(
        { error: 'Failed to track activity' },
        { status: 500 }
      )
    }

    // Update or create streak
    const { data: streakData } = await supabase
      .from('faith_streaks')
      .select('*')
      .eq('user_id', userId)
      .eq('fellowship_id', fellowshipId)
      .single()

    if (streakData) {
      const lastDate = new Date(streakData.last_activity_date)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      let newStreak = streakData.current_streak
      if (lastDate.toDateString() === yesterday.toDateString()) {
        newStreak += 1
      } else if (lastDate.toDateString() !== new Date().toDateString()) {
        newStreak = 1
      }

      const intensity = GamificationService.calculateFlameIntensity(newStreak)
      
      await supabase
        .from('faith_streaks')
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(streakData.longest_streak, newStreak),
          last_activity_date: today,
          flame_intensity: intensity
        })
        .eq('user_id', userId)
        .eq('fellowship_id', fellowshipId)
    } else {
      const intensity = GamificationService.calculateFlameIntensity(1)
      await supabase
        .from('faith_streaks')
        .insert({
          user_id: userId,
          fellowship_id: fellowshipId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
          flame_intensity: intensity
        })
    }

    // Check for badge awards
    const badgesEarned = await gamificationService.checkAndAwardBadges(userId, fellowshipId)

    return NextResponse.json({
      success: true,
      points: 1,
      badgesEarned: badgesEarned.length > 0 ? badgesEarned.map(b => b.code) : []
    })

  } catch (error) {
    console.error('Error in track-activity:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




