import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === '/sign-in'

  // Get the token from the cookies
  const token = request.cookies.get('token')?.value || ''

  // Redirect logic
  if (isPublicPath && token) {
    // If user is logged in and tries to access sign-in/sign-up, redirect to home
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!isPublicPath && !token) {
    // If user is not logged in and tries to access protected routes, redirect to sign-in
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [] // Empty array means no routes will be protected by middleware
} 