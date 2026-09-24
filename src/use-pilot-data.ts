import useSWR from 'swr'
import { isSupabaseConfigured } from '@/lib/supabase'
import { apiRequest } from './api'
import { buildSeed } from './seed'
import type { PilotData } from './types'

export interface BackendHealth {
  ok: boolean
  database: 'supabase' | 'unavailable'
  routing: 'ors' | 'unavailable'
  gemini: boolean
  telegram: boolean
  telegram_target: boolean
  deployed: string
  cities: number
}

export function usePilotData(cityId: string) {
  const { data, error, isLoading, mutate } = useSWR<PilotData>(
    ['pilot-data', cityId, isSupabaseConfigured],
    async () => {
      if (!isSupabaseConfigured) return cityId === 'blr'
        ? buildSeed()
        : { donors: [], recipients: [], drivers: [], donations: [], dispatch_events: [], records: [] }
      return apiRequest<PilotData>(`/api/pilot-data?city_id=${encodeURIComponent(cityId)}`)
    },
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 15000 },
  )
  return {
    data: isSupabaseConfigured ? data : (data ?? (cityId === 'blr' ? buildSeed() : { donors: [], recipients: [], drivers: [], donations: [], dispatch_events: [], records: [] })),
    source: isSupabaseConfigured ? (data ? 'supabase' as const : 'unavailable' as const) : 'offline' as const,
    error,
    isLoading,
    refresh: mutate,
  }
}

export function useBackendHealth() {
  const { data } = useSWR<BackendHealth>('/api/health', path => apiRequest<BackendHealth>(path, {}, false), {
    revalidateOnFocus: true,
    dedupingInterval: 15000,
    shouldRetryOnError: false,
  })
  return data
}
