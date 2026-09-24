import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AaharSetu ErrorBoundary caught error]:', error, errorInfo)
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('aaharsetu_city_id')
      window.location.hash = 'overview'
    } catch { /* ignore */ }
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.hash = 'landing'
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-2xl border border-destructive/20 bg-card shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="default" onClick={this.handleReset} className="gap-1.5 text-xs">
                <RefreshCw size={13} /> Reload & Recover
              </Button>
              <Button size="sm" variant="outline" onClick={this.handleGoHome} className="gap-1.5 text-xs">
                <Home size={13} /> Return to Landing
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
