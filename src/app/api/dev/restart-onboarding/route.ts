import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'
import { isUserSteward } from '@/lib/server-auth'

function isAllowedTester(email?: string) {
  const allowlist = (process.env.DEV_TESTER_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (!email) return false
  return allowlist.includes(email.toLowerCase())
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isDevelopment = process.env.NODE_ENV !== 'production'
    const userIsSteward = await isUserSteward(authUser.userId)
    const userIsAllowlisted = isAllowedTester(authUser.email)

    if (!isDevelopment && !userIsSteward && !userIsAllowlisted) {
      return NextResponse.json(
        { error: 'This tool is restricted to internal testing accounts.' },
        { status: 403 }
      )
    }

    const { error } = await supabaseServer
      .from('user_profiles')
      .update({
        onboarding_completed: false,
        onboarding_version: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.userId)

    if (error) {
      console.error('Error restarting onboarding:', error)
      return NextResponse.json(
        { error: 'Failed to restart onboarding', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/dev/restart-onboarding:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
