/**
 * RecipientDashboard – role-specific home for recipient organisations / shelters.
 * Shows incoming matched food, capacity status, and delivery confirmation.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCheck, Clock, HeartHandshake, MapPin, PackageCheck, ShieldCheck, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { categoryLabels, number, parseAccepts, remainingLabel, statusLabels, type Donation, type PilotData } from '@/src/types'
import { apiRequest } from '@/src/api'
import type { AccountProfile } from '@/src/use-profile'

interface Props {
  data?: PilotData
  now: number
  profile: AccountProfile
  cityId: string
  onSelect: (d: Donation) => void
  refresh: () => void
}

export function RecipientDashboard({ data, now, profile, cityId, onSelect, refresh }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null)

  // Find the recipient org linked to this user
  const myRecipient = data?.recipients[0] // demo fallback

  const incomingDonations = data?.donations.filter(d =>
    d.recipient_id === myRecipient?.id && ['matched', 'accepted', 'picked_up'].includes(d.status)
  ) ?? []

  const receivedToday = data?.donations.filter(d =>
    d.recipient_id === myRecipient?.id && d.status === 'delivered' &&
    new Date(d.created_at).toDateString() === new Date().toDateString()
  ) ?? []

  async function confirmDelivery(donationId: string) {
    setConfirming(donationId)
    try {
      await apiRequest(`/api/donations/${encodeURIComponent(donationId)}/deliver?city_id=${cityId}`, { method: 'POST', body: '{}' })
      refresh()
      toast.success('Delivery confirmed! Thank you for feeding the community.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not confirm delivery.')
    } finally {
      setConfirming(null)
    }
  }

  const capacityUsed = myRecipient ? (myRecipient.reserved_kg / myRecipient.capacity_kg) * 100 : 0

  return (
    <section className="recipient-dashboard">
      {/* Welcome header */}
      <div className="dash-welcome panel">
        <div className="dash-welcome-text">
          <h2>Good day, {(profile?.display_name || 'Member').split(' ')[0]}.</h2>
          <p>
            {incomingDonations.length > 0
              ? `${incomingDonations.length} incoming rescue${incomingDonations.length > 1 ? 's' : ''} on the way.`
              : 'No incoming deliveries right now.'}
          </p>
          {profile.organization && <p className="text-sm text-muted-foreground mt-1">{profile.organization}</p>}
          {profile.area && <p className="text-sm text-muted-foreground"><MapPin size={12} className="inline mr-1" />{profile.area}</p>}
        </div>
        {myRecipient && (
          <div className="capacity-badge-stack">
            <Badge variant={myRecipient.is_open ? 'secondary' : 'outline'}>
              {myRecipient.is_open ? 'Open' : 'Closed'}
            </Badge>
            <Badge variant={myRecipient.approved ? 'secondary' : 'outline'}>
              {myRecipient.approved ? 'Approved' : 'Pending review'}
            </Badge>
          </div>
        )}
      </div>

      {/* Capacity gauge */}
      {myRecipient && (
        <div className="panel capacity-panel">
          <div className="capacity-header">
            <span className="flex items-center gap-2 font-semibold">
              <PackageCheck size={17} />Capacity status
            </span>
            <span className="text-sm text-muted-foreground">
              {number(Math.max(0, myRecipient.capacity_kg - myRecipient.reserved_kg))} kg available of {number(myRecipient.capacity_kg)} kg
            </span>
          </div>
          <progress className="capacity-progress large" value={myRecipient.reserved_kg} max={myRecipient.capacity_kg}
            aria-label="Capacity used" />
          <div className="capacity-accepts">
            {parseAccepts(myRecipient.accepts).map(c => <Badge key={c} variant="outline" className="text-xs">{categoryLabels[c] || c}</Badge>)}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><Utensils size={20} /></span>
          <strong>{incomingDonations.length}</strong>
          <span>Incoming now</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><CheckCheck size={20} /></span>
          <strong>{receivedToday.length}</strong>
          <span>Received today</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><HeartHandshake size={20} /></span>
          <strong>{number(receivedToday.reduce((s, d) => s + d.qty_kg, 0))} kg</strong>
          <span>Kg received today</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><ShieldCheck size={20} /></span>
          <strong>{Math.round(capacityUsed)}%</strong>
          <span>Capacity used</span>
        </div>
      </div>

      {/* Incoming donations */}
      <div className="section-header-row">
        <h3>Incoming food rescues</h3>
      </div>

      {incomingDonations.length > 0 ? (
        <div className="donation-list">
          {incomingDonations.map(d => {
            const urgent = new Date(d.safe_until).getTime() - now < 3600000
            const canDeliver = d.status === 'picked_up'
            return (
              <div key={d.id} className={`donation-row-card recipient-card ${urgent ? 'urgent' : ''}`}>
                <span className="donation-row-icon"><Utensils size={16} /></span>
                <div className="donation-row-info" onClick={() => onSelect(d)} style={{ cursor: 'pointer' }}>
                  <strong>{d.item}</strong>
                  <span>{number(d.qty_kg)} kg · {statusLabels[d.status]}</span>
                </div>
                <div className="donation-row-right gap-2">
                  <Badge variant={urgent ? 'destructive' : 'secondary'}>
                    <Clock size={11} className="mr-1" />
                    {remainingLabel(d.safe_until, now)}
                  </Badge>
                  {canDeliver && (
                    <Button size="sm" onClick={() => confirmDelivery(d.id)} disabled={confirming === d.id}>
                      {confirming === d.id ? 'Confirming…' : 'Confirm receipt'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-donor-hint panel">
          <HeartHandshake size={32} className="text-primary/40 mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs text-center">
            {myRecipient?.approved
              ? 'No incoming deliveries right now. Coordinators will match donations to your organisation as they arrive.'
              : 'Your organisation is pending coordinator approval. You will receive food once approved.'}
          </p>
        </div>
      )}
    </section>
  )
}
