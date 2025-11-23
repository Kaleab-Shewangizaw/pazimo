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
    const storedUser = localStorage.getItem('auth-storage')
    if (storedUser) {
      try {
        const { state } = JSON.parse(storedUser)
        if (state.user && state.token) {
          useAuthStore.setState({
            user: state.user,
            token: state.token,
            isAuthenticated: true
          })
        }
      } catch (error) {
        console.error('Failed to parse stored auth state:', error)
      }
    }
  }, [])

  return <>{children}</>
} 