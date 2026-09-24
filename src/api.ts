import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Category } from './types'

export interface DonationIntent {
  city_id: string
  donor_id: string
  item: string
  category: Category
  qty_kg: number
  prepared_at: string
  temp_c: number | null
  source_text?: string
}

export interface RouteComparison {
  joint_route_km: number
  greedy_baseline_km: number
  km_saved: number
  pct_distance_saved: number
  joint_missed_deadlines: number
  greedy_missed_deadlines: number
  stops_count: number
  computed_at: string
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (authenticated) {
    if (!supabase) throw new Error('Account service is not configured.')
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error('Could not confirm your sign-in. Please sign in again.')
    if (!data.session?.access_token) throw new Error('Sign in to continue.')
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  const res = await fetch(path, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText || 'Request failed'
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body)
    } catch { /* use the HTTP status text */ }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export async function createDonation(payload: DonationIntent): Promise<{ id: string }> {
  const { city_id, ...body } = payload
  const posted = await apiRequest<{ id: string }>(`/api/donations?city_id=${encodeURIComponent(city_id)}`, {
    method: 'POST', body: JSON.stringify(body),
  })
  toast.success('Donation saved to the live rescue network.')
  return posted
}

export async function dispatchAction(id: string, action: 'match' | 'pickup' | 'deliver', cityId: string): Promise<void> {
  await apiRequest(`/api/donations/${encodeURIComponent(id)}/${action}?city_id=${encodeURIComponent(cityId)}`, {
    method: 'POST', body: '{}',
  })
  toast.success(action === 'match' ? 'Rescue matched.' : action === 'pickup' ? 'Pickup confirmed.' : 'Delivery confirmed.')
}

export function fetchRouteComparison(cityId: string): Promise<RouteComparison> {
  return apiRequest(`/api/routes/compare?city_id=${encodeURIComponent(cityId)}`)
}
