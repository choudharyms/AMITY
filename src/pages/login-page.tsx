import React, { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Leaf,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cities } from '@/src/cities'
import { toast } from 'sonner'
import './auth.css'

export interface LoginPageProps {
  initialCityId?: string
  onNavigateToRegister: () => void
  onNavigateToLanding: () => void
  onSuccess: () => void
}

export function LoginPage({
  initialCityId = 'blr',
  onNavigateToRegister,
  onNavigateToLanding,
  onSuccess,
}: LoginPageProps) {
  const [cityId, setCityId] = useState(initialCityId)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCity = cities.find((c) => c.id === cityId) || cities[0]

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isSupabaseConfigured || !supabase) {
      toast.info('Supabase keys not yet set in environment. Entering synthetic pilot workspace.')
      onSuccess()
      return
    }

    setPending(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        const code = authError.code
        if (code === 'email_not_confirmed') {
          setError('Your email has not been confirmed yet. Please check your inbox for the confirmation link.')
        } else if (authError.status === 429 || code === 'over_email_send_rate_limit') {
          setError('Too many sign-in attempts. Please wait a minute before trying again.')
        } else if (code === 'invalid_credentials' || authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please verify and try again.')
        } else {
          setError(authError.message || 'Authentication failed. Please try again.')
        }
        return
      }

      toast.success('Signed in successfully!')
      onSuccess()
    } catch (err: any) {
      setError(err?.message || 'Could not reach the authentication service. Check your connection.')
    } finally {
      setPending(false)
    }
  }

  // Quick fill helper for demonstration/testing
  function fillDemoAccount(roleEmail: string) {
    setEmail(roleEmail)
    setPassword('Rescue@Pilot2026')
    setError(null)
    toast.info(`Filled credentials for ${roleEmail}`)
  }

  return (
    <div className="auth-page-root">
      <div className="auth-bg-ambient" />
      <div className="auth-bg-grid" />

      {/* Top Header */}
      <header className="auth-header">
        <button className="auth-brand" onClick={onNavigateToLanding} title="Back to Home">
          <div className="auth-brand-logo">
            <img src="/surplus-logo.jpg" alt="AaharSetu Logo" onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'
            }} />
          </div>
          <div className="auth-brand-text">
            <span className="auth-brand-name">AaharSetu</span>
            <span className="auth-brand-sub">Food Rescue Bridge</span>
          </div>
        </button>

        <nav className="auth-header-nav">
          <button className="auth-nav-link" onClick={onNavigateToLanding}>
            <ArrowLeft size={15} />
            <span>Interactive Story</span>
          </button>
          <button className="auth-nav-link" onClick={onNavigateToRegister}>
            <span>New partner? Join Us</span>
            <ArrowRight size={15} />
          </button>
        </nav>
      </header>

      {/* Main Content Card */}
      <main className="auth-main-wrap">
        <div className="auth-card-container auth-card-compact">
          <div className="auth-title-section">
            <div className="auth-badge-pill">
              <span className="auth-badge-dot" />
              Verified Access Portal
            </div>
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">
              Sign in to coordinate food rescue dispatch in <strong>{currentCity.name}</strong>.
            </p>
          </div>

          {error && (
            <div className="auth-alert-box auth-alert-error">
              <Info size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="auth-alert-box auth-alert-info">
              <Info size={18} className="shrink-0 mt-0.5" />
              <div>
                <strong>Pilot Mode Active:</strong>
                <p className="text-xs mt-0.5 opacity-90">
                  Supabase live keys are not configured yet. You can sign in directly or explore the synthetic demo data.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="auth-form">
            {/* City Network */}
            <div className="auth-input-group">
              <label className="auth-label" htmlFor="login-city">
                <span>Rescue City Network</span>
              </label>
              <div className="auth-input-wrapper">
                <MapPin size={16} className="auth-input-icon" />
                <select
                  id="login-city"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className="auth-select-field"
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                      {c.name} ({c.state})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email Address */}
            <div className="auth-input-group">
              <label className="auth-label" htmlFor="login-email">
                Email Address
              </label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="coordinator@aaharsetu.org"
                  className="auth-input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-input-group">
              <label className="auth-label" htmlFor="login-password">
                <span>Password</span>
              </label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="auth-input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-input-action-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={pending}
            >
              {pending ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  <span>Signing In…</span>
                </>
              ) : (
                <>
                  <KeyRound size={17} />
                  <span>Sign In to Network</span>
                </>
              )}
            </button>
          </form>

          {/* Quick-test Demo Accounts for Evaluators */}
          <div className="auth-quick-demo">
            <div className="auth-quick-demo-title">
              <Zap size={14} />
              <span>Pilot Testing Accounts</span>
            </div>
            <div className="auth-quick-chips">
              <button
                type="button"
                className="auth-chip-btn"
                onClick={() => fillDemoAccount('coordinator@aaharsetu.org')}
              >
                Coordinator
              </button>
              <button
                type="button"
                className="auth-chip-btn"
                onClick={() => fillDemoAccount('saravana.bhavan@donor.in')}
              >
                Food Donor
              </button>
              <button
                type="button"
                className="auth-chip-btn"
                onClick={() => fillDemoAccount('arun.volunteer@driver.org')}
              >
                Volunteer Driver
              </button>
              <button
                type="button"
                className="auth-chip-btn"
                onClick={() => fillDemoAccount('ashakiran@shelter.org')}
              >
                Shelter Org
              </button>
            </div>
          </div>

          {/* Direct demo bypass button */}
          <div className="mt-4 pt-4 border-t border-emerald-500/10 text-center">
            <button
              type="button"
              className="text-xs text-emerald-400/90 hover:text-emerald-300 font-medium inline-flex items-center gap-1.5 transition-colors"
              onClick={onSuccess}
            >
              <Sparkles size={13} />
              <span>Enter Workspace Directly as Pilot Visitor</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="auth-footer-nav">
            New to AaharSetu?
            <button type="button" className="auth-link-button" onClick={onNavigateToRegister}>
              Join Us & Register
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
