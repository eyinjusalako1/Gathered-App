import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'
import { isUserSteward } from '@/lib/server-auth'

/**
 * PATCH /api/fellowship/[id]/update
 *
 * Update a group's editable fields. Only the group admin or a steward may do this.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const groupId = resolvedParams.id

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    const authResult = await createUserSupabaseClient(req)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = authResult

    // Check that caller is admin of this group or a steward
    const { data: membership } = await supabaseServer
      .from('group_memberships')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    const isSteward = await isUserSteward(userId)
    const isAdmin = membership?.role === 'admin'

    if (!isAdmin && !isSteward) {
      return NextResponse.json({ error: 'Only group admins can edit this group' }, { status: 403 })
    }

    const body = await req.json()

    // Whitelist editable fields
    const allowed = ['name', 'description', 'tags', 'is_private', 'max_members', 'meeting_schedule', 'meeting_location', 'location']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Validate name if provided
    if (updates.name !== undefined && (typeof updates.name !== 'string' || (updates.name as string).trim().length < 3)) {
      return NextResponse.json({ error: 'Group name must be at least 3 characters' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: group, error } = await supabaseServer
      .from('fellowship_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single()

    if (error) {
      console.error('Error updating group:', error)
      return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
    }

    return NextResponse.json({ group })
  } catch (error: any) {
    console.error('Error in PATCH /api/fellowship/[id]/update:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
