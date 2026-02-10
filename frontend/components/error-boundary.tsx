'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
          <div className="max-w-md text-center space-y-4">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900">
              Something went wrong
            </h3>
            <p className="text-gray-600">
              We encountered an error while loading this component.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-4 bg-gray-100 rounded-lg text-left">
                <summary className="cursor-pointer font-semibold text-sm">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4"
            >
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
