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
      <section className="panel p-6 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-xl shadow-sm border border-emerald-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-300 border-emerald-700 bg-emerald-900/50">
                <Radio size={12} className="animate-pulse mr-1 text-emerald-400" />
                Active Rescue Workspace
              </Badge>
              <Badge variant="secondary" className="bg-white/10 text-white border-0">
                {source === 'supabase' ? 'Authenticated Supabase Live' : 'Demonstration Pilot'}
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              {currentCity.name}, {currentCity.state}
            </h2>
            <p className="text-emerald-200/80 text-xs md:text-sm max-w-xl">
              All live dispatch routing, donor intake, recipient capacity allocations, and volunteer logs are scoped to this municipal operational zone.
            </p>
          </div>
          <div className="flex flex-wrap md:flex-col gap-2 text-xs text-emerald-200/90 bg-black/20 p-3 rounded-lg border border-white/10">
            <div><strong>Coordinates:</strong> {currentCity.latitude}° N, {currentCity.longitude}° E</div>
            <div><strong>Timezone:</strong> {currentCity.timezone}</div>
            <div><strong>Registered Nodes:</strong> {data ? `${data.donors.length} Donors · ${data.recipients.length} Shelters` : 'City-scoped'}</div>
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
                className={`panel p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/20'
                    : 'hover:border-slate-300 hover:shadow-sm bg-card'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{city.name}</h4>
                        <span className="text-xs text-muted-foreground">{city.state}</span>
                      </div>
                    </div>
                    {isActive ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[10px]">
                        <Check size={11} strokeWidth={2.5} /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Ready
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/60">
                    <div className="flex justify-between">
                      <span>Coordinates:</span>
                      <span className="font-mono text-[11px] text-foreground">{city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Timezone:</span>
                      <span className="text-foreground">{city.timezone}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3">
                  {isActive ? (
                    <Button variant="outline" size="sm" className="w-full text-xs text-emerald-700 border-emerald-300 bg-emerald-50/50" disabled>
                      Current Active Network
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs hover:bg-primary hover:text-primary-foreground group"
                      onClick={() => handleSelect(city)}
                    >
                      Switch to {city.name} <ArrowRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Network Governance Notice */}
      <section className="panel p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-3">
        <ShieldCheck size={20} className="text-primary shrink-0" />
        <div>
          <strong className="text-foreground font-medium">Multi-City Data Isolation:</strong> Each municipal workspace enforces database-level Row Level Security (RLS) partition by city ID. Donors, shelters, and volunteer drivers only see operational records matching their assigned territory.
        </div>
      </section>
    </div>
  )
}
