import { supabase } from './supabase'

export interface UserAnalytics {
  userId: string
  totalPosts: number
  totalComments: number
  totalLikes: number
  totalShares: number
  fellowshipGroupsJoined: number
  eventsAttended: number
  studySessionsCompleted: number
  memoryVersesMastered: number
  spiritualGrowthScore: number
  communityEngagementScore: number
  lastActiveDate: string
  accountAge: number
}

export interface CommunityAnalytics {
  totalUsers: number
  activeUsers: number
  totalPosts: number
  totalGroups: number
  totalEvents: number
  totalComments: number
  averageEngagementRate: number
  topPostTypes: { type: string; count: number }[]
  topGroups: { name: string; memberCount: number }[]
  growthMetrics: {
    newUsersThisWeek: number
    newUsersThisMonth: number
    postsThisWeek: number
    postsThisMonth: number
  }
}

export interface ContentAnalytics {
  postId: string
  views: number
  likes: number
  comments: number
  shares: number
  engagementRate: number
  reach: number
  impressions: number
  clickThroughRate: number
}

export interface SpiritualGrowthMetrics {
  userId: string
  prayerFrequency: number
  scriptureReadingFrequency: number
  fellowshipParticipation: number
  serviceParticipation: number
  overallGrowthScore: number
  growthTrend: 'increasing' | 'stable' | 'decreasing'
  milestones: string[]
  recommendations: string[]
}

export class AnalyticsService {
  // Get user analytics
  static async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const [
      posts,
      comments,
      likes,
      shares,
      groups,
      events,
      studySessions,
      memoryVerses,
      userProfile
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
      supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('author_id', userId),
      supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('post_shares').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('group_memberships').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'going'),
      supabase.from('study_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true),
      supabase.from('memory_verses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('user_profiles').select('created_at').eq('id', userId).single()
    ])

    const accountAge = userProfile.data ? 
      Math.floor((Date.now() - new Date(userProfile.data.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0

    const spiritualGrowthScore = this.calculateSpiritualGrowthScore({
      posts: posts.count || 0,
      comments: comments.count || 0,
      groups: groups.count || 0,
      events: events.count || 0,
      studySessions: studySessions.count || 0,
      memoryVerses: memoryVerses.count || 0
    })

    const communityEngagementScore = this.calculateCommunityEngagementScore({
      posts: posts.count || 0,
      comments: comments.count || 0,
      likes: likes.count || 0,
      shares: shares.count || 0,
      groups: groups.count || 0,
      events: events.count || 0
    })

    return {
      userId,
      totalPosts: posts.count || 0,
      totalComments: comments.count || 0,
      totalLikes: likes.count || 0,
      totalShares: shares.count || 0,
      fellowshipGroupsJoined: groups.count || 0,
      eventsAttended: events.count || 0,
      studySessionsCompleted: studySessions.count || 0,
      memoryVersesMastered: memoryVerses.count || 0,
      spiritualGrowthScore,
      communityEngagementScore,
      lastActiveDate: new Date().toISOString(),
      accountAge
    }
  }

  // Get community analytics
  static async getCommunityAnalytics(): Promise<CommunityAnalytics> {
    const [
      users,
      activeUsers,
      posts,
      groups,
      events,
      comments,
      weeklyUsers,
      monthlyUsers,
      weeklyPosts,
      monthlyPosts
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('fellowship_groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ])

    // Get post type distribution
    const { data: postTypes } = await supabase
      .from('posts')
      .select('post_type')
      .eq('is_active', true)

    const typeCounts = postTypes?.reduce((acc, post) => {
      acc[post.post_type] = (acc[post.post_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const topPostTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Get top groups
    const { data: groupData } = await supabase
      .from('fellowship_groups')
      .select('name, member_count')
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .limit(5)

    const topGroups = groupData?.map(group => ({
      name: group.name,
      memberCount: group.member_count
    })) || []

    const totalEngagement = (posts.count || 0) + (comments.count || 0) + (groups.count || 0) + (events.count || 0)
    const averageEngagementRate = totalEngagement / Math.max(users.count || 1, 1)

    return {
      totalUsers: users.count || 0,
      activeUsers: activeUsers.count || 0,
      totalPosts: posts.count || 0,
      totalGroups: groups.count || 0,
      totalEvents: events.count || 0,
      totalComments: comments.count || 0,
      averageEngagementRate,
      topPostTypes,
      topGroups,
      growthMetrics: {
        newUsersThisWeek: weeklyUsers.count || 0,
        newUsersThisMonth: monthlyUsers.count || 0,
        postsThisWeek: weeklyPosts.count || 0,
        postsThisMonth: monthlyPosts.count || 0
      }
    }
  }

  // Get content analytics for a specific post
  static async getContentAnalytics(postId: string): Promise<ContentAnalytics> {
    const [post, likes, comments, shares] = await Promise.all([
      supabase.from('posts').select('likes_count, comments_count, shares_count').eq('id', postId).single(),
      supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('post_shares').select('*', { count: 'exact', head: true }).eq('post_id', postId)
    ])

    const postData = post.data
    const totalEngagement = (likes.count || 0) + (comments.count || 0) + (shares.count || 0)
    const engagementRate = totalEngagement / Math.max(postData?.likes_count || 1, 1)

    return {
      postId,
      views: postData?.likes_count || 0, // Using likes as proxy for views
      likes: likes.count || 0,
      comments: comments.count || 0,
      shares: shares.count || 0,
      engagementRate,
      reach: Math.max(postData?.likes_count || 0, totalEngagement),
      impressions: postData?.likes_count || 0,
      clickThroughRate: engagementRate
    }
  }

  // Get spiritual growth metrics
  static async getSpiritualGrowthMetrics(userId: string): Promise<SpiritualGrowthMetrics> {
    const [
      prayerPosts,
      scripturePosts,
      fellowshipParticipation,
      serviceEvents,
      studySessions,
      memoryVerses
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId).eq('post_type', 'prayer_request'),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId).eq('post_type', 'scripture'),
      supabase.from('group_memberships').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('created_by', userId).eq('event_type', 'community_service'),
      supabase.from('study_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true),
      supabase.from('memory_verses').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    ])

    const prayerFrequency = prayerPosts.count || 0
    const scriptureReadingFrequency = scripturePosts.count || 0
    const fellowshipParticipationScore = fellowshipParticipation.count || 0
    const serviceParticipation = serviceEvents.count || 0

    const overallGrowthScore = this.calculateOverallGrowthScore({
      prayerFrequency,
      scriptureReadingFrequency,
      fellowshipParticipation: fellowshipParticipationScore,
      serviceParticipation,
      studySessions: studySessions.count || 0,
      memoryVerses: memoryVerses.count || 0
    })

    const growthTrend = this.determineGrowthTrend(userId)
    const milestones = this.getMilestones({
      prayerFrequency,
      scriptureReadingFrequency,
      fellowshipParticipation: fellowshipParticipationScore,
      serviceParticipation,
      studySessions: studySessions.count || 0,
      memoryVerses: memoryVerses.count || 0
    })

    const recommendations = this.generateRecommendations({
      prayerFrequency,
      scriptureReadingFrequency,
      fellowshipParticipation: fellowshipParticipationScore,
      serviceParticipation,
      studySessions: studySessions.count || 0,
      memoryVerses: memoryVerses.count || 0
    })

    return {
      userId,
      prayerFrequency,
      scriptureReadingFrequency,
      fellowshipParticipation: fellowshipParticipationScore,
      serviceParticipation,
      overallGrowthScore,
      growthTrend,
      milestones,
      recommendations
    }
  }

  // Private helper methods
  private static calculateSpiritualGrowthScore(metrics: {
    posts: number
    comments: number
    groups: number
    events: number
    studySessions: number
    memoryVerses: number
  }): number {
    const weights = {
      posts: 0.2,
      comments: 0.15,
      groups: 0.25,
      events: 0.2,
      studySessions: 0.15,
      memoryVerses: 0.05
    }

    const maxScores = {
      posts: 50,
      comments: 100,
      groups: 10,
      events: 20,
      studySessions: 30,
      memoryVerses: 20
    }

    let score = 0
    Object.entries(metrics).forEach(([key, value]) => {
      const normalizedValue = Math.min(value / maxScores[key as keyof typeof maxScores], 1)
      score += normalizedValue * weights[key as keyof typeof weights]
    })

    return Math.round(score * 100)
  }

  private static calculateCommunityEngagementScore(metrics: {
    posts: number
    comments: number
    likes: number
    shares: number
    groups: number
    events: number
  }): number {
    const engagementScore = metrics.posts * 2 + metrics.comments * 1 + metrics.likes * 0.5 + metrics.shares * 1.5
    const participationScore = metrics.groups * 10 + metrics.events * 5
    
    return Math.round((engagementScore + participationScore) / 10)
  }

  private static calculateOverallGrowthScore(metrics: {
    prayerFrequency: number
    scriptureReadingFrequency: number
    fellowshipParticipation: number
    serviceParticipation: number
    studySessions: number
    memoryVerses: number
  }): number {
    const weights = {
      prayerFrequency: 0.25,
      scriptureReadingFrequency: 0.25,
      fellowshipParticipation: 0.2,
      serviceParticipation: 0.15,
      studySessions: 0.1,
      memoryVerses: 0.05
    }

    let score = 0
    Object.entries(metrics).forEach(([key, value]) => {
      const normalizedValue = Math.min(value / 20, 1) // Normalize to 0-1 scale
      score += normalizedValue * weights[key as keyof typeof weights]
    })

    return Math.round(score * 100)
  }

  private static determineGrowthTrend(userId: string): 'increasing' | 'stable' | 'decreasing' {
    // In production, this would analyze historical data
    // For now, return a mock trend
    return 'increasing'
  }

  private static getMilestones(metrics: Record<string, number>): string[] {
    const milestones: string[] = []

    if (metrics.prayerFrequency >= 10) milestones.push('Prayer Warrior')
    if (metrics.scriptureReadingFrequency >= 15) milestones.push('Scripture Scholar')
    if (metrics.fellowshipParticipation >= 3) milestones.push('Community Builder')
    if (metrics.serviceParticipation >= 5) milestones.push('Servant Heart')
    if (metrics.studySessions >= 20) milestones.push('Bible Student')
    if (metrics.memoryVerses >= 10) milestones.push('Memory Master')

    return milestones
  }

  private static generateRecommendations(metrics: Record<string, number>): string[] {
    const recommendations: string[] = []

    if (metrics.prayerFrequency < 5) {
      recommendations.push('Consider sharing more prayer requests to deepen your prayer life')
    }
    if (metrics.scriptureReadingFrequency < 10) {
      recommendations.push('Try sharing more scripture verses to encourage others')
    }
    if (metrics.fellowshipParticipation < 2) {
      recommendations.push('Join more fellowship groups to build deeper relationships')
    }
    if (metrics.serviceParticipation < 3) {
      recommendations.push('Consider organizing or joining community service events')
    }
    if (metrics.studySessions < 10) {
      recommendations.push('Start a Bible study plan to grow in your faith')
    }

    return recommendations
  }

  // Get analytics dashboard data
  static async getDashboardData(userId: string): Promise<{
    userAnalytics: UserAnalytics
    communityAnalytics: CommunityAnalytics
    spiritualGrowth: SpiritualGrowthMetrics
  }> {
    const [userAnalytics, communityAnalytics, spiritualGrowth] = await Promise.all([
      this.getUserAnalytics(userId),
      this.getCommunityAnalytics(),
      this.getSpiritualGrowthMetrics(userId)
    ])

    return {
      userAnalytics,
      communityAnalytics,
      spiritualGrowth
    }
  }
}












