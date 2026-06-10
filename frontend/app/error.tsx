'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application Error:', error)

    // Check if it's a ChunkLoadError and force reload
    if (
      error.message?.includes('ChunkLoadError') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('failed')
    ) {
      console.warn('ChunkLoadError detected in error boundary, reloading page...')
      window.location.reload()
    }
  }, [error])

  // Don't show the error UI for ChunkLoadError since we're auto-reloading
  const isChunkLoadError =
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('failed')

  if (isChunkLoadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold text-gray-900">Updating...</h2>
          <p className="text-gray-600">
            We're loading the latest version of the application. Please wait.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900">Something went wrong!</h2>
        <p className="text-gray-600">
          We apologize for the inconvenience. An unexpected error has occurred.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
            <summary className="cursor-pointer font-semibold text-sm">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 text-xs overflow-auto">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <Button
            onClick={() => reset()}
            className="bg-[#1a2d5a] hover:bg-[#2a4d7a]"
          >
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    </div>
  )
}
