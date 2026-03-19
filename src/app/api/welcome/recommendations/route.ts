import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

type FellowshipGroup = {
  id: string
  name: string
  description: string | null
  is_private: boolean
  location: string | null
  member_count: number | null
  tags: string[] | null
  is_active: boolean
  created_at: string
}

const normalize = (value?: string | null) => value?.trim().toLowerCase() || ''

function scoreGroup(group: FellowshipGroup, userCity: string | null, interests: string[]) {
  const normalizedCity = normalize(userCity)
  const normalizedLocation = normalize(group.location)
  const sameCity = normalizedCity && normalizedLocation.includes(normalizedCity) ? 2 : 0
  const interestSet = new Set(interests.map((interest) => interest.toLowerCase()))
  const tagMatches = (group.tags || []).filter((tag) => interestSet.has(tag.toLowerCase())).length

  return sameCity + tagMatches + Math.min(group.member_count || 0, 50) / 50
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabaseServer
      .from('user_profiles')
      .select('city, interests')
      .eq('id', authUser.userId)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }

    const { data: memberships, error: membershipError } = await supabaseServer
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', authUser.userId)
      .eq('status', 'active')

    if (membershipError) {
      return NextResponse.json({ error: 'Failed to load memberships' }, { status: 500 })
    }

    const joinedIds = new Set((memberships || []).map((membership: { group_id: string }) => membership.group_id))

    const { data: groups, error: groupsError } = await supabaseServer
      .from('fellowship_groups')
      .select('id, name, description, is_private, location, member_count, tags, is_active, created_at')
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .limit(25)

    if (groupsError) {
      return NextResponse.json({ error: 'Failed to load groups' }, { status: 500 })
    }

    const interests = Array.isArray(profile?.interests) ? profile.interests : []
    const candidates = (groups || []).filter((group: FellowshipGroup) => !joinedIds.has(group.id))

    if (candidates.length === 0) {
      return NextResponse.json({ group: null })
    }

    const recommendedGroup = [...candidates].sort((a, b) => {
      const scoreDiff = scoreGroup(b, profile?.city || null, interests) - scoreGroup(a, profile?.city || null, interests)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })[0]

    return NextResponse.json({ group: recommendedGroup })
  } catch (error: any) {
    console.error('Error in GET /api/welcome/recommendations:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
