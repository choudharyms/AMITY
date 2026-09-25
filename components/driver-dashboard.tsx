/**
 * DriverDashboard – role-specific home for volunteer drivers.
 * Shows assigned pickups, available missions to claim, availability status, and quick actions.
 */
import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
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
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Compass,
  Maximize2,
  Minimize2,
  Building2,
  UtensilsCrossed,
  LoaderCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { number, remainingLabel, statusLabels, type Donation, type Driver, type PilotData } from '@/src/types'
import { apiRequest } from '@/src/api'
import type { AccountProfile } from '@/src/use-profile'
import { HandoverDialog } from '@/components/handover-dialog'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { cities } from '@/src/cities'

const RescueMap = lazy(() => import('@/components/rescue-map').then(m => ({ default: m.RescueMap })))

function MapSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[380px] bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 text-center text-muted-foreground animate-pulse">
      <LoaderCircle className="animate-spin mb-3 text-primary" size={28} />
      <span className="text-sm font-semibold text-foreground">Loading rescue corridor map…</span>
      <span className="text-xs text-muted-foreground/75 mt-1">Connecting to geospatial telemetry</span>
    </div>
  )
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c * 1.25).toFixed(1))
}

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
  const [optimisticAvailability, setOptimisticAvailability] = useState<boolean | null>(null)
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [expandedMap, setExpandedMap] = useState(false)
  const [showExploreMap, setShowExploreMap] = useState(false)

  // Find the driver profile accurately linked to this user in the pilot data
  const myDriver: Driver | undefined = data?.drivers.find(d =>
    (d.user_id && profile?.user_id && d.user_id === profile.user_id) ||
    (profile?.display_name && d.name.trim().toLowerCase() === profile.display_name.trim().toLowerCase())
  ) ?? data?.drivers.find(d => d.city_id === cityId) ?? data?.drivers[0]

  // Clear optimistic override once underlying data catches up
  useEffect(() => {
    if (myDriver && optimisticAvailability !== null && myDriver.availability === optimisticAvailability) {
      setOptimisticAvailability(null)
    }
  }, [myDriver?.availability, optimisticAvailability])

  const effectiveAvailability = optimisticAvailability !== null
    ? optimisticAvailability
    : (myDriver?.availability ?? true)

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

  // Automatically select the active route mission (or user selected one)
  const activeMission = useMemo(() => {
    if (selectedMissionId) {
      const found = assignedDonations.find(d => d.id === selectedMissionId)
      if (found) return found
    }
    // Priority: 'picked_up' (currently in transit) first, then earliest safe_until
    return [...assignedDonations].sort((a, b) => {
      if (a.status === 'picked_up' && b.status !== 'picked_up') return -1
      if (b.status === 'picked_up' && a.status !== 'picked_up') return 1
      return new Date(a.safe_until).getTime() - new Date(b.safe_until).getTime()
    })[0] || null
  }, [assignedDonations, selectedMissionId])

  const cityCoords = useMemo(() => {
    const found = cities.find(c => c.id === cityId)
    return found ? { latitude: found.latitude, longitude: found.longitude } : { latitude: 12.9716, longitude: 77.598 }
  }, [cityId])

  const activeMissionDonor = useMemo(() => {
    if (!activeMission) return null
    return data?.donors.find(d => d.id === activeMission.donor_id) ?? null
  }, [activeMission, data?.donors])

  const activeMissionRecipient = useMemo(() => {
    if (!activeMission) return null
    if (activeMission.recipient_id) {
      const match = data?.recipients.find(r => r.id === activeMission.recipient_id)
      if (match) return match
    }
    return data?.recipients.find(r => r.city_id === cityId) ?? data?.recipients[0] ?? null
  }, [activeMission, data?.recipients, cityId])

  const routeTelemetry = useMemo(() => {
    if (!activeMission) return null

    const driverLat = myDriver?.latitude ?? cityCoords.latitude
    const driverLng = myDriver?.longitude ?? cityCoords.longitude

    const donorLat = activeMissionDonor?.latitude ?? (cityCoords.latitude + 0.01)
    const donorLng = activeMissionDonor?.longitude ?? (cityCoords.longitude + 0.01)

    const recipientLat = activeMissionRecipient?.latitude ?? (cityCoords.latitude - 0.01)
    const recipientLng = activeMissionRecipient?.longitude ?? (cityCoords.longitude - 0.01)

    const isPickedUp = activeMission.status === 'picked_up'

    const leg1Distance = calculateDistanceKm(driverLat, driverLng, donorLat, donorLng)
    const leg2Distance = calculateDistanceKm(donorLat, donorLng, recipientLat, recipientLng)
    const directDeliveryDistance = calculateDistanceKm(driverLat, driverLng, recipientLat, recipientLng)

    const totalRemainingDistance = isPickedUp ? directDeliveryDistance : Number((leg1Distance + leg2Distance).toFixed(1))
    const estimatedMins = Math.max(5, Math.round((totalRemainingDistance / 20) * 60))

    const safeUntilMs = new Date(activeMission.safe_until).getTime()
    const remainingSafeMins = Math.max(0, Math.round((safeUntilMs - now) / 60000))
    const safeBufferMins = remainingSafeMins - estimatedMins

    let navUrl = ''
    if (isPickedUp) {
      navUrl = `https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${recipientLat},${recipientLng}&travelmode=two_wheeler`
    } else {
      navUrl = `https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${recipientLat},${recipientLng}&waypoints=${donorLat},${donorLng}&travelmode=two_wheeler`
    }

    return {
      leg1Distance,
      leg2Distance,
      totalRemainingDistance,
      estimatedMins,
      remainingSafeMins,
      safeBufferMins,
      isPickedUp,
      navUrl,
      donorName: activeMissionDonor?.name ?? 'Donor Kitchen',
      donorArea: activeMissionDonor?.area ?? 'Central Zone',
      recipientName: activeMissionRecipient?.name ?? 'Community Shelter',
      recipientArea: activeMissionRecipient?.area ?? 'East Zone',
    }
  }, [activeMission, activeMissionDonor, activeMissionRecipient, myDriver, cityCoords, now])

  async function toggleAvailability() {
    if (!myDriver) return
    const nextAvailability = !effectiveAvailability

    // Immediate optimistic update for instant UI feedback
    setOptimisticAvailability(nextAvailability)
    setToggling(true)

    try {
      if (isSupabaseConfigured && supabase) {
        const updatePayload: Record<string, any> = { availability: nextAvailability }
        if (!myDriver.user_id && profile?.user_id) {
          updatePayload.user_id = profile.user_id
        }

        let updated = false
        if (myDriver.id) {
          const { data: updatedRows, error } = await supabase
            .from('drivers')
            .update(updatePayload)
            .eq('id', myDriver.id)
            .select()

          if (error) throw error
          if (updatedRows && updatedRows.length > 0) {
            updated = true
          }
        }

        // If no row was updated (e.g. record not yet initialized), upsert with profile
        if (!updated && profile?.user_id) {
          const { error: upsertErr } = await supabase
            .from('drivers')
            .upsert({
              id: myDriver.id || ('drv_' + Math.random().toString(36).slice(2, 10)),
              name: profile.display_name || 'Volunteer Driver',
              availability: nextAvailability,
              city_id: cityId || profile.city_id || 'blr',
              vehicle: myDriver.vehicle || 'Bike',
              capacity_kg: myDriver.capacity_kg || 30,
              reliability: 0.95,
              is_synthetic: false,
              user_id: profile.user_id,
            })
          if (upsertErr) throw upsertErr
        }
      } else {
        await apiRequest(`/api/drivers/${encodeURIComponent(myDriver.id)}/availability`, {
          method: 'PATCH',
          body: JSON.stringify({ availability: nextAvailability }),
        })
      }

      refresh()
      toast.success(
        nextAvailability
          ? 'You are now online and ready for rescue missions!'
          : 'Marked as offline / unavailable.'
      )
    } catch (err: any) {
      setOptimisticAvailability(null)
      toast.error(err?.message || 'Could not update availability.')
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
              ? `${myDriver.vehicle} · up to ${number(myDriver.capacity_kg)} kg payload · ${effectiveAvailability ? 'Online & Available' : 'Offline'}`
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
            variant={effectiveAvailability ? 'default' : 'outline'}
            size="sm"
            onClick={toggleAvailability}
            disabled={toggling}
            className="shrink-0 font-medium transition-all duration-200"
          >
            {effectiveAvailability ? (
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
            <ShieldCheck size={18} className={effectiveAvailability ? 'text-emerald-500' : 'text-amber-500'} />
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold text-foreground">
              {effectiveAvailability ? 'Active' : 'Standby'}
            </strong>
            <span className="text-[11px] text-muted-foreground block">
              {effectiveAvailability ? 'Receiving city dispatches' : 'Turn online to receive'}
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

      {/* Active Rescue Corridor & Live Turn-by-Turn Navigation Map */}
      {assignedDonations.length > 0 && activeMission && routeTelemetry ? (
        <div className="panel p-5 sm:p-6 rounded-2xl border border-border/80 bg-card space-y-4 shadow-sm">
          {/* Header & Mission Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Route size={18} />
                </span>
                <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                  Optimal Rescue Corridor
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </h3>
                <Badge
                  variant={routeTelemetry.isPickedUp ? 'default' : 'secondary'}
                  className={`text-xs ${routeTelemetry.isPickedUp ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}`}
                >
                  {routeTelemetry.isPickedUp ? 'Stage 2: Transit to Shelter' : 'Stage 1: Pickup from Donor'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Live road telemetry optimized for urban couriers with FSSAI thermal safety monitoring.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedMap(prev => !prev)}
                className="text-xs h-8 gap-1.5"
                title={expandedMap ? 'Standard view' : 'Expand map height'}
              >
                {expandedMap ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {expandedMap ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>

          {/* Mission Switcher Tabs (if driver has multiple assigned missions) */}
          {assignedDonations.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-muted-foreground font-medium shrink-0">Switch Active Route:</span>
              {assignedDonations.map(d => {
                const isActiveTab = d.id === activeMission.id
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedMissionId(d.id)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                      isActiveTab
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Bike size={12} />
                    <span>{d.item}</span>
                    <span className="opacity-75">({d.qty_kg} kg)</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Embedded Rescue Map with active donation route corridor */}
          <div className="rounded-xl overflow-hidden border border-border/80 shadow-inner">
            <Suspense fallback={<MapSkeleton />}>
              <RescueMap
                data={data}
                cityId={cityId}
                expanded={expandedMap}
                onExpand={() => setExpandedMap(prev => !prev)}
                selectedDonationId={activeMission.id}
              />
            </Suspense>
          </div>

          {/* Route Telemetry & Waypoints Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Waypoint 1: Donor */}
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              !routeTelemetry.isPickedUp
                ? 'border-primary/50 bg-primary/5'
                : 'border-border/60 bg-muted/30 opacity-75'
            }`}>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <UtensilsCrossed size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {!routeTelemetry.isPickedUp ? 'Current Target: Pickup' : 'Completed: Pickup'}
                  </span>
                  {!routeTelemetry.isPickedUp && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      Step 1
                    </Badge>
                  )}
                </div>
                <h4 className="font-semibold text-sm text-foreground truncate">{routeTelemetry.donorName}</h4>
                <p className="text-xs text-muted-foreground truncate">{routeTelemetry.donorArea}</p>
              </div>
            </div>

            {/* Waypoint 2: Destination Shelter */}
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              routeTelemetry.isPickedUp
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-border/60 bg-muted/30'
            }`}>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {routeTelemetry.isPickedUp ? 'Current Target: Delivery' : 'Next: Dropoff'}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                    Step 2
                  </Badge>
                </div>
                <h4 className="font-semibold text-sm text-foreground truncate">{routeTelemetry.recipientName}</h4>
                <p className="text-xs text-muted-foreground truncate">{routeTelemetry.recipientArea}</p>
              </div>
            </div>

            {/* Telemetry Metrics & FSSAI Window */}
            <div className="p-3 rounded-xl border border-border/80 bg-card/60 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Navigation size={13} className="text-primary" /> Corridor Distance
                </span>
                <span className="font-mono font-bold text-foreground">
                  {routeTelemetry.totalRemainingDistance} km
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock size={13} className="text-primary" /> Transit ETA
                </span>
                <span className="font-mono font-bold text-foreground">
                  ~{routeTelemetry.estimatedMins} mins
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                <span className="text-muted-foreground flex items-center gap-1">
                  {routeTelemetry.safeBufferMins > 20 ? (
                    <ShieldCheck size={13} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={13} className="text-amber-500" />
                  )}
                  Thermal Margin
                </span>
                <span className={`font-mono text-xs font-semibold ${
                  routeTelemetry.safeBufferMins > 20
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  +{routeTelemetry.safeBufferMins}m buffer
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Action Toolbar */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Compass size={14} className="text-primary shrink-0" />
              <span>
                Navigating for <strong className="text-foreground">{activeMission.item}</strong> ({activeMission.qty_kg} kg)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {routeTelemetry.navUrl && (
                <Button
                  size="sm"
                  onClick={() => {
                    toast.info('Launching Google Maps turn-by-turn navigation...')
                    window.open(routeTelemetry.navUrl, '_blank', 'noopener,noreferrer')
                  }}
                  className="h-9 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  <Navigation size={14} />
                  Start Turn-by-Turn GPS
                  <ExternalLink size={12} className="opacity-80" />
                </Button>
              )}

              {!routeTelemetry.isPickedUp ? (
                <Button
                  size="sm"
                  onClick={() => setHandoverDonation(activeMission)}
                  className="h-9 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  <QrCode size={14} />
                  Verify Pickup OTP
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setHandoverDonation(activeMission)}
                  className="h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <CheckCheck size={14} />
                  Confirm Delivery OTP
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Standby state - Explore City Rescue Map toggle */
        <div className="panel p-5 rounded-2xl border border-border/80 bg-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <Route size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">City Rescue Network Map</h3>
                <p className="text-xs text-muted-foreground">
                  Explore active donor kitchens, urgent rescue requests, and recipient shelters across {cityId.toUpperCase()}.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExploreMap(prev => !prev)}
              className="text-xs gap-1.5 self-start sm:self-auto"
            >
              <Compass size={14} />
              {showExploreMap ? 'Collapse Map' : 'Explore City Map'}
            </Button>
          </div>

          {showExploreMap && (
            <div className="rounded-xl overflow-hidden border border-border/80 shadow-inner">
              <Suspense fallback={<MapSkeleton />}>
                <RescueMap
                  data={data}
                  cityId={cityId}
                  expanded={expandedMap}
                  onExpand={() => setExpandedMap(prev => !prev)}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

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
                      onClick={() => {
                        setSelectedMissionId(d.id)
                        onSelect(d)
                      }}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Route size={12} className="text-primary" />
                      View Corridor
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

