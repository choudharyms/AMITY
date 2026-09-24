import { ArrowRight, Check, CircleDot, HeartHandshake, Radio, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { PilotData, Section } from '@/src/types'

export function ActivityFeed({ data, navigate }: { data?: PilotData; navigate: (section: Section) => void }) {
  const events = data?.dispatch_events.slice(0, 4) ?? []
  const available = data?.recipients.filter(r => r.approved && r.is_open && r.capacity_kg > r.reserved_kg).length
  return <aside className="activity-column"><section className="panel activity-panel"><div className="panel-header"><h2>On the ground</h2><Radio size={16} className="text-primary" /></div>{events.length ? <ol className="activity-list">{events.map(event => <li key={event.id}><span className={event.event_type === 'delivered' ? 'activity-icon delivered' : 'activity-icon'}>{event.event_type === 'delivered' ? <Check size={14} /> : <CircleDot size={14} />}</span><div><p>{event.message}</p><span>{new Date(event.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST <i>·</i> Pilot event</span></div></li>)}</ol> : <Empty className="min-h-48"><EmptyHeader><EmptyMedia variant="icon"><Radio /></EmptyMedia><EmptyTitle>Ready for the first update</EmptyTitle><EmptyDescription>Dispatch and delivery events will appear here as they happen.</EmptyDescription></EmptyHeader></Empty>}<div className="activity-footer"><Button variant="ghost" size="sm" onClick={() => navigate('dispatch')}>Open dispatch board<ArrowRight data-icon="inline-end" /></Button></div></section>
    <section className="capacity-card"><div className="flex items-center justify-between"><span className="capacity-icon"><HeartHandshake size={20} strokeWidth={1.6} /></span><Badge variant="outline">Recipient network</Badge></div><div className="capacity-value">{available ?? '—'}<span>ready to receive</span></div><p>Match good food with an open door.</p><button onClick={() => navigate('recipients')}>View recipient capacity<ArrowRight size={15} /></button></section>
    <p className="safety-footnote"><ShieldCheck size={14} />Safety before speed. Always.</p>
  </aside>
}
