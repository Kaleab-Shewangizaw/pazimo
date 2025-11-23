import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json()

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        message
      }),
    })

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('SMS send error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send SMS' }, { status: 500 })
  }
}