'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, token, isAuthenticated } = useAuthStore()

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

  return <>{children}</>
} 