import { useState } from 'react'
import { CheckCircle2, ShieldCheck, QrCode, KeyRound, LoaderCircle, MapPin, Thermometer } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Donation, PilotData } from '@/src/types'
import { dispatchAction } from '@/src/api'

interface HandoverDialogProps {
  donation: Donation | null
  stage: 'pickup' | 'delivery' | null
  data?: PilotData
  onClose: () => void
  onSuccess: () => void
}

export function HandoverDialog({ donation, stage, data, onClose, onSuccess }: HandoverDialogProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)

  if (!donation || !stage) return null

  const donor = data?.donors.find(d => d.id === donation.donor_id)
  const recipient = data?.recipients.find(r => r.id === donation.recipient_id)
  const driver = data?.drivers.find(d => d.id === donation.driver_id)

  // Generate deterministic 6-digit OTP based on donation ID and stage
  const expectedOtp = String(Math.abs((donation.id + stage).split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7)) % 900000 + 100000)

  async function handleVerify(overrideCode?: string) {
    if (!donation) return
    const inputCode = (overrideCode ?? code).trim()
    if (inputCode !== expectedOtp && inputCode !== '123456') {
      toast.error('Invalid verification code. Please check with donor/recipient or use sample OTP.')
      return
    }
    setBusy(true)
    try {
      await dispatchAction(donation.id, stage === 'pickup' ? 'pickup' : 'deliver')
      setVerified(true)
      toast.success(stage === 'pickup' ? 'Pickup verified! In transit to shelter.' : 'Delivery verified! Rescue complete.')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch {
      toast.error('Handover verification failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!donation} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="brand-icon p-2 rounded-xl bg-primary/10 text-primary">
              <QrCode size={20} />
            </span>
            <div>
              <DialogTitle>{stage === 'pickup' ? 'Verify Food Pickup' : 'Verify Shelter Handover'}</DialogTitle>
              <DialogDescription>
                {stage === 'pickup' ? `From ${donor?.name ?? 'Donor'}` : `To ${recipient?.name ?? 'Shelter'}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 my-2">
          {/* Rescue Context Badge */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-secondary flex justify-between items-center text-xs">
            <div>
              <p className="font-semibold text-foreground">{donation.item}</p>
              <p className="text-muted-foreground">{donation.qty_kg} kg · {stage === 'pickup' ? donor?.area : recipient?.area}</p>
            </div>
            <Badge variant="outline" className="font-mono text-[11px]">
              {stage === 'pickup' ? 'Stage 1: Pickup' : 'Stage 2: Delivery'}
            </Badge>
          </div>

          {/* QR / OTP Simulation Card */}
          <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center text-center">
            <div className="p-3 bg-white dark:bg-black rounded-lg shadow-sm border mb-2">
              <QrCode size={64} className="text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">Scan QR or enter 6-digit confirmation OTP</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-background border text-primary">
                OTP: {expectedOtp}
              </span>
              <button 
                type="button" 
                onClick={() => setCode(expectedOtp)} 
                className="text-[11px] text-primary underline font-medium hover:text-primary/80"
              >
                Auto-fill
              </button>
              <span className="text-muted-foreground text-[10px]">·</span>
              <button 
                type="button" 
                onClick={() => {
                  setCode(expectedOtp)
                  handleVerify(expectedOtp)
                }} 
                className="text-[11px] text-primary font-bold hover:underline"
              >
                ⚡ 1-Click Verify
              </button>
            </div>
          </div>

          {/* Attestation Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/30 border flex items-center gap-2">
              <Thermometer size={15} className="text-primary shrink-0" />
              <div>
                <p className="text-muted-foreground text-[10px]">Attested Temp</p>
                <p className="font-semibold">{donation.temp_c ? `${donation.temp_c}°C` : 'Ambient'}</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border flex items-center gap-2">
              <ShieldCheck size={15} className="text-primary shrink-0" />
              <div>
                <p className="text-muted-foreground text-[10px]">FSSAI Record</p>
                <p className="font-semibold text-primary">Audit Logged</p>
              </div>
            </div>
          </div>

          {/* Input field */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Enter 6-digit handover OTP"
                maxLength={6}
                className="pl-9 font-mono text-center tracking-widest text-base font-semibold"
                disabled={busy || verified}
              />
            </div>
            <Button onClick={() => handleVerify()} disabled={busy || verified || !code.trim()} className="px-5">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : verified ? <CheckCircle2 size={15} /> : 'Confirm'}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-primary" />
            FSSAI Surplus Food Regulations 2019 compliance trail
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
