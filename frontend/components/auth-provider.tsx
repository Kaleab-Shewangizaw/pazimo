'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

function BannedScreen({ reason, onLogout }: { reason: string | null; onLogout: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-destructive">Account Suspended</h1>
        <p className="text-sm text-muted-foreground">
          {reason || 'Your account has been suspended due to repeated payment manipulation attempts.'}
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this is a mistake, please contact support.
        </p>
        <button
          onClick={onLogout}
          className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Log out
        </button>
      </div>
    </div>
  )
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, token, isAuthenticated, isBanned, banReason, checkAccountStatus, logout } = useAuthStore()

  useEffect(() => {
    if (token) {
      checkAccountStatus()
    }
    // Only re-check when the token itself changes (login/logout), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    // Initialize auth state from persisted storage
    // Wrapped in try-catch to prevent crashes
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedUser = localStorage.getItem('auth-storage')
        if (storedUser) {
          const { state } = JSON.parse(storedUser)
          if (state?.user && state?.token) {
            useAuthStore.setState({
              user: state.user,
              token: state.token,
              isAuthenticated: true
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error)
      // Clear corrupted storage
      try {
        localStorage.removeItem('auth-storage')
      } catch (e) {
        // Ignore if localStorage is not available
      }
    }
  }, [])

  if (isBanned) {
    return <BannedScreen reason={banReason} onLogout={() => { logout(); window.location.href = '/login' }} />
  }

  return <>{children}</>
}