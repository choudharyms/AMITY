import { useState, type FormEvent } from 'react'
import { Leaf, LoaderCircle, Mail } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Authentication is not configured in this build. Add Supabase keys to .env.local and restart.'); return }
    const form = new FormData(event.currentTarget)
    setError(''); setPending(true)
    try {
      const credentials = { email: String(form.get('email')), password: String(form.get('password')) }
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({ ...credentials, options: {
          emailRedirectTo: import.meta.env.VITE_AUTH_REDIRECT || `${location.origin}/auth/callback`,
          data: { display_name: String(form.get('name') || '') },
        } })
      if (result.error) {
        const code = result.error.code
        if (code === 'email_not_confirmed') setError('Please confirm your email before signing in.')
        else if (result.error.status === 429 || code === 'over_email_send_rate_limit') setError('Too many attempts. Please wait before trying again.')
        else if (code === 'weak_password') setError('Choose a stronger password with at least 8 characters.')
        else if (code === 'invalid_credentials') setError('Invalid email or password.')
        else if (mode === 'signup' && ['user_already_exists', 'email_exists'].includes(code ?? '')) setSent(true)
        else setError('Authentication is temporarily unavailable. Please try again, or contact your coordinator.')
        return
      }
      if (mode === 'signup' && !result.data.session) setSent(true)
      else onOpenChange(false)
    } catch { setError('Could not reach authentication. Check your connection and try again.') }
    finally { setPending(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md p-7">
    <div className="brand-icon mb-1"><Leaf size={23} /></div>
    <DialogHeader><DialogTitle>{mode === 'login' ? 'Welcome back.' : 'Make room for more good.'}</DialogTitle><DialogDescription>{mode === 'login' ? 'Sign in to coordinate your next food rescue.' : 'Create your donor account. Coordinator access is granted separately.'}</DialogDescription></DialogHeader>
    {sent ? <Alert><Mail /><AlertTitle>Check your inbox</AlertTitle><AlertDescription>If this address is eligible, you will receive a confirmation link. Confirm your email before signing in.</AlertDescription></Alert> : <form onSubmit={submit}><FieldGroup className="gap-4">
      {mode === 'signup' && <Field><FieldLabel htmlFor="auth-name">Your name</FieldLabel><Input id="auth-name" name="name" autoComplete="name" required maxLength={100} /></Field>}
      <Field><FieldLabel htmlFor="auth-email">Email address</FieldLabel><Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@organization.org" required /></Field>
      <Field><FieldLabel htmlFor="auth-password">Password</FieldLabel><Input id="auth-password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required /></Field>
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>{pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
    </FieldGroup></form>}
    <p className="text-center text-sm text-muted-foreground">{mode === 'login' ? 'New to the network?' : 'Already have an account?'} <button className="text-primary font-medium underline underline-offset-4" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSent(false) }}>{mode === 'login' ? 'Join us' : 'Sign in'}</button></p>
  </DialogContent></Dialog>
}
