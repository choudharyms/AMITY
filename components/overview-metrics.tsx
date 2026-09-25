import { memo, useMemo } from 'react'
import { ArrowUpRight, Leaf, PackageCheck, Route, Utensils } from 'lucide-react'
import { isActive, number, type PilotData } from '@/src/types'

export const OverviewMetrics = memo(function OverviewMetrics({ data }: { data?: PilotData }) {
  const kg = useMemo(() => data?.records.reduce((sum, record) => sum + Number(record.quantity_kg), 0), [data?.records])
  const active = useMemo(() => data?.donations.filter(isActive).length, [data?.donations])
  const availableDrivers = useMemo(() => data?.drivers.filter(d => d.availability).length, [data?.drivers])

  const values = [
    { label: 'Food rescued', value: kg === undefined ? '—' : number(kg), unit: 'kg', icon: PackageCheck, foot: 'Verified delivery records', tone: 'green' },
    { label: 'Meals made possible', value: kg === undefined ? '—' : number(Math.round(kg * 1.8)), unit: 'meals', icon: Utensils, foot: 'Estimate · 1.8 meals / kg', tone: 'lime' },
    { label: 'Active rescues', value: active === undefined ? '—' : number(active), unit: 'in progress', icon: Route, foot: data ? `${availableDrivers} volunteers available` : 'Waiting for rescue records', tone: 'sand' },
    { label: 'CO₂e avoided', value: kg === undefined ? '—' : number(kg * 2.5), unit: 'kg', icon: Leaf, foot: 'Estimate · 2.5 kg CO₂e / kg', tone: 'green' },
  ]
  return <section className="metric-grid" aria-label="Rescue statistics">{values.map(metric => <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className={`metric-icon ${metric.tone}`}><metric.icon size={18} strokeWidth={1.65} /></span></div><div className="metric-value">{metric.value}<span>{metric.unit}</span></div><div className="metric-bottom"><span>{metric.foot}</span><ArrowUpRight size={13} /></div></article>)}</section>
})
