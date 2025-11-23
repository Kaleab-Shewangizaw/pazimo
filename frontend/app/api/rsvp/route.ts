import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { eventId, customerName, contact, guestType, status } = await request.json()

    if (!eventId || !customerName || !contact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rsvp/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId,
        customerName,
        contact,
        guestType,
        status
      })
    })

    const result = await response.json()
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('RSVP route error:', error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}