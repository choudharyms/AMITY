import { Check, Globe, MapPin, Radio, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cities, type City } from '@/src/cities'
import type { PilotData } from '@/src/types'
import { toast } from 'sonner'

export function WorkspacesView({
  cityId,
  onCityChange,
  data,
  source,
}: {
  cityId: string
  onCityChange: (cityId: string) => void
  data?: PilotData
  source?: 'supabase' | 'offline' | 'unavailable'
}) {
  const currentCity = cities.find(c => c.id === cityId) ?? cities[0]

  function handleSelect(city: City) {
    if (city.id === cityId) return
    onCityChange(city.id)
    toast.success(`Switched to ${city.name} workspace network`)
  }

  return (
    <div className="space-y-6">
      {/* Active Workspace Hero Card */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-xl border border-emerald-700/50 text-white"
        style={{
          background: 'linear-gradient(135deg, #022c22 0%, #064e3b 45%, #0f172a 100%)',
          backgroundColor: '#022c22',
        }}
      >
        {/* Decorative ambient background glows & grid */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-emerald-300 border-emerald-500/40 bg-emerald-900/60 backdrop-blur-sm px-3 py-1 font-semibold text-xs shadow-xs">
                <Radio size={12} className="animate-pulse mr-1.5 text-emerald-400" />
                Active Rescue Workspace
              </Badge>
              <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white/95 border border-white/15 backdrop-blur-sm px-2.5 py-1 text-xs">
                <ShieldCheck size={12} className="mr-1 text-emerald-300" />
                {source === 'supabase' ? 'Authenticated Supabase Live' : 'Demonstration Pilot'}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 shadow-inner shrink-0">
                <MapPin size={26} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white font-display">
                  {currentCity.name}, <span className="text-emerald-400 font-semibold">{currentCity.state}</span>
                </h2>
                <span className="text-xs text-emerald-200/70 font-mono">Region Code: {currentCity.id.toUpperCase()}</span>
              </div>
            </div>

            <p className="text-emerald-100/90 text-xs sm:text-sm leading-relaxed max-w-xl">
              All live dispatch routing, donor intake, recipient capacity allocations, and volunteer logs are scoped to this municipal operational zone.
            </p>
          </div>

          {/* Workspace Telemetry Card */}
          <div className="w-full lg:w-auto shrink-0 bg-black/45 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 shadow-md space-y-3 min-w-[280px]">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} /> Zone Telemetry
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Globe size={13} className="text-emerald-400 shrink-0" /> Coordinates
                </span>
                <span className="font-mono text-emerald-300 font-semibold text-[11px]">
                  {currentCity.latitude.toFixed(4)}° N, {currentCity.longitude.toFixed(4)}° E
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Timezone</span>
                <span className="font-mono text-white/90 text-[11px]">{currentCity.timezone}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Registered Nodes</span>
                <span className="text-emerald-300 font-semibold text-[11px]">
                  {data ? `${data.donors.length} Donors · ${data.recipients.length} Shelters` : 'City-scoped'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Municipal Workspaces Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Available City Workspaces</h3>
            <p className="text-xs text-muted-foreground">Select a city network to switch dispatch, inventory, and volunteer driver operations.</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {cities.length} Municipal Networks
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cities.map((city) => {
            const isActive = city.id === cityId
            return (
              <div
                key={city.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 shadow-sm ring-1 ring-emerald-500/30'
                    : 'border-border/80 hover:border-primary/50 hover:shadow-md bg-card/80'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-muted text-muted-foreground'}`}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{city.name}</h4>
                        <span className="text-xs text-muted-foreground">{city.state}</span>
                      </div>
                    </div>
                    {isActive ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[10px] shadow-xs">
                        <Check size={11} strokeWidth={2.5} /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Ready
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs space-y-1.5 text-muted-foreground pt-2.5 border-t border-border/50">
                    <div className="flex justify-between">
                      <span>Coordinates:</span>
                      <span className="font-mono text-[11px] text-foreground font-medium">{city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Timezone:</span>
                      <span className="text-foreground text-[11px]">{city.timezone}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3">
                  {isActive ? (
                    <Button variant="outline" size="sm" className="w-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40" disabled>
                      Current Active Network
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs font-medium hover:bg-primary hover:text-primary-foreground group transition-all"
                      onClick={() => handleSelect(city)}
                    >
                      Switch to {city.name} <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Network Governance Notice */}
      <section className="p-4 rounded-xl bg-muted/40 border border-border/70 text-xs text-muted-foreground flex items-center gap-3">
        <ShieldCheck size={20} className="text-primary shrink-0" />
        <div>
          <strong className="text-foreground font-medium">Multi-City Data Isolation:</strong> Each municipal workspace enforces database-level Row Level Security (RLS) partition by city ID. Donors, shelters, and volunteer drivers only see operational records matching their assigned territory.
        </div>
      </section>
    </div>
  )
}
