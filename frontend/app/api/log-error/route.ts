import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const errorLog = await request.json()
    
    // Log the error to server console
    console.error('Client Error Logged:', {
      timestamp: errorLog.timestamp,
      message: errorLog.message,
      url: errorLog.url,
      userAgent: errorLog.userAgent,
      stack: errorLog.stack,
      additionalInfo: errorLog.additionalInfo,
    })

    // TODO: In production, you might want to:
    // 1. Store errors in a database
    // 2. Send to error tracking service (Sentry, LogRocket, etc.)
    // 3. Send critical errors to Slack/email notifications
    // 4. Aggregate and analyze error patterns

    // Example: Forward to your backend error logging service
    // await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/client-errors`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorLog),
    // })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Failed to log client error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 }
    )
  }
}
