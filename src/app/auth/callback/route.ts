import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')

  console.log('[auth/callback] hit', {
    fullUrl: request.url,
    code: code ? `${code.slice(0, 8)}…` : null,
    type,
    allParams: Object.fromEntries(requestUrl.searchParams.entries()),
  })

  if (code) {
    // Recovery tokens must never sign the user in directly.
    // Pass the code to the reset-password page, which exchanges it client-side
    // only after the user has submitted a new password.
    if (type === 'recovery' || type === 'password') {
      console.log('[auth/callback] password-reset token detected — redirecting to /auth/reset-password with code (unconsumed)', { type })
      const destination = new URL('/auth/reset-password', requestUrl.origin)
      destination.searchParams.set('code', code)
      return NextResponse.redirect(destination)
    }

    console.log('[auth/callback] type is not a reset token — will exchange code and redirect to /dashboard', { type })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
      }
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=verification_failed', requestUrl.origin))
}