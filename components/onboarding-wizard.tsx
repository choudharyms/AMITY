/**
 * OnboardingWizard – shown to newly authenticated users who have an incomplete profile.
 * Guides them to fill in role-specific required fields before accessing the dashboard.
 */
import { useState, type FormEvent } from 'react'
import { Bike, CheckCircle2, HeartHandshake, Leaf, LoaderCircle, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/src/api'
import type { AccountProfile } from '@/src/use-profile'

interface Props {
  profile: AccountProfile
  onComplete: () => void
}

const roleIcons: Record<AccountProfile['role'], React.ReactNode> = {
  coordinator: <Leaf size={30} />,
  donor: <UtensilsCrossed size={30} />,
  driver: <Bike size={30} />,
  recipient: <HeartHandshake size={30} />,
  shelter: <HeartHandshake size={30} />,
}

const roleTitles: Record<AccountProfile['role'], string> = {
  coordinator: 'Network Coordinator',
  donor: 'Food Donor',
  driver: 'Volunteer Driver',
  recipient: 'Recipient Organisation',
  shelter: 'Shelter',
}

export function OnboardingWizard({ profile, onComplete }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const updates: Record<string, string> = {}
    const displayName = String(form.get('display_name') || '').trim()
    if (displayName) updates.display_name = displayName
    const org = String(form.get('organization') || '').trim()
    if (org) updates.organization = org
    const phone = String(form.get('phone') || '').trim()
    if (phone) updates.phone = phone
    const area = String(form.get('area') || '').trim()
    if (area) updates.area = area
    const fssai = String(form.get('fssai_license') || '').trim()
    if (fssai) updates.fssai_license = fssai

    if (!displayName) { setError('Please enter your name to continue.'); return }

    setPending(true)
    setError('')
    try {
      await apiRequest('/api/me', { method: 'PATCH', body: JSON.stringify(updates) })
      toast.success('Profile saved! Welcome to AaharSetu.')
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setPending(false)
    }
  }

  const isDriver = profile.role === 'driver'
  const isDonor = profile.role === 'donor'
  const isRecipient = profile.role === 'recipient' || profile.role === 'shelter'

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-header">
          <div className="brand-icon" style={{ width: 52, height: 52, fontSize: 22 }}>
            {roleIcons[profile.role]}
          </div>
          <div>
            <h1 className="text-xl font-bold">Complete your profile</h1>
            <p className="text-muted-foreground text-sm">
              You are registered as a <strong>{roleTitles[profile.role]}</strong>. Fill in a few details to get started.
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="onboarding-steps">
          <div className="step done"><CheckCircle2 size={14} />Account created</div>
          <div className="step active"><span>2</span>Complete profile</div>
          <div className="step"><span>3</span>Start rescuing</div>
        </div>

        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="ob-name">Full name *</FieldLabel>
              <Input
                id="ob-name" name="display_name"
                defaultValue={profile.display_name === 'AaharSetu member' ? '' : profile.display_name}
                required maxLength={100} placeholder="e.g. Priya Sharma"
              />
            </Field>

            {(isDonor || isRecipient) && (
              <Field>
                <FieldLabel htmlFor="ob-org">Organisation name</FieldLabel>
                <Input id="ob-org" name="organization" defaultValue={profile.organization ?? ''} maxLength={160}
                  placeholder={isDonor ? 'e.g. Saravana Bhavan, Brigade Road' : 'e.g. Asha Kiran NGO'} />
              </Field>
            )}

            {isDonor && (
              <Field>
                <FieldLabel htmlFor="ob-fssai">FSSAI License number</FieldLabel>
                <Input id="ob-fssai" name="fssai_license" defaultValue={profile.fssai_license ?? ''} maxLength={40}
                  placeholder="14-digit FSSAI number" />
                <FieldDescription>Adds a verified badge to your donations. Required for high-priority matching.</FieldDescription>
              </Field>
            )}

            {(isDriver || isRecipient) && (
              <Field>
                <FieldLabel htmlFor="ob-area">Operating area / locality</FieldLabel>
                <Input id="ob-area" name="area" defaultValue={profile.area ?? ''} maxLength={160}
                  placeholder={isDriver ? 'e.g. Indiranagar, Koramangala' : 'e.g. Shivajinagar'} />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="ob-phone">Contact phone</FieldLabel>
              <Input id="ob-phone" name="phone" type="tel" defaultValue={profile.phone ?? ''} maxLength={20}
                placeholder="+91 98765 43210" />
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <div className="onboarding-actions">
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
                Save & enter dashboard
              </Button>
              <button type="button" className="skip-link text-sm text-muted-foreground mt-2" onClick={onComplete}>
                Skip for now
              </button>
            </div>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
