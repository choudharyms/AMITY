import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

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
    console.error('AaharSetu caught an uncaught rendering error:', error, errorInfo)
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('aaharsetu_city_id')
      window.location.hash = 'overview'
    } catch { /* ignore */ }
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  private handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.hash = 'landing'
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 20%, #15291b 0%, #08110b 100%)',
          color: '#f0fdf4',
          fontFamily: "'Inter', sans-serif",
          padding: '24px',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'rgba(18, 38, 25, 0.85)',
            border: '1px solid rgba(134, 239, 172, 0.2)',
            borderRadius: '16px',
            padding: '36px 30px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
            textAlign: 'center',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}>
              <AlertTriangle size={28} />
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '10px' }}>
              Unexpected Display Issue
            </h1>
            <p style={{ fontSize: '13px', color: '#a7f3d0', lineHeight: 1.6, marginBottom: '24px' }}>
              AaharSetu encountered an unexpected issue while rendering this view. Your saved preferences and credentials are safe.
            </p>

            {this.state.error && (
              <pre style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: '#f87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px',
                maxHeight: '120px',
              }}>
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#22c55e',
                  color: '#052e16',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                <RotateCcw size={15} /> Reload Workspace
              </button>
              <button
                onClick={this.handleHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Home size={15} /> Return Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
