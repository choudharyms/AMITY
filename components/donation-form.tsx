import { useMemo, useState, type FormEvent } from 'react'
import { Check, Leaf, LoaderCircle, Sparkles, ShieldCheck, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { categoryLabels, type Category, type PilotData } from '@/src/types'
import { createDonation, parseDonationMessage, type DonationMessageParse } from '@/src/api'
import { seedCategoryDefaults } from '@/src/seed'

type EntryFormat = 'structured' | 'nlp'

function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export function DonationForm({ open, data, cityId, refresh, onClose }: { open: boolean; data?: PilotData; cityId: string; refresh: () => void; onClose: () => void }) {
  const donors = data?.donors ?? []
  const [donorId, setDonorId] = useState(donors[0]?.id ?? '')
  const [format, setFormat] = useState<EntryFormat>('structured')
  const [item, setItem] = useState('')
  const [qtyKg, setQtyKg] = useState<string>('')
  const [category, setCategory] = useState<Category>('cooked_hot')
  const [tempC, setTempC] = useState<string>('70')
  const [preparedAt, setPreparedAt] = useState<string>(toLocalInput(Date.now()))
  const [sourceText, setSourceText] = useState('')
  const [nlpPreview, setNlpPreview] = useState<DonationMessageParse | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const defaults = useMemo(() => seedCategoryDefaults[category], [category])

  function reopened() {
    setError('')
    setPending(false)
    setFormat('structured')
    setNlpPreview(null)
    setCategory('cooked_hot')
    setTempC('70')
    setPreparedAt(toLocalInput(Date.now()))
  }

  function handleCategoryChange(c: Category) {
    setCategory(c)
    const def = seedCategoryDefaults[c]
    setTempC(def.temp === null ? '' : String(def.temp))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const activeDonorId = donorId || donors[0]?.id
      if (!activeDonorId) throw new Error('Your account has no verified donor location in this city yet.')

      if (format === 'nlp' && !nlpPreview) {
        if (!sourceText.trim()) throw new Error('Describe the surplus food before analyzing it.')
        const parsed = await parseDonationMessage(sourceText.trim())
        setNlpPreview(parsed)
        toast.success('Details extracted. Review them before posting.')
        return
      }

      const parsed = format === 'nlp' ? nlpPreview : null
      const prepTimestamp = parsed ? new Date(parsed.prepared_at_iso).getTime() : new Date(preparedAt).getTime()
      await createDonation({
        city_id: cityId,
        donor_id: activeDonorId,
        item: (parsed?.item ?? item).trim(),
        category: parsed?.category ?? category,
        qty_kg: parsed?.qty_kg ?? (Number(qtyKg) || 10),
        prepared_at: new Date(prepTimestamp).toISOString(),
        temp_c: parsed ? parsed.temp_c : (tempC.trim() ? Number(tempC) : defaults.temp),
        source_text: format === 'nlp' ? sourceText.trim() : undefined,
      })
      onClose()
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save donation.')
    } finally {
      setPending(false)
    }
  }

  // FSSAI Safety Text
  const safetyRationale = useMemo(() => {
    if (category === 'cooked_hot') {
      const numTemp = Number(tempC)
      if (!tempC || numTemp >= 60) {
        return 'FSSAI Guidance: Cooked hot food held above 60°C is safe for up to 4 hours.'
      }
      return 'FSSAI Strict Rule: Food below 65°C has a maximum 2-hour consumption window.'
    }
    if (category === 'cooked_cold') {
      return 'Cold-Chain Rule: Maintained at 5°C or lower (6-hour recovery window).'
    }
    return `${seedCategoryDefaults[category].window_hours}-hour maximum recovery window.`
  }, [category, tempC])

  function selectFormat(nextFormat: EntryFormat) {
    setFormat(nextFormat)
    setError('')
    if (nextFormat !== 'nlp') setNlpPreview(null)
  }

  return <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); else reopened() }}><DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
    <DialogHeader><div className="flex items-center gap-2"><span className="brand-icon" style={{ width: 34, height: 34 }}><UtensilsCrossed size={17} /></span><div><DialogTitle>Post a surplus donation</DialogTitle><DialogDescription>AaharSetu coordinates real-time pickup before the food safety countdown closes.</DialogDescription></div></div></DialogHeader>
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">Choose an entry format</p>
      <div className="grid grid-cols-2 gap-2" aria-label="Donation entry format">
        <Button type="button" variant={format === 'structured' ? 'default' : 'outline'} aria-pressed={format === 'structured'} onClick={() => selectFormat('structured')} className="justify-start">
          <UtensilsCrossed data-icon="inline-start" /> Standard form
        </Button>
        <Button type="button" variant={format === 'nlp' ? 'default' : 'outline'} aria-pressed={format === 'nlp'} onClick={() => selectFormat('nlp')} className="justify-start">
          <Sparkles data-icon="inline-start" /> NLP submission
        </Button>
      </div>
    </div>

    <Field><FieldLabel htmlFor="donor">Posting donor location</FieldLabel>
      <Select value={donorId} onValueChange={(val) => { if (val) setDonorId(val) }}>
        <SelectTrigger id="donor" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <SelectValue placeholder="Select donor location" />
        </SelectTrigger>
        <SelectContent>
          {donors.map(d => (
            <SelectItem key={d.id} value={d.id}>
              {d.name} — {d.area} {d.license_no ? '✓' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>

    <form onSubmit={submit}><FieldGroup className="gap-4">
      {format === 'structured' ? <>
        <div className="grid grid-cols-2 gap-4">
          <Field><FieldLabel htmlFor="item">Food item description</FieldLabel><Input id="item" value={item} onChange={e => setItem(e.target.value)} required maxLength={120} placeholder="e.g. Dal Makhani & Rice (40 servings)" /></Field>
          <Field><FieldLabel htmlFor="qty">Quantity (kg)</FieldLabel><Input id="qty" value={qtyKg} onChange={e => setQtyKg(e.target.value)} type="number" min={0.5} step={0.5} required placeholder="18" /></Field>
        </div>

        <Field><FieldLabel>Food category</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(categoryLabels) as Category[]).map(c => (
              <button type="button" key={c} onClick={() => handleCategoryChange(c)} className={c === category ? 'filter-select bg-secondary text-primary font-semibold border-primary' : 'filter-select'}>
                {c === category && <Check size={12} className="mr-1 inline" />}
                {categoryLabels[c]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field><FieldLabel htmlFor="temp_c">Attested temperature (°C)</FieldLabel><Input id="temp_c" value={tempC} onChange={e => setTempC(e.target.value)} type="number" step={0.1} placeholder={defaults.temp === null ? 'Not applicable' : String(defaults.temp)} />{defaults.temp === null && <FieldDescription>Optional for {categoryLabels[category].toLowerCase()}</FieldDescription>}</Field>
          <Field><FieldLabel htmlFor="prepared_at">Prepared timestamp</FieldLabel><Input id="prepared_at" value={preparedAt} onChange={e => setPreparedAt(e.target.value)} type="datetime-local" required /></Field>
        </div>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel>Safe recovery window</FieldLabel>
            <span className="text-xs font-semibold text-primary">Up to {seedCategoryDefaults[category].window_hours} hours</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 p-2 rounded-lg bg-secondary/40 text-xs text-foreground/80">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span>{safetyRationale} The server calculates the authoritative safe-until time from category, temperature, and preparation time.</span>
          </div>
        </Field>
      </> : <>
        <Field>
          <FieldLabel htmlFor="nlp_message">Describe the surplus food</FieldLabel>
          <Textarea
            id="nlp_message"
            value={sourceText}
            onChange={event => { setSourceText(event.target.value); setNlpPreview(null); setError('') }}
            rows={4}
            maxLength={2000}
            required
            placeholder="e.g. 40 plates veg biryani ready now, hot, around 18 kg"
          />
          <FieldDescription>Write naturally in English, Hindi, or Hinglish. We’ll extract the item, amount, temperature, and preparation time for you to review.</FieldDescription>
        </Field>
        {nlpPreview && <Alert className="border-primary/25 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertTitle>Review extracted details</AlertTitle>
          <AlertDescription className="mt-2 space-y-1 text-foreground">
            <p><strong>{nlpPreview.item}</strong> · {categoryLabels[nlpPreview.category]} · {nlpPreview.qty_kg} kg</p>
            <p>Temperature: {nlpPreview.temp_c === null ? 'Ambient / not specified' : `${nlpPreview.temp_c}°C`}</p>
            <p>Prepared: {new Date(nlpPreview.prepared_at_iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</p>
            <p>Estimated safe window: {nlpPreview.window_hours} hours · consume by {new Date(nlpPreview.safe_until_iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })} IST</p>
            <p className="text-xs text-muted-foreground">{nlpPreview.notes}</p>
          </AlertDescription>
        </Alert>}
      </>}

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" size="lg" disabled={pending || !donors.length || (format === 'nlp' && !sourceText.trim())} className="w-full">
        {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : format === 'nlp' && !nlpPreview ? <Sparkles data-icon="inline-start" /> : <Leaf data-icon="inline-start" />}
        {pending
          ? format === 'nlp' && !nlpPreview ? 'Analyzing message…' : 'Saving and triggering matching…'
          : format === 'nlp' && !nlpPreview ? 'Analyze & review donation' : 'Post donation & find match'}
      </Button>
    </FieldGroup></form>
  </DialogContent></Dialog>
}
