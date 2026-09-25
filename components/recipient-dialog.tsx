import { useMemo } from 'react'
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock,
  Copy,
  ExternalLink,
  HeartHandshake,
  MapPin,
  Package,
  PackageCheck,
  Share2,
  ShieldAlert,
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
  parseAccepts,
  remainingLabel,
  statusLabels,
  type Donation,
  type PilotData,
  type Recipient,
} from '@/src/types'
import { cities } from '@/src/cities'

interface RecipientDialogProps {
  recipient: Recipient | null
  data?: PilotData
  cityId?: string
  now?: number
  onClose: () => void
  onDonate?: (recipient: Recipient) => void
  onLocateOnMap?: (recipient: Recipient) => void
  onViewDispatch?: (recipient: Recipient) => void
  onSelectDonation?: (donation: Donation) => void
}

export function RecipientDialog({
  recipient,
  data,
  cityId = 'blr',
  now = Date.now(),
  onClose,
  onDonate,
  onLocateOnMap,
  onViewDispatch,
  onSelectDonation,
}: RecipientDialogProps) {
  const recipientId = recipient?.id

  // Unconditionally call hooks at the top level to adhere to Rules of Hooks
  const recipientDonations = useMemo(() => {
    if (!recipientId || !data?.donations) return []
    return data.donations.filter(d => d.recipient_id === recipientId)
  }, [data?.donations, recipientId])

  if (!recipient) return null

  const city = cities.find(c => c.id === (recipient.city_id || cityId)) ?? cities[0]
  const accepts = parseAccepts(recipient.accepts)
  const availableKg = Math.max(0, recipient.capacity_kg - recipient.reserved_kg)
  const capacityPct = recipient.capacity_kg > 0 ? Math.round((recipient.reserved_kg / recipient.capacity_kg) * 100) : 0

  const incomingDonations = recipientDonations.filter(d =>
    ['matched', 'accepted', 'picked_up'].includes(d.status)
  )

  const deliveredDonations = recipientDonations.filter(d => d.status === 'delivered')

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#recipients?id=${encodeURIComponent(recipient.id)}`
    navigator.clipboard.writeText(url)
    toast.success('Direct shelter link copied to clipboard!')
  }

  return (
    <Dialog open={!!recipient} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="network-card-icon mt-0.5 shrink-0" style={{ width: 44, height: 44 }}>
                <HeartHandshake size={24} />
              </span>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {recipient.name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 mt-1 text-xs">
                  <MapPin size={13} className="text-primary shrink-0" />
                  <span>{recipient.area}, {city.name}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {recipient.latitude.toFixed(4)}°N, {recipient.longitude.toFixed(4)}°E
                  </span>
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant={recipient.approved && recipient.is_open ? 'secondary' : 'outline'}>
                {recipient.approved ? (recipient.is_open ? 'Ready to receive' : 'Closed') : 'Pending review'}
              </Badge>
              {recipient.need_level >= 4 && (
                <Badge variant="destructive" className="text-[10px] uppercase tracking-wider font-semibold">
                  High Need Tier
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Key Status Indicators Row */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">Available Space</span>
              <strong className="text-sm font-semibold text-primary">{number(availableKg)} kg</strong>
              <span className="text-[10px] text-muted-foreground block">of {number(recipient.capacity_kg)} kg total</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">Verification</span>
              <strong className="text-xs font-semibold flex items-center gap-1 mt-0.5 text-foreground">
                <CheckCheck size={13} className="text-primary" />
                {recipient.approved ? 'FSSAI Verified' : 'Awaiting Review'}
              </strong>
              <span className="text-[10px] text-muted-foreground block">Coordinator checked</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">Reliability</span>
              <strong className="text-xs font-semibold text-foreground block mt-0.5">
                {Math.round((recipient.reliability ?? 0.95) * 100)}% Success
              </strong>
              <span className="text-[10px] text-muted-foreground block">Verified acceptance</span>
            </div>
          </div>

          {/* Real-time Capacity Progress */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold flex items-center gap-1.5 text-foreground">
                <PackageCheck size={15} className="text-primary" />
                Storage Capacity Utilization
              </span>
              <span className="font-mono text-xs font-medium">
                {capacityPct}% utilized ({number(recipient.reserved_kg)} kg committed)
              </span>
            </div>
            <progress
              className="capacity-progress"
              value={recipient.reserved_kg}
              max={recipient.capacity_kg}
              style={{ height: '7px' }}
              aria-label={`Storage capacity at ${recipient.name}`}
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-2">
              <span>{availableKg > 0 ? `Can accept ${number(availableKg)} kg more surplus today` : 'At maximum capacity right now'}</span>
              <span>Open: {recipient.is_open ? '09:00 - 22:00' : 'Temporarily Closed'}</span>
            </div>
          </div>

          {/* Accepted Food Categories */}
          <div>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
              Accepted Food Categories ({accepts.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {accepts.map(c => (
                <Badge
                  key={c}
                  variant="outline"
                  className="bg-primary/5 text-primary border-primary/20 text-xs py-1 px-2.5 flex items-center gap-1"
                >
                  <Check size={12} className="text-primary" />
                  {categoryLabels[c] || c}
                </Badge>
              ))}
            </div>
          </div>

          {/* Incoming Rescues Alert Banner */}
          {incomingDonations.length > 0 && (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Truck size={15} />
                  {incomingDonations.length} Rescue{incomingDonations.length > 1 ? 's' : ''} En Route
                </span>
                <span className="text-[11px] font-normal">Active Delivery</span>
              </div>
              {incomingDonations.map(d => (
                <div
                  key={d.id}
                  className="p-2 rounded-lg bg-background/80 border border-border/60 flex items-center justify-between text-xs cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onSelectDonation?.(d)}
                >
                  <div>
                    <strong className="text-foreground block">{d.item} ({d.qty_kg} kg)</strong>
                    <span className="text-[11px] text-muted-foreground">{statusLabels[d.status]} · {remainingLabel(d.safe_until, now)}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary">
                    View <ArrowRight size={11} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Delivered Rescues Proof of Impact */}
          {deliveredDonations.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
                Recent Deliveries Received ({deliveredDonations.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {deliveredDonations.slice(0, 5).map(d => (
                  <div
                    key={d.id}
                    className="p-2 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-foreground">{d.item}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">({d.qty_kg} kg)</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCheck size={12} /> Received
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons Toolbar: Everything Leads to the Right Place */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
            {onDonate && (
              <Button
                className="flex-1 gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => {
                  onClose()
                  onDonate(recipient)
                }}
              >
                <UtensilsCrossed size={14} />
                Donate Food to this Shelter
              </Button>
            )}

            {onLocateOnMap && (
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-xs h-9"
                onClick={() => {
                  onClose()
                  onLocateOnMap(recipient)
                }}
              >
                <MapPin size={14} className="text-primary" />
                View on Live Map
              </Button>
            )}

            {onViewDispatch && (
              <Button
                variant="outline"
                className="gap-1.5 text-xs h-9"
                onClick={() => {
                  onClose()
                  onViewDispatch(recipient)
                }}
                title="View active matches & dispatch status"
              >
                <Zap size={14} className="text-amber-500" />
                Dispatch
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={copyShareLink}
              title="Copy link to this shelter"
            >
              <Share2 size={15} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
