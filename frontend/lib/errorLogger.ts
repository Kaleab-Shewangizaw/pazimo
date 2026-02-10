// Client-side error logging utility
// This helps track and debug errors in production

interface ErrorLog {
  message: string
  stack?: string
  timestamp: string
  url: string
  userAgent: string
  additionalInfo?: Record<string, any>
}

class ErrorLogger {
  private static instance: ErrorLogger
  private errors: ErrorLog[] = []
  private maxErrors = 50 // Keep last 50 errors in memory

  private constructor() {
    if (typeof window !== 'undefined') {
      // Capture unhandled errors
      window.addEventListener('error', (event) => {
        this.logError({
          message: event.message,
          stack: event.error?.stack,
          additionalInfo: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        })
      })

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.logError({
          message: `Unhandled Promise Rejection: ${event.reason}`,
          stack: event.reason?.stack,
          additionalInfo: {
            reason: event.reason,
          },
        })
      })
    }
  }

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger()
    }
    return ErrorLogger.instance
  }

  public logError(error: {
    message: string
    stack?: string
    additionalInfo?: Record<string, any>
  }): void {
    if (typeof window === 'undefined') return

    const errorLog: ErrorLog = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      additionalInfo: error.additionalInfo,
    }

    // Add to in-memory log
    this.errors.push(errorLog)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift() // Remove oldest error
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error logged:', errorLog)
    }

    // In production, you could send this to your error tracking service
    // Example: Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorLog)
    }

    // Store in localStorage for debugging (last 10 errors)
    try {
      const storedErrors = this.getStoredErrors()
      storedErrors.unshift(errorLog)
      const limitedErrors = storedErrors.slice(0, 10)
      localStorage.setItem('app-error-logs', JSON.stringify(limitedErrors))
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  private sendToErrorService(error: ErrorLog): void {
    // TODO: Implement error tracking service integration
    // Example with a generic endpoint:
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error),
      }).catch(() => {
        // Silently fail - don't cause more errors
      })
    } catch (e) {
      // Ignore
    }
  }

  public getErrors(): ErrorLog[] {
    return [...this.errors]
  }

  public getStoredErrors(): ErrorLog[] {
    try {
      const stored = localStorage.getItem('app-error-logs')
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      return []
    }
  }

  public clearErrors(): void {
    this.errors = []
    try {
      localStorage.removeItem('app-error-logs')
    } catch (e) {
      // Ignore
    }
  }
}

// Export singleton instance
export const errorLogger = typeof window !== 'undefined' 
  ? ErrorLogger.getInstance() 
  : null

// Helper function to log errors
export const logError = (
  message: string,
  error?: Error,
  additionalInfo?: Record<string, any>
) => {
  errorLogger?.logError({
    message,
    stack: error?.stack,
    additionalInfo: {
      ...additionalInfo,
      errorName: error?.name,
      errorMessage: error?.message,
    },
  })
}

export default errorLogger
