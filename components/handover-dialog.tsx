import { useState } from 'react'
import { CheckCircle2, LoaderCircle, ShieldCheck, Thermometer } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Donation, PilotData } from '@/src/types'
import { dispatchAction } from '@/src/api'

interface HandoverDialogProps {
  donation: Donation | null
  stage: 'pickup' | 'delivery' | null
  cityId: string
  data?: PilotData
  onClose: () => void
  onSuccess: () => void
}

export function HandoverDialog({ donation, stage, cityId, data, onClose, onSuccess }: HandoverDialogProps) {
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)
  if (!donation || !stage) return null

  const activeDonation = donation
  const activeStage = stage
  const donor = data?.donors.find(d => d.id === activeDonation.donor_id)
  const recipient = data?.recipients.find(r => r.id === activeDonation.recipient_id)
  const assignedName = activeStage === 'pickup' ? donor?.name ?? 'the donor' : recipient?.name ?? 'the recipient'

  async function confirm() {
    setBusy(true)
    try {
      await dispatchAction(activeDonation.id, activeStage === 'pickup' ? 'pickup' : 'deliver', cityId)
      setVerified(true)
      window.setTimeout(() => { onSuccess(); onClose() }, 800)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'This handover could not be confirmed.')
    } finally { setBusy(false) }
  }

  return <Dialog open={!!activeDonation} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="sm:max-w-md p-6">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="brand-icon p-2 rounded-xl bg-primary/10 text-primary"><ShieldCheck size={20} /></span>
          <div><DialogTitle>{activeStage === 'pickup' ? 'Confirm food pickup' : 'Confirm recipient handover'}</DialogTitle><DialogDescription>{activeStage === 'pickup' ? `Assigned driver confirms collection from ${assignedName}.` : `Assigned recipient confirms delivery to ${assignedName}.`}</DialogDescription></div>
        </div>
      </DialogHeader>
      <div className="flex flex-col gap-4 my-2">
        <div className="p-3 rounded-xl bg-secondary/50 border border-secondary flex justify-between items-center text-xs"><div><p className="font-semibold text-foreground">{activeDonation.item}</p><p className="text-muted-foreground">{activeDonation.qty_kg} kg · {activeStage === 'pickup' ? donor?.area : recipient?.area}</p></div><Badge variant="outline">{activeStage === 'pickup' ? 'Pickup' : 'Delivery'}</Badge></div>
        <div className="grid grid-cols-2 gap-2 text-xs"><div className="p-2.5 rounded-lg bg-muted/30 border flex items-center gap-2"><Thermometer size={15} className="text-primary shrink-0" /><div><p className="text-muted-foreground text-[10px]">Recorded temperature</p><p className="font-semibold">{activeDonation.temp_c !== null ? `${activeDonation.temp_c}°C` : 'Not recorded'}</p></div></div><div className="p-2.5 rounded-lg bg-muted/30 border flex items-center gap-2"><ShieldCheck size={15} className="text-primary shrink-0" /><div><p className="text-muted-foreground text-[10px]">Food window</p><p className="font-semibold">Checked by server</p></div></div></div>
        <p className="text-xs text-muted-foreground">Only the signed-in account assigned to this handover can confirm it. The server checks the role, city, assignment, and allowed status transition.</p>
        <Button onClick={() => void confirm()} disabled={busy || verified} className="w-full">{busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : verified ? <CheckCircle2 data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}{busy ? 'Confirming…' : verified ? 'Confirmed' : activeStage === 'pickup' ? 'Confirm pickup' : 'Confirm delivery'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
