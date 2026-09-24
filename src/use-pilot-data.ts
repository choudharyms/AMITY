import { useEffect } from 'react'
import useSWR from 'swr'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { apiRequest } from './api'
import { buildSeed } from './seed'
import { parseAccepts, type Donor, type Driver, type Recipient, type Donation, type DispatchEvent, type RescueRecord, type PilotData } from './types'

export interface BackendHealth {
  ok: boolean
  database: 'supabase' | 'unavailable'
  routing: 'ors' | 'unavailable'
  gemini: boolean
  telegram: boolean
  telegram_target: boolean
  web_push?: boolean
  web_push_subscribers?: number
  deployed: string
  cities: number
}

function normalizeRecipients(recipients: any[]): Recipient[] {
  return (recipients || []).map(r => ({
    ...r,
    accepts: parseAccepts(r.accepts),
  }))
}

export function usePilotData(cityId: string) {
  const { data, error, isLoading, mutate } = useSWR<PilotData>(
    ['pilot-data', cityId, isSupabaseConfigured],
    async () => {
      // 1. Try FastAPI backend API first
      try {
        const apiData = await apiRequest<PilotData>(`/api/pilot-data?city_id=${encodeURIComponent(cityId)}`)
        if (apiData && (apiData.donors || apiData.donations)) {
          if (apiData.recipients) {
            apiData.recipients = normalizeRecipients(apiData.recipients)
          }
          return apiData
        }
      } catch { /* proceed to direct Supabase query */ }

      // 2. Query Supabase PostGIS directly if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const [donorsRes, recipientsRes, driversRes, donationsRes, dispatchRes, recordsRes] = await Promise.all([
            supabase.from('donors').select('*').eq('city_id', cityId),
            supabase.from('recipients').select('*').eq('city_id', cityId),
            supabase.from('drivers').select('*').eq('city_id', cityId),
            supabase.from('donations').select('*').eq('city_id', cityId),
            supabase.from('dispatch_events').select('*').eq('city_id', cityId),
            supabase.from('records').select('*').eq('city_id', cityId),
          ])

          const donors = (donorsRes.data as Donor[]) ?? []
          const recipients = normalizeRecipients((recipientsRes.data as any[]) ?? [])
          const drivers = (driversRes.data as Driver[]) ?? []
          const donations = (donationsRes.data as Donation[]) ?? []
          const dispatch_events = (dispatchRes.data as DispatchEvent[]) ?? []
          const records = (recordsRes.data as RescueRecord[]) ?? []

          if (donors.length || donations.length || recipients.length) {
            return { donors, recipients, drivers, donations, dispatch_events, records }
          }
        } catch { /* proceed to fallback */ }
      }

      // 3. Fallback to local pilot dataset
      return cityId === 'blr'
        ? buildSeed()
        : { donors: [], recipients: [], drivers: [], donations: [], dispatch_events: [], records: [] }
    },
    { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 5000 },
  )

  // Attach Supabase Realtime WebSocket subscription for zero-reload live sync
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    const channelId = `realtime-${cityId}-${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => { mutate() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_events' }, () => { mutate() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => { mutate() })
      .subscribe()

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [cityId, mutate])

  const effectiveData = data ?? (cityId === 'blr' ? buildSeed() : { donors: [], recipients: [], drivers: [], donations: [], dispatch_events: [], records: [] })

  return {
    data: effectiveData,
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
