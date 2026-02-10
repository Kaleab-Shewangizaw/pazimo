'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
          <div className="max-w-md text-center space-y-4 bg-white p-8 rounded-lg shadow-lg">
            <div className="text-6xl mb-4">🚨</div>
            <h2 className="text-2xl font-bold text-gray-900">Critical Error</h2>
            <p className="text-gray-600">
              A critical error has occurred. Please refresh the page or contact support if the issue persists.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
                <summary className="cursor-pointer font-semibold text-sm">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {error.message}
                  {error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => reset()}
                className="px-4 py-2 bg-[#1a2d5a] text-white rounded hover:bg-[#2a4d7a]"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
