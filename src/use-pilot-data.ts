import useSWR from 'swr'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { buildSeed } from './seed'
import type { DispatchEvent, Donation, Donor, Driver, PilotData, Recipient, RescueRecord } from './types'

interface PilotResult {
  data: PilotData
  source: 'supabase' | 'offline'
}

async function query<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase!.from(table).select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as T[]
}

export interface BackendHealth {
  ok: boolean
  routing: 'ors' | 'haversine'
  gemini: boolean
  telegram: boolean
  deployed: string
  message?: string
}

export function usePilotData() {
  const { data, error, isLoading, mutate } = useSWR<PilotResult>(
    ['pilot-data', isSupabaseConfigured ? 'supabase' : 'offline'],
    async () => {
      if (!isSupabaseConfigured || !supabase) {
        return { data: buildSeed(), source: 'offline' as const }
      }
      try {
        const [donors, recipients, drivers, donations, dispatch_events, records] = await Promise.all([
          query<Donor>('donors'),
          query<Recipient>('recipients'),
          query<Driver>('drivers'),
          query<Donation>('donations'),
          query<DispatchEvent>('dispatch_events'),
          query<RescueRecord>('records'),
        ])
        if (!donors.length && !donations.length) {
          return { data: buildSeed(), source: 'offline' as const }
        }
        return { data: { donors, recipients, drivers, donations, dispatch_events, records }, source: 'supabase' as const }
      } catch {
        return { data: buildSeed(), source: 'offline' as const }
      }
    },
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 30000, fallbackData: { data: buildSeed(), source: 'offline' } },
  )
  return { data: data?.data ?? buildSeed(), source: data?.source ?? 'offline', error, isLoading, refresh: mutate }
}

export function useBackendHealth() {
  const { data } = useSWR<BackendHealth>('/api/health', async (path) => {
    try {
      const res = await fetch(path)
      if (!res.ok) throw new Error('Backend unreachable')
      return await res.json()
    } catch {
      return { ok: false, routing: 'haversine' as const, gemini: false, telegram: false, deployed: 'offline', message: 'FastAPI backend is not running' }
    }
  }, { revalidateOnFocus: true, dedupingInterval: 15000 })
  return data
}