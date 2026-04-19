import { supabase } from './supabase'
import { FellowshipGroup, GroupMembership, JoinRequest } from '@/types'

export class FellowshipService {
  // Get groups the user has joined (active memberships only)
  static async getUserJoinedGroups(userId: string): Promise<FellowshipGroup[]> {
    const { data: memberships, error: membershipsError } = await supabase
      .from('group_memberships')
      .select('group_id, joined_at')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (membershipsError) throw membershipsError
    if (!memberships || memberships.length === 0) return []

    const groupIds = memberships.map(m => m.group_id)
    const { data: groups, error: groupsError } = await supabase
      .from('fellowship_groups')
      .select('*')
      .in('id', groupIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (groupsError) throw groupsError

    const joinedAtMap = new Map(memberships.map(m => [m.group_id, m.joined_at]))
    return (groups || []).sort((a, b) => {
      const aJoined = joinedAtMap.get(a.id) || a.created_at
      const bJoined = joinedAtMap.get(b.id) || b.created_at
      return new Date(bJoined).getTime() - new Date(aJoined).getTime()
    })
  }

  // Get group IDs where the user has a pending membership request
  static async getUserPendingGroupIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (error) throw error
    return new Set((data || []).map(m => m.group_id))
  }

  // Get all public groups or groups user is member of
  static async getGroups(userId?: string): Promise<FellowshipGroup[]> {
    let query = supabase
      .from('fellowship_groups')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (userId) {
      const { data: userGroups } = await supabase
        .from('group_memberships')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'active')

      const userGroupIds = userGroups?.map(m => m.group_id) || []

      if (userGroupIds.length > 0) {
        query = query.or(`is_private.eq.false,id.in.(${userGroupIds.join(',')})`)
      } else {
        query = query.eq('is_private', false)
      }
    } else {
      query = query.eq('is_private', false)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  // Get group by ID
  static async getGroup(groupId: string): Promise<FellowshipGroup | null> {
    const { data, error } = await supabase
      .from('fellowship_groups')
      .select('*')
      .eq('id', groupId)
      .single()

    if (error) throw error
    return data
  }

  // Create a new fellowship group
  static async createGroup(groupData: Omit<FellowshipGroup, 'id' | 'created_at' | 'updated_at' | 'member_count'>): Promise<FellowshipGroup> {
    const { data: groups, error } = await supabase
      .from('fellowship_groups')
      .insert([groupData])
      .select()
      .limit(1)

    if (error) throw error

    const group = groups && groups.length > 0 ? groups[0] : null
    if (!group?.id) throw new Error('Group created but ID is missing')

    // Add creator as admin member (upsert in case of race)
    await supabase
      .from('group_memberships')
      .upsert([{
        group_id: group.id,
        user_id: groupData.created_by,
        role: 'admin',
        status: 'active',
        joined_at: new Date().toISOString(),
      }], { onConflict: 'group_id,user_id' })

    return group
  }

  // Update an existing fellowship group (admin only — server enforces this)
  static async updateGroup(groupId: string, updates: Partial<Pick<FellowshipGroup, 'name' | 'description' | 'tags' | 'is_private' | 'max_members' | 'meeting_schedule' | 'meeting_location' | 'location'>>): Promise<FellowshipGroup> {
    const { data, error } = await supabase
      .from('fellowship_groups')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', groupId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Join a public group — upserts so it's safe if a pending row already exists
  static async joinGroup(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('group_memberships')
      .upsert([{
        group_id: groupId,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      }], { onConflict: 'group_id,user_id' })

    if (error) throw error
    await this.updateMemberCount(groupId)
  }

  // Request to join a private group — inserts a pending row via upsert
  static async requestToJoinGroup(groupId: string, userId: string): Promise<void> {
    // Check for an existing row first
    const { data: existing } = await supabase
      .from('group_memberships')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing?.status === 'active') return   // already a member
    if (existing?.status === 'pending') return   // already requested

    const { error } = await supabase
      .from('group_memberships')
      .insert([{
        group_id: groupId,
        user_id: userId,
        role: 'member',
        status: 'pending',
        joined_at: new Date().toISOString(),
      }])

    if (error) throw error
  }

  // Check if the user has a pending join request for a group
  static async hasPendingRequest(groupId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1)

    return !!data && data.length > 0
  }

  // Approve join request (updates pending membership to active)
  static async approveJoinRequest(requestId: string, approvedBy: string): Promise<void> {
    const { data: request } = await supabase
      .from('join_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) throw new Error('Request not found')

    await supabase
      .from('group_memberships')
      .insert([{
        group_id: request.group_id,
        user_id: request.user_id,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
        invited_by: approvedBy,
      }])

    await supabase
      .from('join_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: approvedBy,
      })
      .eq('id', requestId)

    await this.updateMemberCount(request.group_id)
  }

  // Reject join request
  static async rejectJoinRequest(requestId: string, rejectedBy: string): Promise<void> {
    const { error } = await supabase
      .from('join_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: rejectedBy,
      })
      .eq('id', requestId)

    if (error) throw error
  }

  // Get group members (active only for public display)
  static async getGroupMembers(groupId: string): Promise<GroupMembership[]> {
    const { data, error } = await supabase
      .from('group_memberships')
      .select(`
        *,
        user:user_id (
          id,
          email,
          user_metadata
        )
      `)
      .eq('group_id', groupId)
      .eq('status', 'active')

    if (error) throw error
    return data || []
  }

  // Get pending join requests for a group (reads from join_requests table — legacy)
  static async getPendingRequests(groupId: string): Promise<JoinRequest[]> {
    const { data, error } = await supabase
      .from('join_requests')
      .select(`
        *,
        user:user_id (
          id,
          email,
          user_metadata
        )
      `)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Check if user is active member of group
  static async isMember(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)

    return !error && !!data && data.length > 0
  }

  // Get user's membership for a specific group (active only)
  static async getUserMembershipForGroup(userId: string, groupId: string): Promise<GroupMembership | null> {
    const { data, error } = await supabase
      .from('group_memberships')
      .select('id, group_id, user_id, role, status, joined_at, invited_by')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)

    if (error) throw error
    return (data && data.length > 0) ? (data[0] as GroupMembership) : null
  }

  // Check if user is active member of group (alias)
  static async isUserMemberOfGroup(userId: string, groupId: string): Promise<boolean> {
    const membership = await this.getUserMembershipForGroup(userId, groupId)
    return membership !== null
  }

  // Check if user is admin of group
  static async isAdmin(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('group_memberships')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    return !error && data?.role === 'admin'
  }

  // Count admins in a group (used for sole-admin check)
  static async getAdminCount(groupId: string): Promise<number> {
    const { count, error } = await supabase
      .from('group_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('role', 'admin')
      .eq('status', 'active')

    if (error) throw error
    return count ?? 0
  }

  // Update member count
  private static async updateMemberCount(groupId: string): Promise<void> {
    const { count } = await supabase
      .from('group_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')

    await supabase
      .from('fellowship_groups')
      .update({ member_count: count || 0 })
      .eq('id', groupId)
  }

  // Leave group — deletes the membership row entirely
  static async leaveGroup(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('group_memberships')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)

    if (error) throw error
    await this.updateMemberCount(groupId)
  }
}
