import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body } = await request.json()

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/send-invitation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        body
      })
    })

    if (response.ok) {
      console.log(`✅ Email sent to ${to}`)
      return NextResponse.json({ success: true })
    } else {
      console.log(`📧 Email failed for ${to}: ${subject}`)
      return NextResponse.json({ success: false })
    }
    
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ success: false })
  }
}