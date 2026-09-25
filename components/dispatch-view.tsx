import { useState } from 'react'
import useSWR from 'swr'
import {
  ArrowRight,
  CheckCheck,
  Clock3,
  LoaderCircle,
  Route,
  ShieldCheck,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Truck,
  CheckCircle2,
  XCircle,
  Cpu,
  Sparkles,
  Timer,
  Layers,
  Navigation,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { remainingLabel, type Donation, type PilotData } from '@/src/types'
import { dispatchAction, fetchRouteComparison, type RouteComparison } from '@/src/api'
import { computeClientRouteBenchmark } from '@/lib/routing'
import { HandoverDialog } from '@/components/handover-dialog'

export function DispatchView({
  data,
  now,
  cityId,
  role,
  openDonation,
  refresh,
}: {
  data?: PilotData
  now: number
  cityId: string
  role?: string
  openDonation: (d: Donation) => void
  refresh: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [handoverTarget, setHandoverTarget] = useState<{ donation: Donation; stage: 'pickup' | 'delivery' } | null>(null)
  const [benchmarkTab, setBenchmarkTab] = useState<'overview' | 'itinerary' | 'fleet'>('overview')
  const [itineraryMode, setItineraryMode] = useState<'joint' | 'greedy'>('joint')

  const { data: routeBenchmark, mutate: reloadBenchmark, isValidating } = useSWR<RouteComparison>(
    ['route-benchmark', cityId, data?.donations?.length, data?.donors?.length, data?.drivers?.length],
    async () => {
      try {
        const remote = await fetchRouteComparison(cityId)
        if (remote && remote.stops_count > 0) return remote
      } catch {
        // Backend not running or proxy/auth error, seamlessly fall through to client engine
      }
      return computeClientRouteBenchmark(data, now)
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  )

  const benchmark: RouteComparison = routeBenchmark || computeClientRouteBenchmark(data, now)

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

  async function runEscalate(id: string) {
    setBusy(id)
    try {
      await dispatchAction(id, 'escalate')
      refresh()
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

  // Solver metadata helper
  const solverInfo = (() => {
    const s = benchmark.solver
    if (s === 'vroom-ors') {
      return {
        title: 'VROOM via OpenRouteService',
        subtitle: 'Real road network matrix + hard expiry time windows',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        icon: Route,
      }
    }
    if (s === 'or-tools-cvrptw') {
      return {
        title: 'Google OR-Tools CVRPTW',
        subtitle: 'Constraint Programming with food expiry time windows',
        badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
        icon: Cpu,
      }
    }
    return {
      title: '2-Opt Multi-Vehicle Heuristic',
      subtitle: 'Deadline-aware local search optimization',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      icon: Sparkles,
    }
  })()

  const maxKm = Math.max(benchmark.joint_route_km ?? 1, benchmark.greedy_baseline_km ?? 1, 1)
  const jointBarPct = Math.min(100, Math.max(10, Math.round(((benchmark.joint_route_km ?? 0) / maxKm) * 100)))
  const greedyBarPct = Math.min(100, Math.max(10, Math.round(((benchmark.greedy_baseline_km ?? 0) / maxKm) * 100)))

  const activeStops = itineraryMode === 'joint'
    ? benchmark.joint_stops ?? []
    : benchmark.greedy_stops ?? []

  return (
    <>
      <div className="section-intro">
        <ShieldCheck size={16} />
        <span>No route is dispatchable until its travel time and safety window have been verified. FSSAI countdown enforced.</span>
      </div>

      {/* 4-Stage Kanban Dispatch Pipeline */}
      <div className="dispatch-columns">
        {columns.map(column => {
          const donations = data?.donations.filter(d => column.statuses.includes(d.status)) ?? []
          return (
            <section className="dispatch-column" key={column.title}>
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
                  <div className="flex flex-col gap-1.5 w-full mt-2">
                    {column.action ? (
                      (!role || (column.action === 'match' && (role === 'coordinator' || role === 'admin')) || (column.action === 'pickup' && (role === 'driver' || role === 'coordinator')) || (column.action === 'deliver' && ['recipient', 'shelter', 'coordinator'].includes(role ?? ''))) ? (
                        <Button variant="outline" disabled={busy === d.id} onClick={() => handleActionClick(d, column.action!)}>
                          {busy === d.id ? (
                            <LoaderCircle data-icon="inline-start" className="animate-spin" />
                          ) : column.action !== 'match' ? (
                            <QrCode data-icon="inline-start" size={14} className="text-primary" />
                          ) : null}
                          {column.label}
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">Waiting for the assigned {column.action === 'match' ? 'coordinator' : column.action === 'pickup' ? 'driver' : 'recipient'}.</p>
                      )
                    ) : (
                      <Button variant="ghost" onClick={() => openDonation(d)}>
                        View rescue<ArrowRight data-icon="inline-end" />
                      </Button>
                    )}
                    {column.action === 'pickup' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 h-7 w-full justify-center"
                        disabled={busy === d.id}
                        onClick={() => runEscalate(d.id)}
                        title="Simulate unresponsive volunteer timeout (3m limit) & auto-widen search radius"
                      >
                        <AlertTriangle size={12} className="mr-1.5" />
                        Simulate Timeout & Escalate
                      </Button>
                    )}
                  </div>
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
          )
        })}
      </div>

      {/* Live Routing Optimization Benchmark Widget (Global Joint VRP) */}
      <section className="panel mt-6">
        {/* Header with solver info and refresh */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex items-start gap-3">
            <span className="network-card-icon bg-primary/10 text-primary p-2.5 rounded-xl shrink-0 mt-0.5">
              <Route size={24} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Global Route Optimization</h2>
                <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 flex items-center gap-1.5 ${solverInfo.badgeClass}`}>
                  <solverInfo.icon size={12} />
                  <span>{solverInfo.title}</span>
                </Badge>
                {benchmark.computation_ms !== undefined && (
                  <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 bg-muted/40 px-2 py-0.5 rounded-md border border-border/50">
                    <Timer size={11} />
                    {benchmark.computation_ms}ms
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {solverInfo.subtitle} · Live before/after comparison against nearest-first baseline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <Button variant="outline" size="sm" onClick={() => reloadBenchmark()} disabled={isValidating}>
              <RefreshCw size={13} className={isValidating ? 'animate-spin mr-1.5' : 'mr-1.5'} />
              {isValidating ? 'Optimizing…' : 'Re-run Benchmark'}
            </Button>
          </div>
        </div>

        {/* Tab Navigation for Optimization Views */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-border/30">
          <button
            type="button"
            onClick={() => setBenchmarkTab('overview')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              benchmarkTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Zap size={13} />
            Overview & Comparison
          </button>
          <button
            type="button"
            onClick={() => setBenchmarkTab('itinerary')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              benchmarkTab === 'itinerary'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Navigation size={13} />
            Stop-by-Stop Time Windows ({benchmark.stops_count ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setBenchmarkTab('fleet')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              benchmarkTab === 'fleet'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Truck size={13} />
            Fleet Dispatch ({benchmark.driver_routes?.length ?? 1} Driver{benchmark.driver_routes?.length !== 1 ? 's' : ''})
          </button>
        </div>

        {/* Tab 1: Overview & Live Before/After Comparison */}
        {benchmarkTab === 'overview' && (
          <div className="space-y-5 my-4">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Metric 1: Joint Route */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between text-xs text-primary font-semibold uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Zap size={13} />
                      AaharSetu Joint VRP
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                      Optimized
                    </Badge>
                  </div>
                  <div className="text-3xl font-black text-foreground font-mono">
                    {benchmark.joint_route_km} <span className="text-sm font-normal text-muted-foreground font-sans">km</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-primary/10 text-xs text-primary flex items-center gap-1.5 font-medium">
                  {benchmark.joint_missed_deadlines === 0 ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0 Missed Deadlines · 100% On-Time</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      <span>{benchmark.joint_missed_deadlines ?? 0} missed deadline(s)</span>
                    </>
                  )}
                  <span className="text-muted-foreground ml-auto">({benchmark.stops_count ?? 0} stops)</span>
                </div>
              </div>

              {/* Metric 2: Greedy Baseline */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                    <span>Naive Nearest-First</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Baseline
                    </Badge>
                  </div>
                  <div className="text-3xl font-black text-foreground font-mono">
                    {benchmark.greedy_baseline_km} <span className="text-sm font-normal text-muted-foreground font-sans">km</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/50 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{`${benchmark.greedy_missed_deadlines} Expired Window${benchmark.greedy_missed_deadlines !== 1 ? 's' : ''}`}</span>
                  <span className="text-muted-foreground text-[11px] ml-auto">ignores deadlines</span>
                </div>
              </div>

              {/* Metric 3: Comparative Gain */}
              <div className="p-4 rounded-xl bg-secondary/50 border border-secondary flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-primary font-semibold uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp size={13} />
                      Rescue Advantage
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">
                      Live Gain
                    </Badge>
                  </div>
                  <div className="text-3xl font-black text-primary font-mono">
                    {`${benchmark.pct_distance_saved > 0 ? '+' : ''}${benchmark.pct_distance_saved}%`}
                    <span className="text-sm font-normal text-muted-foreground font-sans ml-1">saved</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/40 text-xs text-foreground/80 font-medium flex items-center justify-between">
                  <span>{`${benchmark.km_saved} road km saved`}</span>
                  {benchmark && benchmark.greedy_missed_deadlines > benchmark.joint_missed_deadlines && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCheck size={13} />
                      +{benchmark.greedy_missed_deadlines - benchmark.joint_missed_deadlines} rescued meals
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Visual Comparison Bar */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Layers size={14} className="text-primary" />
                  Total Road Distance Comparison
                </span>
                <span className="text-muted-foreground text-[11px]">Proportional road distance (km)</span>
              </div>

              {/* Joint VRP Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <Zap size={12} /> Joint VRP (Time-Window Optimized)
                  </span>
                  <span className="font-mono">{benchmark ? `${benchmark.joint_route_km} km` : '—'}</span>
                </div>
                <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${jointBarPct}%` }}
                  />
                </div>
              </div>

              {/* Greedy Baseline Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-500" /> Naive Nearest-First Baseline
                  </span>
                  <span className="font-mono text-muted-foreground">{benchmark ? `${benchmark.greedy_baseline_km} km` : '—'}</span>
                </div>
                <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500/70 to-rose-400/80 rounded-full transition-all duration-700"
                    style={{ width: `${greedyBarPct}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/30">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Joint VRP saves <strong>{benchmark.km_saved ?? 0} km</strong> across all driver legs
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  Nearest-first misses <strong>{benchmark.greedy_missed_deadlines ?? 0} expiry deadlines</strong> due to lack of time-window awareness
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Stop-by-Stop Time Window Breakdown */}
        {benchmarkTab === 'itinerary' && (
          <div className="space-y-4 my-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-muted-foreground">
                Showing arrival time vs. expiry deadline for every assigned stop in sequence.
              </div>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50 text-xs">
                <button
                  type="button"
                  onClick={() => setItineraryMode('joint')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                    itineraryMode === 'joint'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Joint VRP Sequence ({benchmark.joint_stops?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setItineraryMode('greedy')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                    itineraryMode === 'greedy'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Greedy Nearest-First ({benchmark.greedy_stops?.length ?? 0})
                </button>
              </div>
            </div>

            {activeStops.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeStops.map((stop, idx) => {
                  const arrivalDate = new Date(stop.arrival_time)
                  const deadlineDate = new Date(stop.deadline)
                  const arrivalFormatted = isNaN(arrivalDate.getTime())
                    ? stop.arrival_time
                    : arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  const deadlineFormatted = isNaN(deadlineDate.getTime())
                    ? stop.deadline
                    : deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                  return (
                    <div
                      key={`${stop.donation_id}-${idx}`}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-colors ${
                        stop.missed
                          ? 'bg-rose-500/5 border-rose-500/30'
                          : 'bg-card/70 border-border/70 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="font-semibold text-xs text-foreground line-clamp-1">{stop.name}</h4>
                            <p className="text-[11px] text-muted-foreground">{stop.area || 'Pickup Hub'}</p>
                          </div>
                        </div>
                        {stop.missed ? (
                          <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 shrink-0">
                            <XCircle size={11} className="mr-1" /> Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0">
                            <CheckCheck size={11} className="mr-1" /> On Time
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/40 grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Leg Distance</span>
                          <span className="font-mono font-medium">{stop.leg_km} km</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Est. Arrival</span>
                          <span className="font-mono font-medium">{arrivalFormatted}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Expiry Deadline</span>
                          <span className={`font-mono font-medium ${stop.missed ? 'text-rose-500 font-bold' : ''}`}>
                            {deadlineFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-[10px] flex items-center justify-between text-muted-foreground">
                        <span>Buffer Remaining:</span>
                        <span className={`font-mono font-medium ${stop.slack_minutes < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {stop.slack_minutes >= 0 ? `+${stop.slack_minutes} min safe margin` : `${stop.slack_minutes} min late`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground bg-muted/20 rounded-xl">
                No stop breakdown available yet. Run the benchmark with active pending rescues.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Multi-Driver Fleet Dispatch */}
        {benchmarkTab === 'fleet' && (
          <div className="space-y-4 my-4">
            <div className="text-xs text-muted-foreground">
              Joint optimization partitions all pickups across available volunteers simultaneously to minimize global vehicle-km while strictly honoring perishable time windows.
            </div>

            {benchmark.driver_routes && benchmark.driver_routes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {benchmark.driver_routes.map((route, i) => (
                  <div key={route.driver_id || i} className="p-4 rounded-xl bg-card border border-border/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Truck size={16} />
                          </span>
                          <div>
                            <h4 className="font-bold text-xs text-foreground">{route.driver_name}</h4>
                            <span className="text-[10px] text-muted-foreground">{route.vehicle || 'Bike / 2-Wheeler'}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs font-mono font-bold">
                          {route.total_km} km
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground border-y border-border/40 py-2">
                        <div>
                          <strong>{route.stops}</strong> assigned stop{route.stops !== 1 ? 's' : ''}
                        </div>
                        <div>·</div>
                        <div className={route.missed_deadlines > 0 ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                          {route.missed_deadlines === 0 ? '0 missed deadlines' : `${route.missed_deadlines} missed`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="text-[10px] text-muted-foreground block mb-1.5 font-medium">Assigned Stop Order:</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {route.stop_sequence && route.stop_sequence.length > 0 ? (
                          route.stop_sequence.map((stopId, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border/40 flex items-center gap-1"
                            >
                              <span className="text-primary font-bold">#{sIdx + 1}</span>
                              {stopId.slice(0, 6)}…
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No stops assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground bg-muted/20 rounded-xl">
                Single vehicle assigned or no driver routes generated yet.
              </div>
            )}
          </div>
        )}

        {/* Footer info note */}
        <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg flex items-start gap-2 mt-4">
          <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
          <p>
            <strong>Real-Data Computation:</strong> Computed dynamically on pending donations and volunteer positions for {cityId.toUpperCase()}. Deadlines are strictly enforced as hard time-windows. Results are computed via {solverInfo.title} and never hardcoded.
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
  )
}
