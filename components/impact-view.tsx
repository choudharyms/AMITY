import { Download, ExternalLink, FileCheck2, Leaf } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { OverviewMetrics } from '@/components/overview-metrics'
import { number, type PilotData } from '@/src/types'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`
}
export function ImpactView({ data }: { data?: PilotData }) {
  function exportRecords() {
    if (!data?.records.length) { toast.info('No confirmed delivery records to export yet.'); return }
    const rows: unknown[][] = [['Record ID', 'Donation ID', 'Quantity kg', 'Temperature C', 'Area', 'Delivered at', 'Consume by', 'Dataset']]
    data.records.forEach(r => rows.push([r.id, r.donation_id, r.quantity_kg, r.temperature_c, r.area, r.delivered_at, r.consume_by, 'Synthetic pilot']))
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'surplus-pilot-delivery-records.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="flex flex-col gap-6"><OverviewMetrics data={data} /><section className="impact-story"><Leaf size={35} strokeWidth={1.3} /><div><span className="eyebrow">SMALL RESCUES. MEANINGFUL CHANGE.</span><h2>Good food shouldn&apos;t go to waste.</h2><p>Our impact starts with confirmed deliveries. Every number can be traced back to a rescue record.</p></div></section><section className="panel"><div className="panel-header"><h2>Delivery records</h2><Button variant="outline" size="sm" onClick={exportRecords}><Download data-icon="inline-start" />Export CSV</Button></div>{data?.records.length ? <div className="table-scroll"><table className="rescue-table"><thead><tr><th>Donation</th><th>Quantity</th><th>Distribution area</th><th>Delivered</th><th>Dataset</th></tr></thead><tbody>{data.records.map(r => <tr key={r.id}><td>{data.donations.find(d => d.id === r.donation_id)?.item ?? r.donation_id.slice(0, 8)}</td><td>{number(r.quantity_kg)} kg</td><td>{r.area}</td><td>{new Date(r.delivered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td><td><Badge variant="outline">Synthetic</Badge></td></tr>)}</tbody></table></div> : <Empty className="min-h-48"><EmptyHeader><EmptyMedia variant="icon"><FileCheck2 /></EmptyMedia><EmptyTitle>No completed deliveries yet</EmptyTitle><EmptyDescription>A verified handover creates the delivery record and updates these estimates.</EmptyDescription></EmptyHeader></Empty>}</section><section className="panel methodology"><h2>Honest numbers. Visible assumptions.</h2><div><article><h3>Meal equivalents</h3><p>Food delivered × 1.8 meals per kg. An approximate meal-equivalent factor, not a count of people fed.</p></article><article><h3>Estimated emissions avoided</h3><p>Food delivered × 2.5 kg CO₂e per kg. A configurable pilot assumption within the brief&apos;s 0.7–3.6 range; not a lifecycle assessment.</p></article><article><h3>Synthetic pilot, real calculations</h3><p>Seeded records are demonstration inputs. Displayed totals are computed from those records, not evidence of real-world impact.</p></article></div><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6571599/" target="_blank" rel="noreferrer">Read the research reference<ExternalLink size={13} /></a></section></div>
}
