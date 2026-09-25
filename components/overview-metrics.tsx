import { memo, useMemo } from 'react'
import { ArrowUpRight, Leaf, PackageCheck, Route, Utensils } from 'lucide-react'
import { isActive, number, type PilotData, type Section } from '@/src/types'
import { toast } from 'sonner'

export interface OverviewMetricsProps {
  data?: PilotData
  onNavigate?: (section: Section) => void
}

interface MetricItem {
  id: string
  label: string
  value: string
  unit: string
  icon: typeof PackageCheck
  foot: string
  tone: 'green' | 'lime' | 'sand'
  targetSection: Section
  actionTitle: string
}

export const OverviewMetrics = memo(function OverviewMetrics({
  data,
  onNavigate,
}: OverviewMetricsProps) {
  const kg = useMemo(() => data?.records.reduce((sum, record) => sum + Number(record.quantity_kg), 0), [data?.records])
  const active = useMemo(() => data?.donations.filter(isActive).length, [data?.donations])
  const availableDrivers = useMemo(() => data?.drivers.filter(d => d.availability).length, [data?.drivers])

  const values: MetricItem[] = [
    {
      id: 'food-rescued',
      label: 'Food rescued',
      value: kg === undefined ? '—' : number(kg),
      unit: 'kg',
      icon: PackageCheck,
      foot: 'Verified delivery records',
      tone: 'green',
      targetSection: 'impact',
      actionTitle: 'view verified delivery records in Impact Analytics',
    },
    {
      id: 'meals-made',
      label: 'Meals made possible',
      value: kg === undefined ? '—' : number(Math.round(kg * 1.8)),
      unit: 'meals',
      icon: Utensils,
      foot: 'Estimate · 1.8 meals / kg',
      tone: 'lime',
      targetSection: 'impact',
      actionTitle: 'view nutritional impact and meal metrics in Impact Analytics',
    },
    {
      id: 'active-rescues',
      label: 'Active rescues',
      value: active === undefined ? '—' : number(active),
      unit: 'in progress',
      icon: Route,
      foot: data ? `${availableDrivers} volunteers available` : 'Waiting for rescue records',
      tone: 'sand',
      targetSection: 'dispatch',
      actionTitle: 'open live dispatch board & active rescue operations',
    },
    {
      id: 'co2e-avoided',
      label: 'CO₂e avoided',
      value: kg === undefined ? '—' : number(kg * 2.5),
      unit: 'kg',
      icon: Leaf,
      foot: 'Estimate · 2.5 kg CO₂e / kg',
      tone: 'green',
      targetSection: 'impact',
      actionTitle: 'view environmental impact and emissions ledger in Impact Analytics',
    },
  ]

  const handleCardClick = (metric: MetricItem) => {
    if (onNavigate) {
      onNavigate(metric.targetSection)
      toast.info(`Opening ${metric.targetSection === 'impact' ? 'Municipal Impact Analytics' : 'Dispatch Operations'} (${metric.label})`)
    }
  }

  return (
    <section className="metric-grid" aria-label="Rescue statistics">
      {values.map(metric => (
        <article
          className="metric-card cursor-pointer group"
          key={metric.label}
          role="button"
          tabIndex={0}
          aria-label={`${metric.label}: ${metric.value} ${metric.unit}. ${metric.foot}. Click to ${metric.actionTitle}`}
          title={`Click to ${metric.actionTitle}`}
          onClick={() => handleCardClick(metric)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCardClick(metric)
            }
          }}
        >
          <div className="metric-top">
            <span>{metric.label}</span>
            <span className={`metric-icon ${metric.tone}`}>
              <metric.icon size={18} strokeWidth={1.65} />
            </span>
          </div>
          <div className="metric-value">
            {metric.value}
            <span>{metric.unit}</span>
          </div>
          <div className="metric-bottom">
            <span>{metric.foot}</span>
            <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </div>
        </article>
      ))}
    </section>
  )
})
