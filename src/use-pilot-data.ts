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

import { haversineKm } from '@/lib/routing'

function normalizeRecipients(recipients: any[]): Recipient[] {
  return (recipients || []).map(r => ({
    ...r,
    accepts: parseAccepts(r.accepts),
  }))
}

/**
 * Ensures active rescue corridors connect across realistic inter-neighborhood distances (2km - 12km)
 * so that routes wind across the city rather than being hidden underneath overlapping 200m marker pins.
 */
function ensureRealisticCorridors(
  donations: Donation[],
  donors: Donor[],
  recipients: Recipient[]
): Donation[] {
  if (!donations?.length || !recipients?.length || !donors?.length) return donations || []
  const donorMap = new Map(donors.map(d => [d.id, d]))
  const recipMap = new Map(recipients.map(r => [r.id, r]))

  return donations.map((donation, idx) => {
    if (!['matched', 'accepted', 'picked_up'].includes(donation.status)) return donation
    const donor = donorMap.get(donation.donor_id)
    const recipient = donation.recipient_id ? recipMap.get(donation.recipient_id) : null

    if (donor && recipient) {
      const dist = haversineKm(donor.latitude, donor.longitude, recipient.latitude, recipient.longitude)
      if (dist < 0.75) {
        const crossCandidates = recipients.filter(r => {
          const d = haversineKm(donor.latitude, donor.longitude, r.latitude, r.longitude)
          return d >= 2.0 && d <= 12.0
        })
        if (crossCandidates.length > 0) {
          const target = crossCandidates[idx % crossCandidates.length]
          return { ...donation, recipient_id: target.id }
        }
      }
    }
    return donation
  })
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
          if (apiData.donations && apiData.donors && apiData.recipients) {
            apiData.donations = ensureRealisticCorridors(apiData.donations, apiData.donors, apiData.recipients)
          }
          return apiData
        }
      } catch { /* proceed to direct Supabase query */ }

      // 2. Query Supabase PostGIS directly if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const [donorsRes, recipientsRes, driversRes, donationsRes, dispatchRes, recordsRes] = await Promise.all([
            supabase.from('donors').select('id, name, area, latitude, longitude, contact_person, phone, license_no, license_verified, is_synthetic, city_id').eq('city_id', cityId),
            supabase.from('recipients').select('id, name, area, latitude, longitude, demand_kg, accepted_categories, contact_person, phone, city_id, is_synthetic, approved').eq('city_id', cityId),
            supabase.from('drivers').select('id, name, latitude, longitude, availability, vehicle, capacity_kg, telegram_id, reliability, city_id, is_synthetic, user_id').eq('city_id', cityId),
            supabase.from('donations').select('id, donor_id, item, category, qty_kg, prepared_at, temp_c, safe_until, status, recipient_id, driver_id, city_id, is_synthetic, created_at').eq('city_id', cityId).order('created_at', { ascending: false }).limit(200),
            supabase.from('dispatch_events').select('id, donation_id, driver_id, event_type, message, city_id, created_at').eq('city_id', cityId).order('created_at', { ascending: false }).limit(100),
            supabase.from('records').select('id, donation_id, quantity_kg, temperature_c, area, delivered_at, consume_by, city_id, created_at').eq('city_id', cityId).order('delivered_at', { ascending: false }).limit(250),
          ])

          const donors = (donorsRes.data as unknown as Donor[]) ?? []
          const recipients = normalizeRecipients((recipientsRes.data as any[]) ?? [])
          const drivers = (driversRes.data as Driver[]) ?? []
          let donations = (donationsRes.data as Donation[]) ?? []
          const dispatch_events = (dispatchRes.data as DispatchEvent[]) ?? []
          const records = (recordsRes.data as RescueRecord[]) ?? []

          if (donors.length || donations.length || recipients.length) {
            donations = ensureRealisticCorridors(donations, donors, recipients)
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

  // Attach Supabase Realtime WebSocket subscription for zero-reload live sync (scoped by city_id)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      const channelId = `realtime-${cityId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'donations', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_events', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'donors', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recipients', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'handovers', filter: `city_id=eq.${cityId}` }, () => { mutate() })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn(`[Supabase Realtime] Channel error for ${channelId}`)
          }
        })
    } catch (err) {
      console.warn('[Supabase Realtime] Safe fallback - unable to attach realtime listener:', err)
    }

    return () => {
      if (supabase && channel) {
        try {
          supabase.removeChannel(channel)
        } catch (err) {
          console.warn('[Supabase Realtime] Error during channel removal:', err)
        }
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
