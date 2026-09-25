import React, { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartHandshake,
  Info,
  Leaf,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  UtensilsCrossed,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cities } from '@/src/cities'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import './auth.css'

export type Role = 'donor' | 'driver' | 'recipient' | 'coordinator'

interface RoleOption {
  id: Role
  label: string
  subtitle: string
  badge: string
  icon: React.ReactNode
}

const roleOptions: RoleOption[] = [
  {
    id: 'donor',
    label: 'Food Donor',
    subtitle: 'Restaurants, caterers, hotels, event venues with surplus food',
    badge: 'Surplus Provider',
    icon: <UtensilsCrossed size={22} />,
  },
  {
    id: 'driver',
    label: 'Volunteer Driver',
    subtitle: 'Deliver food swiftly from donors to local shelters across your city',
    badge: 'Rescue Transport',
    icon: <Bike size={22} />,
  },
  {
    id: 'recipient',
    label: 'Recipient / Shelter',
    subtitle: 'NGOs, shelters, community kitchens serving warm meals to people in need',
    badge: 'Distribution Partner',
    icon: <HeartHandshake size={22} />,
  },
  {
    id: 'coordinator',
    label: 'Network Coordinator',
    subtitle: 'Food safety audits, regional logistics & dispatch management',
    badge: 'Operations',
    icon: <ShieldCheck size={22} />,
  },
]

export interface RegisterPageProps {
  initialCityId?: string
  onNavigateToLogin: () => void
  onNavigateToLanding: () => void
  onSuccess: () => void
}

export function RegisterPage({
  initialCityId = 'blr',
  onNavigateToLogin,
  onNavigateToLanding,
  onSuccess,
}: RegisterPageProps) {
  const [step, setStep] = useState<'role' | 'details' | 'success'>('role')
  const [selectedRole, setSelectedRole] = useState<Role>('donor')
  const [cityId, setCityId] = useState(initialCityId)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState<string>('')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')
  const [fssaiLicense, setFssaiLicense] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToSafety, setAgreedToSafety] = useState(true)

  const selectedRoleMeta = roleOptions.find((r) => r.id === selectedRole) || roleOptions[0]
  const currentCity = cities.find((c) => c.id === cityId) || cities[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    if (!agreedToSafety) {
      setError('Please confirm that you agree to food rescue safety standards.')
      return
    }

    if (!isSupabaseConfigured || !supabase) {
      // In offline/demo mode, guide user or provide demo simulation
      toast.info('Simulating registration in pilot demo mode (Supabase keys not yet set).')
      setSuccessEmail(email || 'pilot@aaharsetu.org')
      setStep('success')
      return
    }

    setPending(true)
    try {
      const metadata: Record<string, string> = {
        display_name: fullName.trim(),
        city_id: cityId,
        role: selectedRole,
        requested_role: selectedRole,
      }
      if (organization.trim()) metadata.organization = organization.trim()
      if (phone.trim()) metadata.phone = phone.trim()
      if (selectedRole === 'donor' && fssaiLicense.trim()) {
        metadata.fssai_license = fssaiLicense.trim()
      }
      if ((selectedRole === 'driver' || selectedRole === 'recipient') && area.trim()) {
        metadata.area = area.trim()
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: import.meta.env.VITE_AUTH_REDIRECT || `${window.location.origin}/auth/callback`,
          data: metadata,
        },
      })

      if (authError) {
        const code = authError.code
        const msg = authError.message?.toLowerCase() || ''
        if (authError.status === 429 || code === 'over_email_send_rate_limit') {
          setError('Too many registration requests. Please wait a minute before trying again.')
        } else if (
          code === 'user_already_exists' ||
          code === 'email_exists' ||
          authError.status === 422 ||
          msg.includes('already registered') ||
          msg.includes('already exists')
        ) {
          setError('An account with this email address already exists. Please sign in instead.')
        } else if (code === 'weak_password') {
          setError('Password should be at least 8 characters long.')
        } else {
          setError(authError.message || 'Could not complete registration. Please check your details and try again.')
        }
        return
      }

      setSuccessEmail(email)

      // If user session is returned immediately (email confirmation disabled)
      if (data.session) {
        toast.success(`Welcome to AaharSetu, ${fullName.split(' ')[0]}!`)
        onSuccess()
      } else {
        // Confirmation email sent
        setStep('success')
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to reach the authentication service. Please check your network.')
    } finally {
      setPending(false)
    }
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
              // Fallback to leaf icon if logo is missing
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
          <button className="auth-nav-link" onClick={onNavigateToLogin}>
            <span>Already a partner? Sign In</span>
            <ArrowRight size={15} />
          </button>
        </nav>
      </header>

      {/* Main Content Card */}
      <main className="auth-main-wrap">
        <div className="auth-card-container">
          {step === 'success' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={36} />
              </div>
              <div className="auth-badge-pill mx-auto mb-3">Registration Received</div>
              <h1 className="auth-title">Welcome to AaharSetu</h1>
              <p className="auth-subtitle max-w-md mx-auto mb-6">
                We've sent a verification link to <strong className="text-emerald-300">{successEmail}</strong>.
                Please verify your email address to activate your {selectedRoleMeta.label} access in {currentCity.name}.
              </p>

              <div className="auth-alert-box auth-alert-info text-left max-w-md mx-auto mb-6">
                <Info size={18} className="shrink-0 text-blue-400 mt-0.5" />
                <div>
                  <strong>Next steps:</strong>
                  <ul className="list-disc list-inside mt-1 text-xs opacity-90 space-y-1">
                    <li>Click the confirmation link in your email.</li>
                    <li>If you signed up as a food donor or shelter, our regional coordinator will review your profile.</li>
                    <li>You can sign in anytime to monitor rescue activity in your city.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <button className="auth-submit-btn" onClick={onNavigateToLogin}>
                  Proceed to Sign In
                  <ArrowRight size={16} />
                </button>
                <button className="auth-nav-link justify-center py-3" onClick={onNavigateToLanding}>
                  Return to Home
                </button>
              </div>
            </div>
          ) : step === 'role' ? (
            <div>
              <div className="auth-title-section">
                <div className="auth-badge-pill">
                  <span className="auth-badge-dot" />
                  Step 1 of 2 · Partner Onboarding
                </div>
                <h1 className="auth-title">How will you help save food?</h1>
                <p className="auth-subtitle">
                  Select your role in the {currentCity.name} rescue network. Every role is connected in real-time.
                </p>
              </div>

              {/* Role Grid */}
              <div className="role-grid-container">
                {roleOptions.map((opt) => {
                  const isSelected = selectedRole === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedRole(opt.id)}
                      className={`role-card-select ${isSelected ? 'is-active' : ''}`}
                    >
                      {isSelected && <CheckCircle2 size={18} className="role-selected-check" />}
                      <div className="role-icon-box">{opt.icon}</div>
                      <div>
                        <h2 className="role-card-title">{opt.label}</h2>
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">{opt.badge}</span>
                      </div>
                      <p className="role-card-desc">{opt.subtitle}</p>
                    </button>
                  )
                })}
              </div>

              {/* City selector preview */}
              <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="text-xs text-emerald-400/80 font-medium">Selected City Network</div>
                    <div className="text-sm font-semibold text-white">{currentCity.name}, {currentCity.state}</div>
                  </div>
                </div>
                <Select value={cityId} onValueChange={(val) => { if (val) setCityId(val) }}>
                  <SelectTrigger className="h-8 min-w-44 bg-black/60 border-emerald-500/30 rounded-lg px-2.5 text-xs text-emerald-300 font-medium">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-white hover:bg-neutral-800 focus:bg-neutral-800 focus:text-white">
                        {c.name} ({c.state})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => setStep('details')}
              >
                <span>Continue as {selectedRoleMeta.label}</span>
                <ArrowRight size={17} />
              </button>

              <div className="auth-footer-nav">
                Already registered with AaharSetu?
                <button type="button" className="auth-link-button" onClick={onNavigateToLogin}>
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="auth-title-section">
                <div className="auth-badge-pill">
                  <span className="auth-badge-dot" />
                  Step 2 of 2 · {selectedRoleMeta.label} Details
                </div>
                <h1 className="auth-title">Complete your profile</h1>
                <p className="auth-subtitle">
                  Registering for <strong>{currentCity.name}</strong> rescue network.
                </p>
              </div>

              {error && (
                <div className="auth-alert-box auth-alert-error">
                  <Info size={18} className="shrink-0 mt-0.5" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                    <span>{error}</span>
                    {error.includes('already exists') && (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--primary, #059669)',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          marginTop: '0.25rem',
                        }}
                        onClick={onNavigateToLogin}
                      >
                        Click here to Sign In now &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-form-row">
                  {/* Full Name */}
                  <div className="auth-input-group">
                    <label className="auth-label" htmlFor="reg-name">
                      Full Name
                    </label>
                    <div className="auth-input-wrapper">
                      <User size={16} className="auth-input-icon" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        maxLength={100}
                        placeholder="e.g. Priya Sharma"
                        className="auth-input-field"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="auth-input-group">
                    <label className="auth-label" htmlFor="reg-phone">
                      Contact Phone
                    </label>
                    <div className="auth-input-wrapper">
                      <Phone size={16} className="auth-input-icon" />
                      <input
                        id="reg-phone"
                        type="tel"
                        maxLength={20}
                        placeholder="+91 98765 43210"
                        className="auth-input-field"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Organization name (for Donor or Recipient) */}
                {(selectedRole === 'donor' || selectedRole === 'recipient') && (
                  <div className="auth-input-group">
                    <label className="auth-label" htmlFor="reg-org">
                      Organization / Establishment Name
                    </label>
                    <div className="auth-input-wrapper">
                      <Building2 size={16} className="auth-input-icon" />
                      <input
                        id="reg-org"
                        type="text"
                        maxLength={150}
                        placeholder={
                          selectedRole === 'donor'
                            ? 'e.g. Grand Heritage Hotel & Banquet'
                            : 'e.g. Asha Shelter & Children Home'
                        }
                        className="auth-input-field"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* FSSAI License (for Donor) */}
                {selectedRole === 'donor' && (
                  <div className="auth-input-group">
                    <label className="auth-label" htmlFor="reg-fssai">
                      <span>FSSAI License Number</span>
                      <span className="auth-label-hint">Optional for initial pilot</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <ShieldCheck size={16} className="auth-input-icon" />
                      <input
                        id="reg-fssai"
                        type="text"
                        maxLength={40}
                        placeholder="14-digit FSSAI number (e.g. 11223344556677)"
                        className="auth-input-field"
                        value={fssaiLicense}
                        onChange={(e) => setFssaiLicense(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Operating Area (for Driver or Recipient) */}
                {(selectedRole === 'driver' || selectedRole === 'recipient') && (
                  <div className="auth-input-group">
                    <label className="auth-label" htmlFor="reg-area">
                      <span>Locality / Operating Area</span>
                      <span className="auth-label-hint">Neighborhood in {currentCity.name}</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <MapPin size={16} className="auth-input-icon" />
                      <input
                        id="reg-area"
                        type="text"
                        maxLength={120}
                        placeholder={
                          selectedRole === 'driver'
                            ? 'e.g. Koramangala, Indiranagar, HSR Layout'
                            : 'e.g. Shivajinagar Community Center'
                        }
                        className="auth-input-field"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* City and Role Indicator */}
                <div className="auth-form-row">
                  <div className="auth-input-group">
                    <label className="auth-label" htmlFor="reg-city">
                      City
                    </label>
                    <Select value={cityId} onValueChange={(val) => { if (val) setCityId(val) }}>
                      <SelectTrigger id="reg-city" className="h-11 w-full bg-neutral-900/80 border-neutral-700/80 rounded-xl text-white px-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-emerald-400 shrink-0" />
                          <SelectValue placeholder="Select territory" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                        {cities.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-white hover:bg-neutral-800 focus:bg-neutral-800 focus:text-white">
                            {c.name} ({c.state})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-label">Selected Role</label>
                    <div className="auth-input-wrapper">
                      <div className="auth-input-icon">{selectedRoleMeta.icon}</div>
                      <input
                        type="text"
                        disabled
                        value={selectedRoleMeta.label}
                        className="auth-input-field opacity-80"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="reg-email">
                    Email Address
                  </label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@organization.org"
                      className="auth-input-field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="reg-password">
                    <span>Password</span>
                    <span className="auth-label-hint">Min 8 characters</span>
                  </label>
                  <div className="auth-input-wrapper">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
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

                {/* Safety Protocol Agreement */}
                <label className="flex items-start gap-2.5 text-xs text-emerald-200/80 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={agreedToSafety}
                    onChange={(e) => setAgreedToSafety(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-500/40 bg-black/40 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span>
                    I confirm adherence to IFSA fresh-food safety guidelines, safe handling temperature checks,
                    and non-distribution after the 2–6 hour safety countdown window.
                  </span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    className="auth-nav-link flex-1 justify-center py-3"
                    onClick={() => {
                      setStep('role')
                      setError(null)
                    }}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Roles</span>
                  </button>

                  <button
                    type="submit"
                    className="auth-submit-btn flex-1"
                    disabled={pending}
                  >
                    {pending ? (
                      <>
                        <LoaderCircle size={18} className="animate-spin" />
                        <span>Creating Account…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} />
                        <span>Register as Partner</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="auth-footer-nav">
                Already registered?
                <button type="button" className="auth-link-button" onClick={onNavigateToLogin}>
                  Sign in to your account
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
