import { useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, CheckCheck, Clock3, LoaderCircle, Route, ShieldCheck, Zap, TrendingUp, RefreshCw, AlertTriangle, QrCode } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { remainingLabel, type Donation, type PilotData } from '@/src/types'
import { dispatchAction, fetchRouteComparison, type RouteComparison } from '@/src/api'
import { HandoverDialog } from '@/components/handover-dialog'

export function DispatchView({ data, now, cityId, role, openDonation, refresh }: { data?: PilotData; now: number; cityId: string; role?: string; openDonation: (d: Donation) => void; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [handoverTarget, setHandoverTarget] = useState<{ donation: Donation; stage: 'pickup' | 'delivery' } | null>(null)
  const { data: routeBenchmark, mutate: reloadBenchmark, isValidating } = useSWR<RouteComparison>(
    ['route-benchmark', cityId],
    () => fetchRouteComparison(cityId),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const columns = [
    { title: 'Find a match', statuses: ['posted'], icon: Route, action: 'match' as const, label: 'Match & assign' },
    { title: 'Awaiting pickup', statuses: ['matched', 'accepted'], icon: Clock3, action: 'pickup' as const, label: 'Confirm pickup' },
    { title: 'On the way', statuses: ['picked_up'], icon: ArrowRight, action: 'deliver' as const, label: 'Confirm delivery' },
    { title: 'Delivered', statuses: ['delivered'], icon: CheckCheck, action: null, label: '' },
  ]

  async function runMatch(id: string) {
    setBusy(id)
    try {
      await dispatchAction(id, 'match', cityId)
      refresh()
      reloadBenchmark()
    } catch { /* toast already shown */ }
    finally { setBusy(null) }
  }

  function handleActionClick(d: Donation, action: 'match' | 'pickup' | 'deliver') {
    if (action === 'match') {
      runMatch(d.id)
    } else {
      setHandoverTarget({ donation: d, stage: action === 'pickup' ? 'pickup' : 'delivery' })
    }
  }

  return <>
    <div className="section-intro">
      <ShieldCheck size={16} />
      <span>No route is dispatchable until its travel time and safety window have been verified. FSSAI countdown enforced.</span>
    </div>

    {/* 4-Stage Kanban Dispatch Pipeline */}
    <div className="dispatch-columns">
      {columns.map(column => {
        const donations = data?.donations.filter(d => column.statuses.includes(d.status)) ?? []
        return <section className="dispatch-column" key={column.title}>
          <header>
            <column.icon size={15} />
            <h2>{column.title}</h2>
            <Badge variant="outline">{data ? donations.length : '—'}</Badge>
          </header>
          {donations.map(d => (
            <article className="dispatch-card" key={d.id}>
              <p>{data?.donors.find(p => p.id === d.donor_id)?.name}</p>
              <h3>{d.item}</h3>
              <div>
                <span>{d.qty_kg} kg</span>
                <span>{d.status === 'delivered' ? 'Rescue complete' : remainingLabel(d.safe_until, now)}</span>
              </div>
              {column.action ? (
                (column.action === 'match' && role === 'coordinator') || (column.action === 'pickup' && role === 'driver') || (column.action === 'deliver' && ['recipient', 'shelter'].includes(role ?? '')) ? <Button variant="outline" disabled={busy === d.id} onClick={() => handleActionClick(d, column.action!)}>
                  {busy === d.id ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : column.action !== 'match' ? (
                    <ShieldCheck data-icon="inline-start" size={14} className="text-primary" />
                  ) : null}
                  {column.label}
                </Button> : <p className="text-xs text-muted-foreground">Waiting for the assigned {column.action === 'match' ? 'coordinator' : column.action === 'pickup' ? 'driver' : 'recipient'}.</p>
              ) : (
                <Button variant="ghost" onClick={() => openDonation(d)}>
                  View rescue<ArrowRight data-icon="inline-end" />
                </Button>
              )}
            </article>
          ))}
          {!donations.length && (
            <Empty className="min-h-48 p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><column.icon /></EmptyMedia>
                <EmptyTitle>No rescues here yet</EmptyTitle>
                <EmptyDescription>{data ? 'Rescues move here as their status changes.' : 'Awaiting pilot database setup.'}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      })}
    </div>

    {/* Live Routing Optimization Benchmark Widget (Innovation 2) */}
    <section className="panel mt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="network-card-icon bg-primary/10 text-primary p-2.5 rounded-xl">
            <Route size={24} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Global Route Optimization Benchmark</h2>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Live Calculation</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Joint Multi-Vehicle Routing (VRP with Expiry Time Windows) vs. Naive Nearest-First</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => reloadBenchmark()} disabled={isValidating} className="self-start md:self-auto">
          <RefreshCw size={13} className={isValidating ? 'animate-spin mr-1.5' : 'mr-1.5'} />
          {isValidating ? 'Optimizing…' : 'Re-run Benchmark'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
        {/* Metric 1: Joint Route */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-primary font-semibold uppercase tracking-wider mb-2">
            <span>AaharSetu Joint VRP</span>
            <Zap size={15} />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {routeBenchmark ? routeBenchmark.joint_route_km : '—'} <span className="text-sm font-normal text-muted-foreground font-sans">road km</span>
          </div>
          <div className="mt-2 text-xs text-primary flex items-center gap-1 font-medium">
            <CheckCheck size={14} /> {routeBenchmark ? `${routeBenchmark.joint_missed_deadlines} expired windows · ${routeBenchmark.stops_count} stops` : 'Waiting for an ORS route result'}
          </div>
        </div>

        {/* Metric 2: Greedy Baseline */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
            <span>Naive Nearest-First</span>
            <AlertTriangle size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {routeBenchmark ? routeBenchmark.greedy_baseline_km : '—'} <span className="text-sm font-normal text-muted-foreground font-sans">road km</span>
          </div>
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
            <AlertTriangle size={14} /> {routeBenchmark ? `${routeBenchmark.greedy_missed_deadlines} expired windows` : 'No live benchmark available'}
          </div>
        </div>

        {/* Metric 3: Comparative Gain */}
        <div className="p-4 rounded-xl bg-secondary/50 border border-secondary flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-primary font-semibold uppercase tracking-wider mb-2">
            <span>Rescue Advantage</span>
            <TrendingUp size={15} />
          </div>
          <div className="text-2xl font-black text-primary font-mono">
            {routeBenchmark ? `${routeBenchmark.pct_distance_saved > 0 ? '+' : ''}${routeBenchmark.pct_distance_saved}%` : '—'} <span className="text-sm font-normal text-muted-foreground font-sans">distance change</span>
          </div>
          <div className="mt-2 text-xs text-foreground/80 font-medium">
            {routeBenchmark ? `${routeBenchmark.km_saved} km saved · ${routeBenchmark.joint_missed_deadlines} joint-route deadlines missed` : 'Uses only pending donations and real ORS road routes.'}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg flex items-start gap-2">
        <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
        <p>
          <strong>Live route comparison:</strong> Uses the selected city's pending donations and OpenRouteService road distance and travel duration. Empty networks and unavailable routes are shown without generated sample stops.
        </p>
      </div>
    </section>

    {/* Role-checked handover confirmation */}
    <HandoverDialog
      donation={handoverTarget?.donation ?? null}
      stage={handoverTarget?.stage ?? null}
      cityId={cityId}
      data={data}
      onClose={() => setHandoverTarget(null)}
      onSuccess={() => {
        refresh()
        reloadBenchmark()
      }}
    />
  </>
}
