/**
 * DriverDashboard – role-specific home for volunteer drivers.
 * Shows assigned pickups, available missions to claim, availability status, and quick actions.
 */
import { useState } from 'react'
import {
  Bike,
  CheckCheck,
  Clock,
  MapPin,
  Navigation,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  QrCode,
  Sparkles,
  Route,
  ArrowRight,
  PlusCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { number, remainingLabel, statusLabels, type Donation, type Driver, type PilotData } from '@/src/types'
import { apiRequest } from '@/src/api'
import type { AccountProfile } from '@/src/use-profile'
import { HandoverDialog } from '@/components/handover-dialog'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

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
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [handoverDonation, setHandoverDonation] = useState<Donation | null>(null)

  // Find the driver profile accurately linked to this user in the pilot data
  const myDriver: Driver | undefined = data?.drivers.find(d =>
    (d.user_id && profile?.user_id && d.user_id === profile.user_id) ||
    (profile?.display_name && d.name.toLowerCase() === profile.display_name.toLowerCase())
  ) ?? data?.drivers.find(d => d.city_id === cityId) ?? data?.drivers[0]

  // Donations currently assigned to this driver in active stages
  const assignedDonations = data?.donations.filter(d =>
    (d.driver_id === myDriver?.id || (myDriver?.user_id && d.driver_id === myDriver.user_id)) &&
    ['matched', 'accepted', 'picked_up'].includes(d.status)
  ) ?? []

  // Total deliveries completed by this driver
  const deliveredDonations = data?.donations.filter(d =>
    (d.driver_id === myDriver?.id || (myDriver?.user_id && d.driver_id === myDriver.user_id)) &&
    d.status === 'delivered'
  ) ?? []

  // Available surplus food rescues in this city waiting for a volunteer courier
  const availableCityMissions = data?.donations.filter(d =>
    ['posted', 'matched'].includes(d.status) &&
    d.driver_id !== myDriver?.id
  ) ?? []

  const activeKg = assignedDonations.reduce((acc, d) => acc + (d.qty_kg || 0), 0)
  const capacityKg = myDriver?.capacity_kg || 30
  const freeKg = Math.max(0, capacityKg - activeKg)

  async function toggleAvailability() {
    if (!myDriver) return
    setToggling(true)
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('drivers')
          .update({ availability: !myDriver.availability })
          .eq('id', myDriver.id)
      } else {
        await apiRequest('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({ availability_override: !myDriver.availability }),
        })
      }
      refresh()
      toast.success(myDriver.availability ? 'Marked as offline / unavailable.' : 'You are now online and ready for rescue missions!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update availability.')
    } finally {
      setToggling(false)
    }
  }

  async function handleClaimMission(donation: Donation) {
    if (!myDriver) {
      toast.error('Driver profile not registered in this city.')
      return
    }
    setClaimingId(donation.id)
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: updateErr } = await supabase
          .from('donations')
          .update({
            driver_id: myDriver.id,
            status: 'accepted',
          })
          .eq('id', donation.id)

        if (updateErr) throw updateErr

        // Log live dispatch event
        await supabase.from('dispatch_events').insert({
          id: 'evt_' + Math.random().toString(36).slice(2, 9),
          donation_id: donation.id,
          driver_id: myDriver.id,
          event_type: 'accepted',
          message: `${myDriver.name} claimed rescue mission for ${donation.item}.`,
          city_id: cityId,
          created_at: new Date().toISOString(),
        })
      }
      refresh()
      toast.success(`Rescue mission accepted! Head to pickup location for ${donation.item}.`)
    } catch (err: any) {
      toast.error(err?.message || 'Could not claim rescue mission.')
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <section className="driver-dashboard space-y-6">
      {/* Welcome & availability toggle */}
      <div className="dash-welcome panel p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="dash-welcome-text space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Ready to rescue, {(profile?.display_name || 'Driver').split(' ')[0]}?
            </h2>
            <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10">
              Verified Volunteer
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {myDriver
              ? `${myDriver.vehicle} · up to ${number(myDriver.capacity_kg)} kg payload · ${myDriver.availability ? 'Online & Available' : 'Offline'}`
              : 'Volunteer courier profile ready for municipal dispatch.'}
          </p>
          {profile.area && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
              <MapPin size={12} className="text-primary" />
              <span>Operating Zone: {profile.area}</span>
            </p>
          )}
        </div>

        {myDriver && (
          <Button
            variant={myDriver.availability ? 'default' : 'outline'}
            size="sm"
            onClick={toggleAvailability}
            disabled={toggling}
            className="shrink-0 font-medium"
          >
            {myDriver.availability ? (
              <>
                <ToggleRight className="mr-1.5 text-emerald-300" size={16} /> Online (Available)
              </>
            ) : (
              <>
                <ToggleLeft className="mr-1.5 text-muted-foreground" size={16} /> Offline (Unavailable)
              </>
            )}
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="dash-stats-row grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="dash-stat-card panel p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Assigned Now</span>
            <Bike size={18} className="text-primary" />
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold font-mono text-foreground">{assignedDonations.length}</strong>
            <span className="text-[11px] text-muted-foreground block">Active rescue leg{assignedDonations.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="dash-stat-card panel p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Delivered</span>
            <CheckCheck size={18} className="text-emerald-500" />
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {deliveredDonations.length}
            </strong>
            <span className="text-[11px] text-muted-foreground block">Missions completed</span>
          </div>
        </div>

        <div className="dash-stat-card panel p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Status</span>
            <ShieldCheck size={18} className={myDriver?.availability ? 'text-emerald-500' : 'text-amber-500'} />
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold text-foreground">
              {myDriver?.availability ? 'Active' : 'Standby'}
            </strong>
            <span className="text-[11px] text-muted-foreground block">
              {myDriver?.availability ? 'Receiving city dispatches' : 'Turn online to receive'}
            </span>
          </div>
        </div>

        <div className="dash-stat-card panel p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Vehicle Payload</span>
            <Navigation size={18} className="text-primary" />
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold font-mono text-foreground">
              {freeKg} <span className="text-xs font-normal text-muted-foreground">/ {capacityKg} kg free</span>
            </strong>
            <span className="text-[11px] text-muted-foreground block">{myDriver?.vehicle || 'Two-Wheeler'} payload</span>
          </div>
        </div>
      </div>

      {/* Assigned rescues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Bike size={18} className="text-primary" />
            Your Assigned Rescues ({assignedDonations.length})
          </h3>
          {assignedDonations.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeKg} kg active committed
            </Badge>
          )}
        </div>

        {assignedDonations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assignedDonations.map(d => {
              const urgent = new Date(d.safe_until).getTime() - now < 3600000
              const canPickup = d.status === 'matched' || d.status === 'accepted'
              const canDeliver = d.status === 'picked_up'

              return (
                <div
                  key={d.id}
                  className={`p-4 rounded-2xl border bg-card flex flex-col justify-between shadow-xs transition-all ${
                    urgent ? 'border-amber-500/50 bg-amber-500/5' : 'border-border/80 hover:border-primary/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-primary/10 text-primary">
                          <Bike size={16} />
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground line-clamp-1">{d.item}</h4>
                          <span className="text-xs text-muted-foreground">{number(d.qty_kg)} kg · {statusLabels[d.status]}</span>
                        </div>
                      </div>
                      <Badge variant={urgent ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                        <Clock size={11} className="mr-1" />
                        {remainingLabel(d.safe_until, now)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(d)}
                      className="text-xs h-8"
                    >
                      Inspect Route
                    </Button>

                    {canPickup && (
                      <Button
                        size="sm"
                        onClick={() => setHandoverDonation(d)}
                        className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                      >
                        <QrCode size={13} />
                        Verify Pickup
                      </Button>
                    )}

                    {canDeliver && (
                      <Button
                        size="sm"
                        onClick={() => setHandoverDonation(d)}
                        className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <CheckCheck size={13} />
                        Confirm Delivery
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-donor-hint panel p-6 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <Bike size={24} />
            </div>
            <h4 className="font-semibold text-sm text-foreground">No pickups actively in transit</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {myDriver?.availability
                ? 'You are active and online! Check the available rescues below to claim a mission, or wait for automated dispatch.'
                : 'You are currently marked offline. Toggle your availability above to appear on the coordinator dispatch board.'}
            </p>
          </div>
        )}
      </div>

      {/* Available Missions in City to Claim */}
      {availableCityMissions.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                Available Rescues Waiting for Volunteer ({availableCityMissions.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Surplus food posted in {cityId.toUpperCase()} requiring prompt pickup before safe window closes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableCityMissions.map(donation => {
              const isClaiming = claimingId === donation.id
              const urgent = new Date(donation.safe_until).getTime() - now < 3600000

              return (
                <div
                  key={donation.id}
                  className="p-4 rounded-2xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground line-clamp-1">{donation.item}</h4>
                        <span className="text-xs text-muted-foreground font-mono">
                          {donation.qty_kg} kg · {donation.category.replace('_', ' ')}
                        </span>
                      </div>
                      <Badge variant={urgent ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                        <Clock size={11} className="mr-1" />
                        {remainingLabel(donation.safe_until, now)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Status: <strong className="text-foreground">{statusLabels[donation.status]}</strong>
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleClaimMission(donation)}
                      disabled={isClaiming || !myDriver?.availability}
                      className="h-8 text-xs font-medium gap-1.5"
                    >
                      <PlusCircle size={13} />
                      {isClaiming ? 'Claiming…' : 'Claim Rescue Mission'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {handoverDonation && (
        <HandoverDialog
          donation={handoverDonation}
          stage={handoverDonation.status === 'picked_up' ? 'delivery' : 'pickup'}
          cityId={cityId}
          data={data}
          onClose={() => setHandoverDonation(null)}
          onSuccess={() => {
            setHandoverDonation(null)
            refresh()
          }}
        />
      )}
    </section>
  )
}

