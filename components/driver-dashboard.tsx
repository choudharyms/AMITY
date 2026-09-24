/**
 * DriverDashboard – role-specific home for volunteer drivers.
 * Shows assigned pickups, their availability status, and quick actions.
 */
import { useState } from 'react'
import { Bike, CheckCheck, Clock, MapPin, Navigation, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { number, remainingLabel, statusLabels, type Donation, type Driver, type PilotData } from '@/src/types'
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

export function DriverDashboard({ data, now, profile, cityId, onSelect, refresh }: Props) {
  const [toggling, setToggling] = useState(false)

  // Find the driver profile linked to this user in the pilot data
  // In production, the driver profile would be linked via user_id
  const myDriver: Driver | undefined = data?.drivers[0] // fallback to first driver for demo

  const assignedDonations = data?.donations.filter(d =>
    d.driver_id === myDriver?.id && ['matched', 'accepted', 'picked_up'].includes(d.status)
  ) ?? []

  const deliveredToday = data?.donations.filter(d =>
    d.driver_id === myDriver?.id && d.status === 'delivered' &&
    new Date(d.created_at).toDateString() === new Date().toDateString()
  ) ?? []

  async function toggleAvailability() {
    if (!myDriver) return
    setToggling(true)
    try {
      await apiRequest('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ availability_override: !myDriver.availability }),
      })
      refresh()
      toast.success(myDriver.availability ? 'Marked as unavailable.' : 'You are now available for rescue missions!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update availability.')
    } finally {
      setToggling(false)
    }
  }

  async function confirmPickup(donationId: string) {
    try {
      await apiRequest(`/api/donations/${encodeURIComponent(donationId)}/pickup?city_id=${cityId}`, { method: 'POST', body: '{}' })
      refresh()
      toast.success('Pickup confirmed! Head to the recipient.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not confirm pickup.')
    }
  }

  return (
    <section className="driver-dashboard">
      {/* Welcome & availability toggle */}
      <div className="dash-welcome panel">
        <div className="dash-welcome-text">
          <h2>Ready to rescue, {profile.display_name.split(' ')[0]}?</h2>
          <p>
            {myDriver
              ? `${myDriver.vehicle} · up to ${number(myDriver.capacity_kg)} kg · ${myDriver.availability ? 'Available' : 'Unavailable'}`
              : 'Your driver profile will appear here once the coordinator registers you.'}
          </p>
          {profile.area && <p className="text-sm text-muted-foreground mt-1"><MapPin size={12} className="inline mr-1" />{profile.area}</p>}
        </div>
        {myDriver && (
          <Button
            variant={myDriver.availability ? 'outline' : 'default'}
            size="lg"
            onClick={toggleAvailability}
            disabled={toggling}
          >
            {myDriver.availability
              ? <><ToggleRight data-icon="inline-start" />Available</>
              : <><ToggleLeft data-icon="inline-start" />Unavailable</>
            }
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><Bike size={20} /></span>
          <strong>{assignedDonations.length}</strong>
          <span>Assigned now</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><CheckCheck size={20} /></span>
          <strong>{deliveredToday.length}</strong>
          <span>Delivered today</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><ShieldCheck size={20} /></span>
          <strong>{myDriver?.availability ? 'Yes' : 'No'}</strong>
          <span>Available</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-icon"><Navigation size={20} /></span>
          <strong>{myDriver ? `${number(myDriver.capacity_kg)} kg` : '—'}</strong>
          <span>Capacity</span>
        </div>
      </div>

      {/* Assigned pickups */}
      <div className="section-header-row">
        <h3>Your assigned rescues</h3>
      </div>

      {assignedDonations.length > 0 ? (
        <div className="donation-list">
          {assignedDonations.map(d => {
            const urgent = new Date(d.safe_until).getTime() - now < 3600000
            const canPickup = d.status === 'matched' || d.status === 'accepted'
            return (
              <div key={d.id} className={`donation-row-card driver-card ${urgent ? 'urgent' : ''}`}>
                <span className="donation-row-icon"><Bike size={16} /></span>
                <div className="donation-row-info" onClick={() => onSelect(d)} style={{ cursor: 'pointer' }}>
                  <strong>{d.item}</strong>
                  <span>{number(d.qty_kg)} kg · {statusLabels[d.status]}</span>
                </div>
                <div className="donation-row-right gap-2">
                  <Badge variant={urgent ? 'destructive' : 'secondary'}>
                    <Clock size={11} className="mr-1" />
                    {remainingLabel(d.safe_until, now)}
                  </Badge>
                  {canPickup && (
                    <Button size="sm" onClick={() => confirmPickup(d.id)}>
                      Confirm pickup
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-donor-hint panel">
          <Bike size={32} className="text-primary/40 mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs text-center">
            {myDriver?.availability
              ? 'No pickups assigned yet. Coordinators will assign a rescue when one matches your route and capacity.'
              : 'You are currently marked unavailable. Toggle your availability above to receive assignments.'}
          </p>
        </div>
      )}
    </section>
  )
}
