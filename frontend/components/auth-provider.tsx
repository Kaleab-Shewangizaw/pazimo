'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

function BannedScreen({ reason, onLogout }: { reason: string | null; onLogout: () => void }) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const logoSrc = mounted && (theme === 'dark' || resolvedTheme === 'dark') ? '/logo4.png' : '/logo3.png'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-background px-4">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--destructive) 12%, transparent), transparent 60%)',
        }}
      />

      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-xl shadow-black/5 dark:shadow-black/40">
        <Image
          src={logoSrc}
          alt="Pazimo"
          width={120}
          height={40}
          className="mx-auto h-8 w-auto object-contain"
          priority
        />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-card-foreground">Account Suspended</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {reason || 'Your account has been suspended due to repeated payment manipulation attempts.'}
          </p>
        </div>

        <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          If you believe this is a mistake, please contact support.
        </div>

        <button
          onClick={onLogout}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
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
    return <BannedScreen reason={banReason} onLogout={() => { logout(); window.location.href = '/sign-in' }} />
  }

  return <>{children}</>
}