import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

const resendApiKey = process.env.RESEND_API_KEY
const resendFromEmail = process.env.RESEND_FROM_EMAIL

const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to send invites' },
        { status: 401 }
      )
    }

    if (!resendApiKey || !resendFromEmail) {
      return NextResponse.json(
        { error: 'Email provider not configured' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { email, group_id, message } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    if (!group_id) {
      return NextResponse.json(
        { error: 'group_id is required for group invites' },
        { status: 400 }
      )
    }

    const userId = authUser.userId

    const { data: memberships, error: membershipError } = await supabaseServer
      .from('group_memberships')
      .select('role, status')
      .eq('group_id', group_id)
      .eq('user_id', userId)

    if (membershipError) {
      console.error('Error checking membership:', membershipError)
      return NextResponse.json(
        { error: 'Failed to verify membership. Please try again.' },
        { status: 500 }
      )
    }

    const activeMembership = memberships?.find((m: { status: string }) => m.status === 'active')
    if (!activeMembership) {
      return NextResponse.json(
        { error: 'You must be a member of this group to create invites' },
        { status: 403 }
      )
    }

    let inviteCode = generateInviteCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const { data: existing } = await supabaseServer
        .from('invites')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()

      if (!existing) {
        break
      }

      inviteCode = generateInviteCode()
      attempts++
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique invite code. Please try again.' },
        { status: 500 }
      )
    }

    const { data: invite, error: createError } = await supabaseServer
      .from('invites')
      .insert({
        invite_code: inviteCode,
        inviter_user_id: userId,
        invite_type: 'group',
        group_id,
      })
      .select()
      .single()

    if (createError || !invite) {
      console.error('Error creating invite:', createError)
      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gathered-app.vercel.app'
    const inviteUrl = `${baseUrl}/invite/${inviteCode}`

    const { data: group, error: groupError } = await supabaseServer
      .from('fellowship_groups')
      .select('name, description')
      .eq('id', group_id)
      .single()

    if (groupError) {
      console.error('Error loading group info:', groupError)
    }

    const groupName = group?.name || 'your group'
    const groupDescription = group?.description || ''
    const safeMessage = typeof message === 'string' ? message.trim() : ''

    const resend = new Resend(resendApiKey)
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f1433;">
        <h2>You have been invited to join ${groupName} on Gathered</h2>
        ${safeMessage ? `<p>${safeMessage}</p>` : ''}
        ${groupDescription ? `<p><strong>About the group:</strong> ${groupDescription}</p>` : ''}
        <p>Click the button below to join instantly:</p>
        <p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 18px; background: #F5C451; color: #0F1433; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Join ${groupName}
          </a>
        </p>
        <p>Or copy this link:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      </div>
    `

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: `You're invited to join ${groupName} on Gathered`,
      html,
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      return NextResponse.json(
        { error: resendError.message || 'Email provider error' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, inviteUrl, messageId: resendData?.id })
  } catch (error: any) {
    console.error('Error in POST /api/invites/email:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

