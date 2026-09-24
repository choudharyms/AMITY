import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

async function request(path: string, init: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch { /* keep status text */ }
    throw new Error(detail)
  }
  return res.json()
}

export interface DonationIntent {
  donor_id: string
  item: string
  category: string
  qty_kg: number
  prepared_at: string
  temp_c: number | null
  safe_until: string
  source_text?: string
}

export async function createDonation(payload: DonationIntent): Promise<{ id: string; source: 'backend' | 'supabase' }> {
  try {
    const posted = await request('/api/donations', { method: 'POST', body: JSON.stringify(payload) })
    toast.success('Donation posted. Matching will pick it up shortly.')
    return { id: posted.id, source: 'backend' }
  } catch (error) {
    if (!isSupabaseConfigured || !supabase) {
      toast.error(`Backend unavailable: ${error instanceof Error ? error.message : 'no connection'}`)
      throw error
    }
    const { data, error: insertError } = await supabase
      .from('donations')
      .insert({ ...payload, status: 'posted', is_synthetic: false })
      .select('id')
      .single()
    if (insertError) {
      toast.error(`Could not post donation: ${insertError.message}`)
      throw insertError
    }
    toast.success('Donation saved directly to the database.')
    return { id: (data as { id: string } | null)?.id ?? 'new', source: 'supabase' }
  }
}

export async function dispatchAction(id: string, action: 'match' | 'pickup' | 'deliver'): Promise<void> {
  try {
    await request(`/api/donations/${id}/${action}`, { method: 'POST', body: '{}' })
    toast.success(action === 'match' ? 'Route checked and rescue matched.' : action === 'pickup' ? 'Pickup confirmed.' : 'Delivery verified. Impact updated.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Action failed')
    throw error
  }
}