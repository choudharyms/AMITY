import { useState } from 'react'
import { ArrowRight, CheckCheck, Clock3, LoaderCircle, Route, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { remainingLabel, type Donation, type PilotData } from '@/src/types'
import { dispatchAction } from '@/src/api'

export function DispatchView({ data, now, openDonation, refresh }: { data?: PilotData; now: number; openDonation: (d: Donation) => void; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const columns = [
    { title: 'Find a match', statuses: ['posted'], icon: Route, action: 'match' as const, label: 'Match & assign' },
    { title: 'Awaiting pickup', statuses: ['matched', 'accepted'], icon: Clock3, action: 'pickup' as const, label: 'Confirm pickup' },
    { title: 'On the way', statuses: ['picked_up'], icon: ArrowRight, action: 'deliver' as const, label: 'Confirm delivery' },
    { title: 'Delivered', statuses: ['delivered'], icon: CheckCheck, action: null as const, label: '' },
  ]
  async function run(id: string, action: 'match' | 'pickup' | 'deliver') {
    setBusy(id)
    try {
      await dispatchAction(id, action)
      refresh()
    } catch { /* toast already shown */ }
    finally { setBusy(null) }
  }
  return <><div className="section-intro"><ShieldCheck size={16} /><span>No route is dispatchable until its travel time and safety window have been checked.</span></div><div className="dispatch-columns">{columns.map(column => {
    const donations = data?.donations.filter(d => column.statuses.includes(d.status)) ?? []
    return <section className="dispatch-column" key={column.title}><header><column.icon size={15} /><h2>{column.title}</h2><Badge variant="outline">{data ? donations.length : '—'}</Badge></header>{donations.map(d => <article className="dispatch-card" key={d.id}><p>{data?.donors.find(p => p.id === d.donor_id)?.name}</p><h3>{d.item}</h3><div><span>{d.qty_kg} kg</span><span>{d.status === 'delivered' ? 'Rescue complete' : remainingLabel(d.safe_until, now)}</span></div>{column.action ? <Button variant="outline" disabled={busy === d.id} onClick={() => run(d.id, column.action!)}>{busy === d.id ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}{column.label}</Button> : <Button variant="ghost" onClick={() => openDonation(d)}>View rescue<ArrowRight data-icon="inline-end" /></Button>}</article>)}{!donations.length && <Empty className="min-h-48 p-4"><EmptyHeader><EmptyMedia variant="icon"><column.icon /></EmptyMedia><EmptyTitle>No rescues here yet</EmptyTitle><EmptyDescription>{data ? 'Rescues move here as their status changes.' : 'Awaiting pilot database setup.'}</EmptyDescription></EmptyHeader></Empty>}</section>
  })}</div><section className="panel routing-explainer"><div className="flex items-center gap-3"><span className="network-card-icon"><Route size={22} /></span><div><h2>Every minute matters.</h2><p>Joint routing compares distance and missed deadlines using the same stored jobs, drivers, and OpenRouteService when a key is configured.</p></div></div><Badge variant="outline">Safety & window checked per match</Badge><p className="text-xs text-muted-foreground">Matching never runs past the safe window. Travel time uses road routing when configured, otherwise a conservative haversine estimate.</p></section></>
}