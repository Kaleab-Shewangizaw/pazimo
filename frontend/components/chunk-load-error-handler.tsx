'use client'

import { useEffect } from 'react'

export default function ChunkLoadErrorHandler() {
  useEffect(() => {
    const handleChunkLoadError = (event: ErrorEvent) => {
      // Check if the error is a ChunkLoadError
      if (
        event.message?.includes('ChunkLoadError') ||
        event.message?.includes('Loading chunk') ||
        event.message?.includes('failed')
      ) {
        console.warn('ChunkLoadError detected, reloading page...')
        // Force a hard reload to get the latest version
        window.location.reload()
      }
    }

    // Listen for unhandled errors
    window.addEventListener('error', handleChunkLoadError)

    // Also listen for unhandled promise rejections (which can include chunk loading errors)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message?.includes('ChunkLoadError') ||
        event.reason?.message?.includes('Loading chunk') ||
        event.reason?.message?.includes('failed')
      ) {
        console.warn('ChunkLoadError detected in promise rejection, reloading page...')
        window.location.reload()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleChunkLoadError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
