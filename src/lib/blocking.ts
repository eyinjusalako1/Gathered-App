import { supabaseServer } from '@/lib/supabaseServer'

export type BlockDirection = 'none' | 'blocked' | 'blocked_by'

export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const blockedIds = new Set<string>()

  const { data, error } = await supabaseServer
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)

  if (error) {
    console.error('Error loading blocked users:', error)
    return blockedIds
  }

  data?.forEach((row: any) => {
    if (row.blocker_id === userId) {
      blockedIds.add(row.blocked_id)
    } else if (row.blocked_id === userId) {
      blockedIds.add(row.blocker_id)
    }
  })

  return blockedIds
}

export async function getBlockDirection(
  userId: string,
  otherUserId: string
): Promise<BlockDirection> {
  const { data, error } = await supabaseServer
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`
    )
    .limit(1)

  if (error || !data || data.length === 0) {
    return 'none'
  }

  const row = data[0]
  if (row.blocker_id === userId) return 'blocked'
  return 'blocked_by'
}



