import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const RSVP_FILE = path.join(process.cwd(), 'data', 'rsvps.json')

function getRSVPs() {
  if (!fs.existsSync(RSVP_FILE)) {
    return []
  }
  const data = fs.readFileSync(RSVP_FILE, 'utf8')
  return JSON.parse(data)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const allRSVPs = getRSVPs()
    const eventAttendees = allRSVPs.filter(
      (rsvp: any) => rsvp.eventId.toString() === eventId.toString() && rsvp.status === 'confirmed'
    )

    return NextResponse.json({
      success: true,
      attendees: eventAttendees,
      total: eventAttendees.length
    })

  } catch (error) {
    console.error('Attendees API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}