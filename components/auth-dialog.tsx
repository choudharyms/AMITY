import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Bike, Building2, HeartHandshake, Leaf, LoaderCircle, Mail, ShieldCheck, UtensilsCrossed } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cities } from '@/src/cities'

type Role = 'donor' | 'driver' | 'recipient'
type AuthMode = 'login' | 'signup'
type SignupStep = 'role' | 'details'

const roleOptions: { id: Role; label: string; subtitle: string; icon: React.ReactNode }[] = [
  { id: 'donor', label: 'Food Donor', subtitle: 'Restaurant, caterer, or event venue with surplus food', icon: <UtensilsCrossed size={26} /> },
  { id: 'driver', label: 'Volunteer Driver', subtitle: 'Deliver food from donors to shelters in your city', icon: <Bike size={26} /> },
  { id: 'recipient', label: 'Recipient / Shelter', subtitle: 'NGO, shelter, or community kitchen that receives food', icon: <HeartHandshake size={26} /> },
]

export function AuthDialog({ open, onOpenChange, cityId = 'blr' }: { open: boolean; onOpenChange: (open: boolean) => void; cityId?: string }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [step, setStep] = useState<SignupStep>('role')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [requestedRole, setRequestedRole] = useState<Role>('donor')

  function reset() {
    setError('')
    setSent(false)
    setStep('role')
  }

  function switchMode(m: AuthMode) {
    setMode(m)
    reset()
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Authentication is not configured. Add Supabase keys to .env.local and restart.'); return }
    const form = new FormData(event.currentTarget)
    setError(''); setPending(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: String(form.get('email')),
        password: String(form.get('password')),
      })
      if (authError) {
        const code = authError.code
        if (code === 'email_not_confirmed') setError('Please confirm your email before signing in.')
        else if (authError.status === 429 || code === 'over_email_send_rate_limit') setError('Too many attempts. Please wait before trying again.')
        else if (code === 'invalid_credentials') setError('Invalid email or password. Double-check and try again.')
        else setError('Authentication is temporarily unavailable. Please try again.')
        return
      }
      onOpenChange(false)
    } catch { setError('Could not reach authentication service. Check your connection.') }
    finally { setPending(false) }
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Authentication is not configured. Add Supabase keys to .env.local and restart.'); return }
    const form = new FormData(event.currentTarget)
    setError(''); setPending(true)
    try {
      const metadata: Record<string, string> = {
        display_name: String(form.get('name') || '').trim(),
        city_id: cityId,
        role: requestedRole,
        requested_role: requestedRole,
      }
      if (form.get('organization')) metadata.organization = String(form.get('organization')).trim()
      if (form.get('phone')) metadata.phone = String(form.get('phone')).trim()
      if (requestedRole === 'donor' && form.get('fssai_license')) {
        metadata.fssai_license = String(form.get('fssai_license')).trim()
      }
      if ((requestedRole === 'driver' || requestedRole === 'recipient') && form.get('area')) {
        metadata.area = String(form.get('area')).trim()
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: String(form.get('email')),
        password: String(form.get('password')),
        options: {
          emailRedirectTo: import.meta.env.VITE_AUTH_REDIRECT || `${location.origin}/auth/callback`,
          data: metadata,
        },
      })
      if (authError) {
        const code = authError.code
        if (authError.status === 429 || code === 'over_email_send_rate_limit') setError('Too many attempts. Please wait before trying again.')
        else if (code === 'weak_password') setError('Choose a stronger password with at least 8 characters.')
        else if (['user_already_exists', 'email_exists'].includes(code ?? '')) setSent(true)
        else setError('Could not create account. Please try again or contact your coordinator.')
        return
      }
      if (!data.session) setSent(true)
      else onOpenChange(false)
    } catch { setError('Could not reach authentication service. Check your connection.') }
    finally { setPending(false) }
  }

  const cityName = cities.find(c => c.id === cityId)?.name ?? 'your city'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md p-7">
        <div className="brand-icon mb-1"><Leaf size={23} /></div>

        {mode === 'login' ? (
          <>
            <DialogHeader>
              <DialogTitle>Welcome back.</DialogTitle>
              <DialogDescription>Sign in to coordinate your next food rescue in {cityName}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitLogin}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="auth-email">Email address</FieldLabel>
                  <Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@organization.org" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="auth-password">Password</FieldLabel>
                  <Input id="auth-password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required />
                </Field>
                {error && <FieldError>{error}</FieldError>}
                <Button type="submit" size="lg" disabled={pending}>
                  {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
                  Sign in
                </Button>
              </FieldGroup>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              New to the network?{' '}
              <button className="text-primary font-medium underline underline-offset-4" onClick={() => switchMode('signup')}>Join us</button>
            </p>
          </>
        ) : sent ? (
          <Alert>
            <Mail />
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>If this address is eligible, you will receive a confirmation link. Confirm your email before signing in. Your coordinator will verify your role.</AlertDescription>
          </Alert>
        ) : step === 'role' ? (
          <>
            <DialogHeader>
              <DialogTitle>How will you help?</DialogTitle>
              <DialogDescription>Choose your role in the {cityName} food rescue network. Access is granted after verification.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 my-1">
              {roleOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRequestedRole(opt.id)}
                  className={`role-option-btn ${requestedRole === opt.id ? 'selected' : ''}`}
                >
                  <span className="role-option-icon">{opt.icon}</span>
                  <span className="role-option-text">
                    <strong>{opt.label}</strong>
                    <small>{opt.subtitle}</small>
                  </span>
                  {requestedRole === opt.id && <ShieldCheck size={18} className="text-primary shrink-0" />}
                </button>
              ))}
            </div>
            <Button size="lg" onClick={() => setStep('details')}>
              Continue as {roleOptions.find(o => o.id === requestedRole)?.label}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button className="text-primary font-medium underline underline-offset-4" onClick={() => switchMode('login')}>Sign in</button>
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create your account</DialogTitle>
              <DialogDescription>Fill in your details to register as a <strong>{roleOptions.find(o => o.id === requestedRole)?.label}</strong> in {cityName}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitSignup}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="su-name">Your full name</FieldLabel>
                  <Input id="su-name" name="name" autoComplete="name" required maxLength={100} placeholder="Priya Sharma" />
                </Field>

                {(requestedRole === 'donor' || requestedRole === 'recipient') && (
                  <Field>
                    <FieldLabel htmlFor="su-org">Organization name</FieldLabel>
                    <Input id="su-org" name="organization" maxLength={160} placeholder={requestedRole === 'donor' ? 'e.g. Saravana Bhavan, Brigade Road' : 'e.g. Asha Kiran Shelter'} />
                  </Field>
                )}

                {requestedRole === 'donor' && (
                  <Field>
                    <FieldLabel htmlFor="su-fssai">FSSAI License number</FieldLabel>
                    <Input id="su-fssai" name="fssai_license" maxLength={40} placeholder="12345678000000" />
                    <FieldDescription>Required for verified donor badge. You can add this later in settings.</FieldDescription>
                  </Field>
                )}

                {(requestedRole === 'driver' || requestedRole === 'recipient') && (
                  <Field>
                    <FieldLabel htmlFor="su-area">Operating area / locality</FieldLabel>
                    <Input id="su-area" name="area" maxLength={160} placeholder={requestedRole === 'driver' ? 'e.g. Indiranagar, Koramangala' : 'e.g. Shivajinagar'} />
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="su-phone">Contact phone</FieldLabel>
                  <Input id="su-phone" name="phone" type="tel" maxLength={20} placeholder="+91 98765 43210" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="su-city">City</FieldLabel>
                    <select id="su-city" value={cityId} disabled className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
                      {cities.filter(c => c.id === cityId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="su-role">Role</FieldLabel>
                    <select id="su-role" value={requestedRole} disabled className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm capitalize">
                      <option value={requestedRole}>{roleOptions.find(o => o.id === requestedRole)?.label}</option>
                    </select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="su-email">Email address</FieldLabel>
                  <Input id="su-email" name="email" type="email" autoComplete="email" placeholder="you@organization.org" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="su-password">Password</FieldLabel>
                  <Input id="su-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                  <FieldDescription>At least 8 characters.</FieldDescription>
                </Field>

                {error && <FieldError>{error}</FieldError>}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => { setStep('role'); setError('') }}>
                    <ArrowLeft data-icon="inline-start" />
                    Back
                  </Button>
                  <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                    {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
                    Create account
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
