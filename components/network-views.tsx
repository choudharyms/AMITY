import { useState, useMemo } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Car,
  Check,
  CheckCheck,
  HeartHandshake,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  Truck,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  categoryLabels,
  number,
  parseAccepts,
  statusLabels,
  type Driver,
  type PilotData,
  type Recipient,
} from '@/src/types'
import { cities } from '@/src/cities'

function NetworkEmpty({ type, cityName }: { type: string; cityName: string }) {
  return (
    <Empty className="min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Users /></EmptyMedia>
        <EmptyTitle>{type} will appear here</EmptyTitle>
        <EmptyDescription>
          No registered {type.toLowerCase()} in {cityName} yet. Verified organizations will populate as registrations are approved.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function RecipientView({
  data,
  cityId = 'blr',
  onSelectRecipient,
  onDonateToRecipient,
  onLocateOnMap,
}: {
  data?: PilotData
  cityId?: string
  onSelectRecipient?: (r: Recipient) => void
  onDonateToRecipient?: (r: Recipient) => void
  onLocateOnMap?: (r: Recipient) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'capacity'>('all')

  const currentCity = cities.find(c => c.id === cityId) ?? cities[0]

  const filteredRecipients = useMemo(() => {
    if (!data?.recipients) return []
    return data.recipients.filter(r => {
      // Search filter
      const matchesSearch =
        !search.trim() ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.area.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      // Category filter
      if (filter === 'open') {
        return r.approved && r.is_open
      }
      if (filter === 'capacity') {
        return r.capacity_kg - r.reserved_kg > 0
      }
      return true
    })
  }, [data?.recipients, search, filter])

  return (
    <section className="space-y-4">
      {/* Intro banner */}
      <div className="section-intro">
        <ShieldCheck size={17} />
        <span>Only approved, open recipients with available capacity are eligible for matching in {currentCity.name}.</span>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-1">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shelters by name or area…"
            className="pl-8 text-xs h-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            All Shelters ({data?.recipients.length ?? 0})
          </Button>
          <Button
            type="button"
            variant={filter === 'open' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('open')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            Ready to receive ({data?.recipients.filter(r => r.approved && r.is_open).length ?? 0})
          </Button>
          <Button
            type="button"
            variant={filter === 'capacity' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('capacity')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            Has capacity
          </Button>
        </div>
      </div>

      {/* Interactive Recipient Cards Grid */}
      <div className="network-grid">
        {filteredRecipients.map(r => {
          const availableKg = Math.max(0, r.capacity_kg - r.reserved_kg)
          const accepts = parseAccepts(r.accepts)

          return (
            <article
              className="panel network-card clickable"
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectRecipient?.(r)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectRecipient?.(r)
                }
              }}
              aria-label={`View details for shelter ${r.name}`}
            >
              <div className="flex justify-between items-start">
                <span className="network-card-icon">
                  <HeartHandshake size={23} />
                </span>
                <Badge variant={r.approved && r.is_open ? 'secondary' : 'outline'}>
                  {r.approved ? (r.is_open ? 'Ready to receive' : 'Closed') : 'Approval pending'}
                </Badge>
              </div>

              <h2>{r.name}</h2>
              <p className="location-line">
                <MapPin size={13} className="text-primary shrink-0" />
                {r.area}, {currentCity.name}
              </p>

              <div className="capacity-line">
                <span>Available capacity</span>
                <strong>
                  {number(availableKg)} <small>/ {number(r.capacity_kg)} kg</small>
                </strong>
              </div>
              <progress
                className="capacity-progress"
                value={r.reserved_kg}
                max={r.capacity_kg}
                aria-label={`Reserved capacity at ${r.name}`}
              />

              <div className="flex gap-1 flex-wrap mt-3.5">
                {accepts.slice(0, 3).map(c => (
                  <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0.5 font-normal">
                    {categoryLabels[c] || c}
                  </Badge>
                ))}
                {accepts.length > 3 && (
                  <Badge variant="ghost" className="text-[10px] px-1 text-muted-foreground">
                    +{accepts.length - 3} more
                  </Badge>
                )}
              </div>

              {/* Card Footer with Direct Routing Actions */}
              <div className="network-card-footer items-center">
                <span>
                  <CheckCheck size={14} className="text-primary" />
                  {r.approved ? 'Coordinator approved' : 'Awaiting review'}
                </span>

                <div className="flex items-center gap-1">
                  {onLocateOnMap && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={e => {
                        e.stopPropagation()
                        onLocateOnMap(r)
                      }}
                      title="View on Live Map"
                    >
                      <MapPin size={13} />
                    </Button>
                  )}

                  {onDonateToRecipient && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={e => {
                        e.stopPropagation()
                        onDonateToRecipient(r)
                      }}
                      title="Donate food to this shelter"
                    >
                      <UtensilsCrossed size={13} />
                    </Button>
                  )}

                  <span className="text-primary font-medium text-xs flex items-center gap-0.5 ml-1">
                    Details <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {!filteredRecipients.length && (
        <div className="panel">
          <NetworkEmpty type="Recipient organizations" cityName={currentCity.name} />
        </div>
      )}
    </section>
  )
}

function getVehicleIcon(vehicle: string) {
  const v = vehicle.toLowerCase()
  if (v.includes('bike') || v.includes('scooter') || v.includes('cycle') || v.includes('2-wheeler')) return Bike
  if (v.includes('van') || v.includes('truck') || v.includes('tata') || v.includes('tempo') || v.includes('lorry')) return Truck
  return Car
}

export function DriverView({
  data,
  cityId = 'blr',
  onSelectDriver,
  onLocateOnMap,
  onDispatch,
}: {
  data?: PilotData
  cityId?: string
  onSelectDriver?: (d: Driver) => void
  onLocateOnMap?: (d: Driver) => void
  onDispatch?: (d?: Driver) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'available' | 'on_rescue' | 'heavy'>('all')

  const currentCity = cities.find(c => c.id === cityId) ?? cities[0]

  const filteredDrivers = useMemo(() => {
    if (!data?.drivers) return []
    return data.drivers.filter(d => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.vehicle.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filter === 'available') return d.availability
      if (filter === 'on_rescue') return !d.availability
      if (filter === 'heavy') return d.capacity_kg >= 100

      return true
    })
  }, [data?.drivers, search, filter])

  const availableCount = data?.drivers.filter(d => d.availability).length ?? 0
  const onRescueCount = data?.drivers.filter(d => !d.availability).length ?? 0

  return (
    <section className="space-y-4">
      <div className="section-intro">
        <Bike size={17} />
        <span>Availability reflects verified volunteer records in {currentCity.name}. Select any courier to inspect mission route, vehicle capacity, or GPS corridor.</span>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-1">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search volunteers by name, vehicle…"
            className="pl-8 text-xs h-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            All Couriers ({data?.drivers.length ?? 0})
          </Button>
          <Button
            type="button"
            variant={filter === 'available' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('available')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            Available Now ({availableCount})
          </Button>
          <Button
            type="button"
            variant={filter === 'on_rescue' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('on_rescue')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            On Rescue ({onRescueCount})
          </Button>
          <Button
            type="button"
            variant={filter === 'heavy' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('heavy')}
            className="text-xs h-8 px-3 rounded-lg"
          >
            Heavy Cargo (≥100kg)
          </Button>
        </div>
      </div>

      {/* Interactive Driver Cards Grid */}
      <div className="network-grid">
        {filteredDrivers.map(d => {
          const VehicleIcon = getVehicleIcon(d.vehicle)
          const activeDonations = data?.donations.filter(
            don => don.driver_id === d.id && !['delivered', 'expired', 'cancelled'].includes(don.status)
          ) ?? []
          const currentDonation = activeDonations[0]
          const assignedKg = activeDonations.reduce((sum, item) => sum + (item.qty_kg || 0), 0)

          return (
            <article
              className="panel network-card clickable"
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDriver?.(d)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectDriver?.(d)
                }
              }}
              aria-label={`View details and route for volunteer driver ${d.name}`}
            >
              <div className="flex justify-between items-start">
                <div className="relative">
                  <span className="driver-avatar font-bold text-sm">
                    {d.name
                      .split(' ')
                      .slice(0, 2)
                      .map(word => word[0])
                      .join('')}
                  </span>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-primary shadow-2xs">
                    <VehicleIcon size={10} />
                  </span>
                </div>
                <Badge
                  variant={d.availability ? 'secondary' : 'outline'}
                  className={
                    d.availability
                      ? 'gap-1.5'
                      : 'gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      d.availability ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {d.availability ? 'Available' : 'On a rescue'}
                </Badge>
              </div>

              <h2>{d.name}</h2>
              <p className="location-line">
                <VehicleIcon size={13} className="text-primary shrink-0" />
                {d.vehicle} · up to {number(d.capacity_kg)} kg payload
              </p>

              {/* Active Mission or Capacity Gauge */}
              {currentDonation ? (
                <div className="mt-3.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Route size={13} />
                      Active Mission
                    </span>
                    <span className="font-mono">{currentDonation.qty_kg} kg</span>
                  </div>
                  <p className="text-[11px] text-foreground font-medium truncate mt-1">
                    {currentDonation.item}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>{statusLabels[currentDonation.status] || 'In transit'}</span>
                    <span className="text-primary font-medium">Inspect route →</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3.5">
                  <div className="capacity-line">
                    <span>Available payload</span>
                    <strong>
                      {number(d.capacity_kg)} <small>/ {number(d.capacity_kg)} kg free</small>
                    </strong>
                  </div>
                  <progress
                    className="capacity-progress"
                    value={assignedKg}
                    max={d.capacity_kg}
                    aria-label={`Available capacity for ${d.name}`}
                  />
                </div>
              )}

              {/* Card Footer with Direct Routing Actions */}
              <div className="network-card-footer items-center mt-4">
                <span>
                  <ShieldCheck size={14} className="text-primary" />
                  {d.is_synthetic ? 'Synthetic volunteer' : 'Verified courier'}
                </span>

                <div className="flex items-center gap-1">
                  {onLocateOnMap && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={e => {
                        e.stopPropagation()
                        onLocateOnMap(d)
                      }}
                      title="View volunteer on live map"
                    >
                      <MapPin size={13} />
                    </Button>
                  )}

                  {onDispatch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={e => {
                        e.stopPropagation()
                        onDispatch(d)
                      }}
                      title="Inspect dispatch route"
                    >
                      <Route size={13} />
                    </Button>
                  )}

                  <span className="text-primary font-medium text-xs flex items-center gap-0.5 ml-1">
                    Details <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {!filteredDrivers.length && (
        <div className="panel">
          <NetworkEmpty type="Volunteer drivers" cityName={currentCity.name} />
        </div>
      )}
    </section>
  )
}
