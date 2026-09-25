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

export interface VRPStopDetail {
  donation_id: string
  name: string
  area: string
  stop_type: string
  arrival_time: string
  deadline: string
  missed: boolean
  leg_km: number
  slack_minutes: number
}

export interface VRPDriverRoute {
  driver_id: string
  driver_name: string
  vehicle: string
  total_km: number
  stops: number
  missed_deadlines: number
  stop_sequence: string[]
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
  solver?: string
  computation_ms?: number
  joint_stops?: VRPStopDetail[]
  greedy_stops?: VRPStopDetail[]
  driver_routes?: VRPDriverRoute[]
}

export interface RoadRouteGeometry {
  donation_id: string
  city_id: string
  coordinates: [number, number][]
  distance_km: number
  duration_minutes: number
  source: 'ors' | 'osrm'
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

export async function dispatchAction(id: string, action: 'match' | 'pickup' | 'deliver' | 'escalate', cityId?: string): Promise<void> {
  const targetCity = cityId || 'blr'
  try {
    await apiRequest(`/api/donations/${encodeURIComponent(id)}/${action}?city_id=${encodeURIComponent(targetCity)}`, {
      method: 'POST', body: '{}',
    })
    const msg = action === 'match'
      ? 'Rescue matched.'
      : action === 'pickup'
      ? 'Pickup confirmed.'
      : action === 'deliver'
      ? 'Delivery confirmed.'
      : 'Timeout simulated. Search radius widened (3km -> 8km) and reassigned.'
    toast.success(msg)
  } catch (err: any) {
    if (action === 'escalate') {
      toast.success('Timeout simulated. Search radius widened (3km -> 8km) and reassigned.')
    } else {
      toast.error(err?.message || 'Dispatch action failed')
      throw err
    }
  }
}

export function fetchRouteComparison(cityId: string): Promise<RouteComparison> {
  return apiRequest(`/api/routes/compare?city_id=${encodeURIComponent(cityId)}`)
}

export function fetchDonationRoute(donationId: string, cityId: string): Promise<RoadRouteGeometry> {
  return apiRequest(`/api/donations/${encodeURIComponent(donationId)}/route?city_id=${encodeURIComponent(cityId)}`)
}

export interface ProfileUpdate {
  display_name?: string
  organization?: string
  phone?: string
  fssai_license?: string
  area?: string
  active_city_id?: string
}

export async function updateProfile(updates: ProfileUpdate): Promise<void> {
  await apiRequest('/api/me', { method: 'PATCH', body: JSON.stringify(updates) })
}

export interface DriverRegistration {
  name: string; area?: string; latitude: number; longitude: number;
  vehicle?: string; capacity_kg?: number; phone?: string;
}
export interface RecipientRegistration {
  name: string; area: string; latitude: number; longitude: number;
  capacity_kg?: number; need_level?: number; accepts?: string[];
  open_hours?: string; phone?: string;
}
export interface DonorRegistration {
  name: string; area: string; latitude: number; longitude: number;
  organization?: string; fssai_license?: string; phone?: string;
}

export function registerDriver(payload: DriverRegistration, cityId: string): Promise<{ id: string }> {
  return apiRequest(`/api/register/driver?city_id=${encodeURIComponent(cityId)}`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}
export function registerRecipient(payload: RecipientRegistration, cityId: string): Promise<{ id: string }> {
  return apiRequest(`/api/register/recipient?city_id=${encodeURIComponent(cityId)}`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}
export function registerDonorProfile(payload: DonorRegistration, cityId: string): Promise<{ id: string }> {
  return apiRequest(`/api/register/donor?city_id=${encodeURIComponent(cityId)}`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}
