import { useMemo, useState, type FormEvent } from 'react'
import { Leaf, LoaderCircle, Sparkles, UtensilsCrossed, ShieldCheck, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { categoryLabels, type Category, type PilotData } from '@/src/types'
import { apiRequest, createDonation } from '@/src/api'
import { seedCategoryDefaults } from '@/src/seed'

function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export function DonationForm({ open, data, cityId, refresh, onClose }: { open: boolean; data?: PilotData; cityId: string; refresh: () => void; onClose: () => void }) {
  const donors = data?.donors ?? []
  const [donorId, setDonorId] = useState(donors[0]?.id ?? '')
  const [item, setItem] = useState('')
  const [qtyKg, setQtyKg] = useState<string>('')
  const [category, setCategory] = useState<Category>('cooked_hot')
  const [tempC, setTempC] = useState<string>('70')
  const [preparedAt, setPreparedAt] = useState<string>(toLocalInput(Date.now()))
  const [sourceText, setSourceText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const defaults = useMemo(() => seedCategoryDefaults[category], [category])

  function reopened() {
    setError('')
    setPending(false)
    setIsExtracting(false)
    setCategory('cooked_hot')
    setTempC('70')
    setPreparedAt(toLocalInput(Date.now()))
  }

  function handleCategoryChange(c: Category) {
    setCategory(c)
    const def = seedCategoryDefaults[c]
    setTempC(def.temp === null ? '' : String(def.temp))
  }

  async function extractWithAI() {
    if (!sourceText.trim()) {
      toast.info('Type or paste a message first (e.g. "Paneer biryani 20 kg hot ready now").')
      return
    }
    setIsExtracting(true)
    try {
      const parsed = await apiRequest<{ item: string; category: Category; qty_kg: number; temp_c: number | null; prepared_at_iso?: string }>('/api/donations/intake-nlp', {
        method: 'POST',
        body: JSON.stringify({ text: sourceText }),
      })
      setItem(parsed.item)
      setCategory(parsed.category)
      setQtyKg(String(parsed.qty_kg))
      setTempC(parsed.temp_c !== null ? String(parsed.temp_c) : '')
      if (parsed.prepared_at_iso) {
        setPreparedAt(toLocalInput(new Date(parsed.prepared_at_iso).getTime()))
      }
      toast.success(`Extracted with AI: ${parsed.item} · ${parsed.qty_kg} kg`)
    } catch {
      // Keep the form usable when the authenticated AI endpoint is unavailable.
      const clean = sourceText.toLowerCase()
      let parsedKg = 15
      const kgMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos|kilograms)/)
      if (kgMatch) {
        parsedKg = parseFloat(kgMatch[1])
      } else {
        const platesMatch = clean.match(/(\d+)\s*(?:plates|servings|people|meals|boxes)/)
        if (platesMatch) parsedKg = Math.round(parseFloat(platesMatch[1]) * 0.45)
      }
      setQtyKg(String(parsedKg))

      if (clean.includes('cold') || clean.includes('chilled') || clean.includes('salad') || clean.includes('curd')) {
        handleCategoryChange('cooked_cold')
        setTempC('4.5')
      } else if (clean.includes('bread') || clean.includes('pastry') || clean.includes('cake') || clean.includes('bun')) {
        handleCategoryChange('bakery')
      } else if (clean.includes('vegetable') || clean.includes('fruit') || clean.includes('produce')) {
        handleCategoryChange('produce')
      } else if (clean.includes('packaged') || clean.includes('biscuit') || clean.includes('packet')) {
        handleCategoryChange('packaged')
      } else {
        handleCategoryChange('cooked_hot')
        setTempC('70')
      }

      const words = sourceText.trim().split(/\s+/).slice(0, 4).join(' ')
      setItem(words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Veg Meals')
      toast.info(`Used local text hints: ${parsedKg} kg. Review every field before posting.`)
    } finally {
      setIsExtracting(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const prepTimestamp = new Date(preparedAt).getTime()
      const activeDonorId = donorId || donors[0]?.id
      if (!activeDonorId) throw new Error('Your account has no verified donor location in this city yet.')

      await createDonation({
        city_id: cityId,
        donor_id: activeDonorId,
        item: item.trim(),
        category,
        qty_kg: Number(qtyKg) || 10,
        prepared_at: new Date(prepTimestamp).toISOString(),
        temp_c: tempC.trim() ? Number(tempC) : defaults.temp,
        source_text: sourceText.trim() || undefined,
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

  return <Dialog open={open} onOpenChange={open => { if (!open) onClose(); else reopened() }}><DialogContent className="sm:max-w-lg p-6">
    <DialogHeader><div className="flex items-center gap-2"><span className="brand-icon" style={{ width: 34, height: 34 }}><UtensilsCrossed size={17} /></span><div><DialogTitle>Post a surplus donation</DialogTitle><DialogDescription>AaharSetu coordinates real-time pickup before the food safety countdown closes.</DialogDescription></div></div></DialogHeader>
    <form onSubmit={submit}><FieldGroup className="gap-4">
      {/* NLP AI Assist Input */}
      <Field className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel htmlFor="source_text" className="font-semibold text-primary flex items-center gap-1.5 text-xs"><Sparkles size={14} />Quick-fill with Gemini AI</FieldLabel>
          <Button type="button" size="sm" variant="outline" onClick={extractWithAI} disabled={isExtracting || !sourceText.trim()} className="h-7 text-xs font-medium">
            {isExtracting ? <LoaderCircle size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1 text-primary" />}
            {isExtracting ? 'Analyzing…' : 'Extract with AI'}
          </Button>
        </div>
        <Textarea id="source_text" value={sourceText} onChange={e => setSourceText(e.target.value)} rows={2} placeholder="Paste a note (Hindi, Hinglish, English): e.g. “40 plates veg biryani ready now, hot, around 18kg”" className="text-xs bg-background" />
        <FieldDescription className="text-[11px] text-muted-foreground mt-1">Gemini Flash-Lite extracts item, category, weight, and calculates the FSSAI safety window.</FieldDescription>
      </Field>

      <Field><FieldLabel htmlFor="donor">Posting donor location</FieldLabel>
        <select id="donor" value={donorId} onChange={e => setDonorId(e.target.value)} required className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
          {donors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.area} {d.license_no ? '✓' : ''}</option>)}
        </select>
      </Field>

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

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" size="lg" disabled={pending || !donors.length} className="w-full">
        {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Leaf data-icon="inline-start" />}
        {pending ? 'Saving and triggering matching…' : 'Post donation & find match'}
      </Button>
    </FieldGroup></form>
  </DialogContent></Dialog>
}
