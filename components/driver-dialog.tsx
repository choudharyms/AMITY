import { useMemo } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Car,
  Check,
  CheckCheck,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  PackageCheck,
  Route,
  Share2,
  ShieldCheck,
  Truck,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  categoryLabels,
  number,
  remainingLabel,
  statusLabels,
  type Donation,
  type Driver,
  type PilotData,
} from '@/src/types'
import { cities } from '@/src/cities'

interface DriverDialogProps {
  driver: Driver | null
  data?: PilotData
  cityId?: string
  now?: number
  onClose: () => void
  onLocateOnMap?: (driver: Driver) => void
  onViewDispatch?: (driver: Driver) => void
  onSelectDonation?: (donation: Donation) => void
}

export function DriverDialog({
  driver,
  data,
  cityId = 'blr',
  now = Date.now(),
  onClose,
  onLocateOnMap,
  onViewDispatch,
  onSelectDonation,
}: DriverDialogProps) {
  if (!driver) return null

  const city = cities.find(c => c.id === (driver.city_id || cityId)) ?? cities[0]

  const vehicleLower = driver.vehicle.toLowerCase()
  const isBike = vehicleLower.includes('bike') || vehicleLower.includes('scooter') || vehicleLower.includes('cycle') || vehicleLower.includes('2-wheeler')
  const isVanOrTruck = vehicleLower.includes('van') || vehicleLower.includes('truck') || vehicleLower.includes('tata') || vehicleLower.includes('tempo') || vehicleLower.includes('lorry')
  const VehicleIcon = isBike ? Bike : isVanOrTruck ? Truck : Car
  const vehicleCategoryLabel = isBike ? 'Two-Wheeler Express' : isVanOrTruck ? 'Commercial Cargo' : 'Utility Four-Wheeler'

  // Filter donations assigned to this driver
  const assignedDonations = useMemo(() => {
    return data?.donations.filter(
      d => d.driver_id === driver.id && !['delivered', 'expired', 'cancelled'].includes(d.status)
    ) ?? []
  }, [data?.donations, driver.id])

  const completedDonations = useMemo(() => {
    return data?.donations.filter(
      d => d.driver_id === driver.id && d.status === 'delivered'
    ) ?? []
  }, [data?.donations, driver.id])

  const activeKg = assignedDonations.reduce((acc, d) => acc + (d.qty_kg || 0), 0)
  const remainingCapacityKg = Math.max(0, driver.capacity_kg - activeKg)
  const utilizationPct = driver.capacity_kg > 0 ? Math.min(100, Math.round((activeKg / driver.capacity_kg) * 100)) : 0
  const totalRescuedKg = completedDonations.reduce((acc, d) => acc + (d.qty_kg || 0), 0)

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#drivers?id=${encodeURIComponent(driver.id)}`
    navigator.clipboard.writeText(url)
    toast.success('Direct volunteer driver link copied to clipboard!')
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${driver.latitude},${driver.longitude}`

  return (
    <Dialog open={!!driver} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="relative">
                <span className="driver-avatar text-lg font-bold shrink-0">
                  {driver.name
                    .split(' ')
                    .slice(0, 2)
                    .map(word => word[0])
                    .join('')}
                </span>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-primary shadow-xs">
                  <VehicleIcon size={12} />
                </span>
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {driver.name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 mt-1 text-xs">
                  <MapPin size={13} className="text-primary shrink-0" />
                  <span>Patrol Base: {city.name}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {driver.latitude.toFixed(4)}°N, {driver.longitude.toFixed(4)}°E
                  </span>
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant={driver.availability ? 'secondary' : 'outline'} className="gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    driver.availability ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {driver.availability ? 'Ready for Dispatch' : 'On Active Rescue'}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {driver.is_synthetic ? 'Synthetic Volunteer' : 'Verified Field Courier'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">
                Vehicle & Payload
              </span>
              <strong className="text-xs font-semibold text-foreground flex items-center gap-1 mt-0.5">
                <VehicleIcon size={13} className="text-primary shrink-0" />
                <span className="truncate">{driver.vehicle}</span>
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                up to {number(driver.capacity_kg)} kg payload
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">
                Active Payload
              </span>
              <strong className="text-xs font-semibold block mt-0.5 text-primary">
                {activeKg > 0 ? `${number(activeKg)} kg in transit` : '0 kg committed'}
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {remainingCapacityKg} kg free space
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">
                Rescue Record
              </span>
              <strong className="text-xs font-semibold text-foreground flex items-center gap-1 mt-0.5">
                <ShieldCheck size={13} className="text-primary" />
                {completedDonations.length} completed
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {number(totalRescuedKg)} kg safe delivered
              </span>
            </div>
          </div>

          {/* Real-time Payload Utilization Bar */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-foreground">
                <PackageCheck size={15} className="text-primary" />
                Vehicle Payload Utilization
              </span>
              <span className="font-mono text-xs font-medium">
                {utilizationPct}% ({number(activeKg)} / {number(driver.capacity_kg)} kg)
              </span>
            </div>
            <progress
              className="capacity-progress"
              value={activeKg}
              max={driver.capacity_kg}
              style={{ height: '7px' }}
              aria-label={`Payload utilization of ${driver.name}`}
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-2">
              <span>{remainingCapacityKg > 0 ? `Can carry up to ${number(remainingCapacityKg)} kg additional food` : 'Vehicle at maximum carrying capacity'}</span>
              <span>Class: {vehicleCategoryLabel}</span>
            </div>
          </div>

          {/* Active Mission / Corridors (Core Routing) */}
          {assignedDonations.length > 0 ? (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Route size={15} />
                  Active Rescue Route ({assignedDonations.length})
                </span>
                <span className="text-[11px] font-normal">Perishable Corridor</span>
              </div>

              {assignedDonations.map(d => {
                const donor = data?.donors.find(dn => dn.id === d.donor_id)
                const recipient = data?.recipients.find(r => r.id === d.recipient_id)
                const directionsUrl = donor && recipient
                  ? `https://www.google.com/maps/dir/?api=1&origin=${donor.latitude},${donor.longitude}&destination=${recipient.latitude},${recipient.longitude}`
                  : null

                return (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg bg-background/90 border border-border/60 flex flex-col gap-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-foreground text-xs">{d.item}</strong>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/5 text-primary border-primary/20">
                            {d.qty_kg} kg
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            {statusLabels[d.status]}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          Safe window: <strong className="text-amber-600 dark:text-amber-400">{remainingLabel(d.safe_until, now)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {directionsUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2"
                            onClick={() => window.open(directionsUrl, '_blank')}
                            title="Open turn-by-turn route navigation in Google Maps"
                          >
                            <Navigation size={11} className="text-primary" />
                            GPS Route
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] gap-1 text-primary px-2"
                          onClick={() => onSelectDonation?.(d)}
                        >
                          Details <ArrowRight size={11} />
                        </Button>
                      </div>
                    </div>

                    {/* Routing Corridor Waypoints */}
                    <div className="pt-2 border-t border-border/50 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={12} className="text-amber-500 shrink-0" />
                        <span className="truncate">
                          Pickup: <strong className="text-foreground font-medium">{donor?.name || 'Donor Hub'}</strong> ({donor?.area || city.name})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={12} className="text-emerald-500 shrink-0" />
                        <span className="truncate">
                          Dropoff: <strong className="text-foreground font-medium">{recipient?.name || 'Shelter'}</strong> ({recipient?.area || city.name})
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <VehicleIcon size={18} />
                </span>
                <div>
                  <h4 className="font-semibold text-foreground">Available on Standby in {city.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    This courier is free to accept urgent pickup missions for hot meals, produce, or bakery surplus.
                  </p>
                </div>
              </div>
              {onViewDispatch && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 shrink-0 gap-1.5"
                  onClick={() => {
                    onClose()
                    onViewDispatch(driver)
                  }}
                >
                  <Zap size={13} className="text-amber-500" />
                  Assign Route
                </Button>
              )}
            </div>
          )}

          {/* Past Deliveries History */}
          {completedDonations.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
                Delivered Rescues by {driver.name.split(' ')[0]} ({completedDonations.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {completedDonations.slice(0, 4).map(d => (
                  <div
                    key={d.id}
                    className="p-2 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-foreground">{d.item}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">({d.qty_kg} kg)</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCheck size={12} /> Delivered
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons Toolbar: Everything Leads to the Right Place */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
            {onLocateOnMap && (
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-xs h-9"
                onClick={() => {
                  onClose()
                  onLocateOnMap(driver)
                }}
              >
                <MapPin size={14} className="text-primary" />
                View on Live Map
              </Button>
            )}

            {onViewDispatch && (
              <Button
                className="flex-1 gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => {
                  onClose()
                  onViewDispatch(driver)
                }}
              >
                <Route size={14} />
                View in Dispatch Fleet
              </Button>
            )}

            <Button
              variant="outline"
              className="gap-1.5 text-xs h-9"
              onClick={() => window.open(mapsUrl, '_blank')}
              title="Open driver's GPS base location in Google Maps"
            >
              <Navigation size={13} className="text-muted-foreground" />
              Base GPS
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={copyShareLink}
              title="Copy direct link to this volunteer driver"
            >
              <Share2 size={15} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
