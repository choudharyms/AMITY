import { useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Boxes, Clock3, Plus, Search, SlidersHorizontal, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { categoryLabels, isActive, number, remainingLabel, statusLabels, type Donation, type PilotData } from '@/src/types'

export function DonationsTable({ data, now, full = false, openDonation, viewAll, onPostDonation }: { data?: PilotData; now: number; full?: boolean; openDonation: (donation: Donation) => void; viewAll: () => void; onPostDonation?: () => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('active')
  const donations = useMemo(() => {
    return [...(data?.donations ?? [])].filter(d => {
      const donor = data?.donors.find(p => p.id === d.donor_id)
      return (filter === 'all' || (filter === 'active' ? isActive(d) : d.status === filter)) && `${d.item} ${donor?.name ?? ''} ${donor?.area ?? ''}`.toLowerCase().includes(query.toLowerCase())
    }).sort((a, b) => new Date(a.safe_until).getTime() - new Date(b.safe_until).getTime())
  }, [data?.donations, data?.donors, filter, query])
  const visible = useMemo(() => full ? donations : donations.slice(0, 4), [full, donations])
  return <section className="panel donation-panel"><div className="panel-header"><div className="flex items-center gap-2"><h2>{full ? 'Donation directory' : 'Active donations'}</h2>{data && <Badge variant="secondary">{donations.length}</Badge>}</div><div className="flex items-center gap-2">{full && onPostDonation && <Button size="sm" onClick={onPostDonation} className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs font-semibold shadow-sm"><Plus size={13} className="mr-1" />Post a food donation</Button>}{!full && <Button variant="ghost" size="sm" onClick={viewAll}>View all <ArrowRight data-icon="inline-end" /></Button>}</div></div>
    <div className="table-toolbar">
      <label className="search-box"><Search size={16} /><span className="sr-only">Search donations</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search donations or donors…" /></label>
      <div className="filter-select-wrapper flex items-center gap-1.5">
        <SlidersHorizontal size={14} className="text-muted-foreground shrink-0" />
        <Select value={filter} onValueChange={(val) => { if (val) setFilter(val) }}>
          <SelectTrigger size="sm" className="h-8.5 min-w-[145px] text-xs bg-background/90 border-input shadow-2xs font-medium">
            <SelectValue placeholder="Filter donations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active rescues</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="expired">Window closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="table-scroll"><table className="rescue-table"><thead><tr><th>Donation</th><th>Quantity</th><th><span className="flex items-center gap-1">Safe window<ArrowDown size={11} /></span></th><th>Status</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{visible.map(d => {
      const donor = data?.donors.find(p => p.id === d.donor_id)
      const urgent = isActive(d) && new Date(d.safe_until).getTime() - now < 3600000
      return <tr key={d.id}><td><div className="donation-name"><span className="food-icon"><Store size={19} strokeWidth={1.5} /></span><div><button onClick={() => openDonation(d)}>{d.item}</button><small>{donor?.name ?? 'Donor'} <span>·</span> {donor?.area ?? categoryLabels[d.category]}</small></div></div></td><td><strong>{number(d.qty_kg)}</strong><span className="unit"> kg</span></td><td><span className={urgent ? 'countdown urgent' : 'countdown'}><Clock3 size={13} />{d.status === 'delivered' ? 'Delivered safely' : remainingLabel(d.safe_until, now)}</span></td><td><Badge variant={d.status === 'posted' ? 'outline' : d.status === 'expired' ? 'destructive' : 'secondary'}>{statusLabels[d.status]}</Badge></td><td><Button variant="ghost" size="icon-sm" onClick={() => openDonation(d)} aria-label={`View ${d.item}`}><ArrowUpRightIcon /></Button></td></tr>
    })}</tbody></table></div>
    {!visible.length && <Empty className="min-h-40"><EmptyHeader><EmptyMedia variant="icon"><Boxes /></EmptyMedia><EmptyTitle>{data ? 'No donations in this view' : 'Your next rescue starts here'}</EmptyTitle><EmptyDescription>{data ? 'Try a different search or status filter.' : 'Pilot donations will appear after the database setup is approved. No activity or results are fabricated.'}</EmptyDescription></EmptyHeader></Empty>}
    <div className="table-footer"><span>{data ? `Showing ${visible.length} of ${donations.length} donations` : 'Pilot data not loaded'}</span><span><ShieldIcon />Safety windows checked before matching</span></div>
  </section>
}
function ArrowUpRightIcon() { return <ArrowRight /> }
function ShieldIcon() { return <Clock3 size={12} /> }
