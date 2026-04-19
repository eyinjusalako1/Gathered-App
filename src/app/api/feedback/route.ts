import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, message } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.error('Resend not configured')
      return NextResponse.json({ error: 'Email provider not configured' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f1433; max-width: 600px;">
        <h2 style="color: #0f1433;">New feedback from Gathered landing page</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; width: 80px;">Name</td>
            <td style="padding: 8px 0;">${name.trim()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Email</td>
            <td style="padding: 8px 0;"><a href="mailto:${email.trim()}">${email.trim()}</a></td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <h3 style="margin-top: 0;">Message</h3>
        <p style="white-space: pre-wrap;">${message.trim()}</p>
      </div>
    `

    const { error: resendError } = await resend.emails.send({
      from: 'Gathered <hello@gathered-app.com>',
      to: 'hello@gathered-app.com',
      subject: `Gathered feedback from ${name.trim()}`,
      html,
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
