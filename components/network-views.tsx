import { useState, useMemo } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Check,
  CheckCheck,
  HeartHandshake,
  MapPin,
  Search,
  ShieldCheck,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { categoryLabels, number, parseAccepts, type PilotData, type Recipient } from '@/src/types'
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

export function DriverView({
  data,
  cityId = 'blr',
  onDispatch,
}: {
  data?: PilotData
  cityId?: string
  onDispatch: () => void
}) {
  const currentCity = cities.find(c => c.id === cityId) ?? cities[0]

  return (
    <section>
      <div className="section-intro">
        <Bike size={17} />
        <span>Availability reflects stored records in {currentCity.name}, not live GPS. Contact details are never shown publicly.</span>
      </div>
      <div className="network-grid">
        {data?.drivers.map(d => (
          <article className="panel network-card" key={d.id}>
            <div className="flex justify-between">
              <span className="driver-avatar">
                {d.name
                  .split(' ')
                  .slice(0, 2)
                  .map(word => word[0])
                  .join('')}
              </span>
              <Badge variant={d.availability ? 'secondary' : 'outline'}>
                {d.availability ? 'Available' : 'On a rescue'}
              </Badge>
            </div>
            <h2>{d.name}</h2>
            <p className="location-line">
              <Bike size={14} />
              {d.vehicle} · up to {number(d.capacity_kg)} kg
            </p>
            <div className="driver-footer">
              <span>{d.is_synthetic ? 'Synthetic volunteer' : 'Registered driver'}</span>
              <Button variant="outline" size="sm" onClick={onDispatch}>
                View dispatch
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!data?.drivers.length && (
        <div className="panel">
          <NetworkEmpty type="Volunteer drivers" cityName={currentCity.name} />
        </div>
      )}
    </section>
  )
}
