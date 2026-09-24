import { useMemo, useState, type FormEvent } from 'react'
import { Leaf, LoaderCircle, Sparkles, UtensilsCrossed } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { categoryLabels, type Category, type PilotData } from '@/src/types'
import { createDonation } from '@/src/api'
import { seedCategoryDefaults } from '@/src/seed'

function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export function DonationForm({ open, data, refresh, onClose }: { open: boolean; data?: PilotData; refresh: () => void; onClose: () => void }) {
  const donors = data?.donors ?? []
  const [category, setCategory] = useState<Category>('cooked_hot')
  const [windowHours, setWindowHours] = useState(seedCategoryDefaults.cooked_hot.window_hours)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const defaults = useMemo(() => seedCategoryDefaults[category], [category])

  function reopened() {
    setError('')
    setPending(false)
    setCategory('cooked_hot')
    setWindowHours(seedCategoryDefaults.cooked_hot.window_hours)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setPending(true)
    try {
      const preparedAt = new Date(String(form.get('prepared_at'))).getTime()
      const safeUntil = preparedAt + windowHours * 3600000
      await createDonation({
        donor_id: String(form.get('donor_id')),
        item: String(form.get('item')),
        category,
        qty_kg: Number(form.get('qty_kg')),
        prepared_at: new Date(preparedAt).toISOString(),
        temp_c: String(form.get('temp_c') || '').trim() ? Number(form.get('temp_c')) : defaults.temp,
        safe_until: new Date(safeUntil).toISOString(),
        source_text: String(form.get('source_text') || '').trim() || undefined,
      })
      onClose()
      refresh()
    } catch {
      setError('We could not post this rescue. Make sure the FastAPI backend is running, or sign in so it can be saved directly to the database.')
    } finally {
      setPending(false)
    }
  }

  return <Dialog open={open} onOpenChange={open => { if (!open) onClose(); else reopened() }}><DialogContent className="sm:max-w-lg p-6">
    <DialogHeader><div className="flex items-center gap-2"><span className="brand-icon" style={{ width: 34, height: 34 }}><UtensilsCrossed size={17} /></span><div><DialogTitle>Post a donation</DialogTitle><DialogDescription>Describe what you have. Matching and routing happen after this is saved.</DialogDescription></div></div></DialogHeader>
    <form onSubmit={submit}><FieldGroup className="gap-4">
      <Field><FieldLabel htmlFor="donor">Posting as</FieldLabel>
        <select id="donor" name="donor_id" defaultValue={donors[0]?.id} required className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5">
          <option value="" disabled>Select a donor location</option>
          {donors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.area}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field><FieldLabel htmlFor="item">What are you donating?</FieldLabel><Input id="item" name="item" required maxLength={120} placeholder="Veg meals (45 servings)" /></Field>
        <Field><FieldLabel htmlFor="qty">Quantity (kg)</FieldLabel><Input id="qty" name="qty_kg" type="number" min={0.5} step={0.5} required placeholder="22" /></Field>
      </div>
      <Field><FieldLabel htmlFor="category">Category</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(categoryLabels) as Category[]).map(c => <button type="button" key={c} onClick={() => { setCategory(c); setWindowHours(seedCategoryDefaults[c].window_hours) }} className={c === category ? 'filter-select bg-secondary' : 'filter-select'} style={c === category ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}>{categoryLabels[c]}</button>)}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field><FieldLabel htmlFor="temp_c">Temperature °C</FieldLabel><Input id="temp_c" name="temp_c" type="number" step={0.1} placeholder={defaults.temp === null ? 'Not applicable' : String(defaults.temp)} />{defaults.temp === null && <FieldDescription>Not required for {categoryLabels[category].toLowerCase()}</FieldDescription>}</Field>
        <Field><FieldLabel htmlFor="prepared_at">Prepared at</FieldLabel><Input id="prepared_at" name="prepared_at" type="datetime-local" defaultValue={toLocalInput(Date.now())} required /></Field>
      </div>
      <Field><FieldLabel>Safe window</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 6, 12].map(h => <button type="button" key={h} onClick={() => setWindowHours(h)} className="filter-select" style={windowHours === h ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}>{h} h</button>)}
        </div>
        <FieldDescription>Coordination cutoff based on how long the food stays safe. {windowHours} hours from preparation.</FieldDescription>
      </Field>
      <Field><FieldLabel htmlFor="source_text"><Sparkles size={13} className="text-primary" />Quick-fill from a message</FieldLabel><Textarea id="source_text" name="source_text" rows={3} placeholder="Optional: paste a note like “Paneer biryani, 18 kg, ready now, stays good till 9pm” and Gemini will fill the details." /><FieldDescription>Synthetic text only. If configured, Gemini extracts fields and overrides the form on the backend.</FieldDescription></Field>
      {error && <FieldError>{error}</FieldError>}
      <Alert className="py-3"><Leaf size={14} /><AlertTitle>Safety before speed</AlertTitle><AlertDescription>Synthetic pilot records only. Never dispatch anything after its safe window closes.</AlertDescription></Alert>
      <Button type="submit" size="lg" disabled={pending || !donors.length}>{pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Leaf data-icon="inline-start" />}{pending ? 'Posting…' : 'Post donation'}</Button>
    </FieldGroup></form>
  </DialogContent></Dialog>
}