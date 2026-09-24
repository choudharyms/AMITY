/**
 * DonorDashboard – role-specific home for authenticated donors.
 * Shows their own donation activity, quick-post CTA, and safety reminders.
 */
import { Plus, ShieldCheck, Boxes, CheckCheck, Clock, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isActive, number, remainingLabel, statusLabels, type Donation, type PilotData } from '@/src/types'
import type { AccountProfile } from '@/src/use-profile'

interface Props {
  data?: PilotData
  now: number
  profile: AccountProfile
  onPost: () => void
  onSelect: (d: Donation) => void
}

export function DonorDashboard({ data, now, profile, onPost, onSelect }: Props) {
  const myDonations = data?.donations ?? []
  const active = myDonations.filter(isActive)
  const delivered = myDonations.filter(d => d.status === 'delivered')

  return (
    <section className="donor-dashboard">
      {/* Welcome header */}
      <div className="dash-welcome panel">
        <div className="dash-welcome-text">
          <h2>Welcome back, {(profile?.display_name || 'Donor').split(' ')[0]}.</h2>
          <p>
            {active.length > 0
              ? `You have ${active.length} active donation${active.length > 1 ? 's' : ''} in the rescue pipeline.`
              : 'No active donations right now. Post one to start a rescue.'}
          </p>
          {profile.organization && (
            <p className="text-sm text-muted-foreground mt-1">{profile.organization}</p>
          )}
        </div>
        <Button size="lg" onClick={onPost}>
          <Plus data-icon="inline-start" />
          Post a donation
        </Button>
      </div>

      {/* Stats row */}
      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><Boxes size={20} /></span>
          <strong>{myDonations.length}</strong>
          <span>Total posted</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><CheckCheck size={20} /></span>
          <strong>{delivered.length}</strong>
          <span>Delivered</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><UtensilsCrossed size={20} /></span>
          <strong>{number(delivered.reduce((s, d) => s + d.qty_kg, 0))} kg</strong>
          <span>Total rescued</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><ShieldCheck size={20} /></span>
          <strong>{active.length}</strong>
          <span>In pipeline</span>
        </div>
      </div>

      {/* Active donations */}
      <div className="section-header-row">
        <h3>Active donations</h3>
        {active.length === 0 && <span className="text-sm text-muted-foreground">None right now</span>}
      </div>

      {active.length > 0 ? (
        <div className="donation-list">
          {active.map(d => {
            const urgent = new Date(d.safe_until).getTime() - now < 3600000
            return (
              <button key={d.id} className={`donation-row-card ${urgent ? 'urgent' : ''}`} onClick={() => onSelect(d)}>
                <span className="donation-row-icon"><UtensilsCrossed size={16} /></span>
                <div className="donation-row-info">
                  <strong>{d.item}</strong>
                  <span>{number(d.qty_kg)} kg · {statusLabels[d.status]}</span>
                </div>
                <div className="donation-row-right">
                  <Badge variant={urgent ? 'destructive' : 'secondary'}>
                    <Clock size={11} className="mr-1" />
                    {remainingLabel(d.safe_until, now)}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="empty-donor-hint panel">
          <ShieldCheck size={32} className="text-primary/40 mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs text-center">
            Post your first donation — AaharSetu will match it with the nearest verified recipient and assign a driver.
          </p>
        </div>
      )}

      {/* FSSAI notice if no license */}
      {!profile.fssai_license && (
        <div className="panel fssai-notice">
          <ShieldCheck size={16} className="text-amber-500" />
          <p className="text-sm">
            <strong>Add your FSSAI license</strong> in settings to receive a verified donor badge and gain priority matching.
          </p>
        </div>
      )}
    </section>
  )
}
