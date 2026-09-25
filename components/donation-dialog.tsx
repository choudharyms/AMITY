import { useState } from 'react'
import { ArrowRight, Clock3, Download, FileText, MapPin, Printer, QrCode, ShieldAlert, ShieldCheck, Thermometer, UserCheck, KeyRound } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { categoryLabels, remainingLabel, statusLabels, type Donation, type PilotData } from '@/src/types'
import { generateHandoverOtp, generateHandoverPayload } from '@/lib/handover'

export function DonationDialog({ donation, data, now, close }: { donation: Donation | null; data?: PilotData; now: number; close: () => void }) {
  const [showSticker, setShowSticker] = useState(false)
  if (!donation) return null

  const donor = data?.donors.find(d => d.id === donation.donor_id)
  const recipient = data?.recipients.find(r => r.id === donation.recipient_id)
  const driver = data?.drivers.find(d => d.id === donation.driver_id)
  const batchId = `AS-BLR-${donation.id.slice(0, 8).toUpperCase()}`

  const activeStage: 'pickup' | 'delivery' = donation.status === 'picked_up' ? 'delivery' : 'pickup'
  const activeOtp = generateHandoverOtp(donation.id, activeStage)
  const qrPayload = generateHandoverPayload(donation, activeStage, batchId)

  function handlePrint() {
    window.print()
  }

  return (
    <Dialog open={!!donation} onOpenChange={open => { if (!open) { setShowSticker(false); close() } }}>
      <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {donation.item}
              </DialogTitle>
              <DialogDescription>
                {donor?.name} · {donation.is_synthetic ? 'Synthetic pilot donation' : 'Donation details'}
              </DialogDescription>
            </div>
            <Badge variant={donation.status === 'delivered' ? 'secondary' : 'default'} className="uppercase tracking-wider font-mono text-[11px]">
              {statusLabels[donation.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Header meta badges */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className="font-mono text-xs">{categoryLabels[donation.category]}</Badge>
              <Badge variant="secondary" className="font-mono text-xs">Batch {batchId}</Badge>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSticker(!showSticker)}
              className="text-xs h-7 gap-1"
            >
              <FileText size={12} />
              {showSticker ? 'View Details' : 'FSSAI Batch Label'}
            </Button>
          </div>

          {showSticker ? (
            /* Official FSSAI Surplus Recovery Label View */
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 flex flex-col gap-3 print:border-black print:bg-white text-xs">
              <div className="flex justify-between items-start border-b border-primary/20 pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary text-primary-foreground font-black text-xs">
                    आahar
                  </span>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide text-primary">AAHARSETU FOOD RECOVERY PASS</h3>
                    <p className="text-[10px] text-muted-foreground">FSSAI Surplus Food Regulations, 2019 Compliance Manifest</p>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <strong>{batchId}</strong>
                  <p className="text-[10px] text-muted-foreground">Bengaluru Hub</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Food Item & Qty</span>
                  <strong className="text-sm font-semibold">{donation.item} ({donation.qty_kg} kg)</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Donor Facility</span>
                  <span className="font-medium">{donor?.name} ({donor?.area})</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Donor FSSAI License</span>
                  <span className="font-mono">{donor?.license_no ?? 'COLLECTED, NOT VERIFIED'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Attested Temp</span>
                  <span className="font-bold text-primary">{donation.temp_c ? `${donation.temp_c}°C` : 'Ambient / Room'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Prepared Timestamp</span>
                  <span>{new Date(donation.prepared_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} IST</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block text-destructive font-bold">Strict Consume-By</span>
                  <span className="font-bold text-destructive">{new Date(donation.safe_until).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} IST</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-background/90 border text-[11px] flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Shelter Destination: {recipient?.name ?? 'Assigning…'}</p>
                  <p className="text-muted-foreground text-[10px]">Volunteer Courier: {driver?.name ?? 'Dispatching…'} ({driver?.vehicle ?? 'Transit'})</p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Handover OTP:</span>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {activeOtp}
                    </span>
                    <Badge variant="outline" className="text-[9px] uppercase font-mono py-0">
                      {activeStage}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-white border border-primary/20 shadow-xs shrink-0 print:border-black">
                  <QRCodeSVG
                    value={qrPayload}
                    size={72}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                  <span className="text-[9px] font-mono font-bold text-zinc-700 mt-1">
                    SCAN TO VERIFY
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-primary/20">
                <span>Verification: <strong>{donation.status.toUpperCase()}</strong></span>
                <Button variant="ghost" size="sm" onClick={handlePrint} className="h-6 text-[11px] px-2 gap-1">
                  <Printer size={12} /> Print Sticker
                </Button>
              </div>
            </div>
          ) : (
            /* Standard Detailed Inspection View */
            <>
              <div className="donation-detail-grid">
                <div>
                  <span>Available quantity</span>
                  <strong>{donation.qty_kg} kg</strong>
                </div>
                <div>
                  <span><Clock3 size={13} />Safe window</span>
                  <strong className={new Date(donation.safe_until).getTime() - now < 3600000 ? 'text-destructive font-black' : ''}>
                    {remainingLabel(donation.safe_until, now)}
                  </strong>
                </div>
                <div>
                  <span><Thermometer size={13} />Attested temperature</span>
                  <strong>{donation.temp_c === null ? 'Ambient' : `${donation.temp_c} °C`}</strong>
                </div>
                <div>
                  <span><MapPin size={13} />Pickup area</span>
                  <strong>{donor?.area ?? 'Not recorded'}</strong>
                </div>
              </div>

              {/* Handover Verification & QR Token Card */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck size={15} className="text-primary" />
                    Handover Verification ({activeStage === 'pickup' ? 'Stage 1: Pickup' : 'Stage 2: Delivery'})
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Scan with driver device or confirm with 6-digit OTP
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="font-mono font-bold text-sm px-2.5 py-0.5 rounded bg-background border text-primary tracking-wider shadow-2xs">
                      {activeOtp}
                    </span>
                    <span className="text-[10px] text-muted-foreground">FSSAI Chain-of-Custody</span>
                  </div>
                </div>
                <div className="flex flex-col items-center p-1.5 rounded-lg bg-white border shadow-2xs shrink-0">
                  <QRCodeSVG value={qrPayload} size={64} level="M" bgColor="#ffffff" fgColor="#000000" />
                  <span className="text-[8px] font-mono font-bold text-zinc-700 mt-0.5">QR CODE</span>
                </div>
              </div>

              {recipient ? (
                <div className="detail-safety">
                  <ShieldCheck size={17} />
                  <p>Destination: <strong>{recipient.name}</strong><span className="unit"> · {recipient.area} ({recipient.is_open ? 'Open & Ready' : 'Closed'})</span></p>
                </div>
              ) : (
                <div className="detail-safety border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                  <ShieldAlert size={17} className="text-amber-600" />
                  <p>Destination: <strong>Pending shelter assignment</strong> · Match algorithm ready</p>
                </div>
              )}

              {driver ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserCheck size={14} className="text-primary" />
                  Assigned driver: <strong>{driver.name}</strong><span className="unit"> · {driver.vehicle} ({driver.capacity_kg} kg max)</span>
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Assigned driver: <em>Unassigned</em>
                </p>
              )}

              <div className="detail-safety">
                <ShieldCheck size={17} />
                <p>
                  Consume by <strong>{new Date(donation.safe_until).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</strong>.
                  <span className="unit"> Enforces 4h hot-hold / 2h cooked ambient countdown.</span>
                </p>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                <span>FSSAI license: {donor?.license_no ? donor.license_no : 'Collected, not verified'}</span>
                <span>Prep: {new Date(donation.prepared_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'short' })}</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
