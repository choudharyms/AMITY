export type Section = 'overview' | 'workspaces' | 'donations' | 'dispatch' | 'recipients' | 'drivers' | 'impact' | 'settings'
export type RescueStatus = 'posted' | 'matched' | 'accepted' | 'picked_up' | 'delivered' | 'expired' | 'cancelled'
export type Category = 'cooked_hot' | 'cooked_cold' | 'packaged' | 'produce' | 'bakery'
export interface Donor {
id: string; name: string; area: string; latitude: number; longitude: number;
license_no: string | null; license_verified: boolean; is_synthetic: boolean; city_id?: string;
}
export interface Recipient {
  id: string; name: string; area: string; latitude: number; longitude: number;
  capacity_kg: number; reserved_kg: number; accepts: Category[]; need_level: number;
approved: boolean; is_open: boolean; reliability: number; is_synthetic: boolean;
city_id?: string;
}
export interface Driver {
  id: string; name: string; latitude: number; longitude: number;
availability: boolean; vehicle: string; capacity_kg: number; is_synthetic: boolean;
city_id?: string;
}
export interface Donation {
  id: string; donor_id: string; item: string; category: Category; qty_kg: number;
  prepared_at: string; temp_c: number | null; safe_until: string; status: RescueStatus;
created_at: string; is_synthetic: boolean; recipient_id: string | null; driver_id: string | null;
city_id?: string;
}
export interface DispatchEvent {
  id: string; donation_id: string; event_type: string; message: string; created_at: string;
}
export interface RescueRecord {
  id: string; donation_id: string; quantity_kg: number; temperature_c: number | null;
  area: string; delivered_at: string; consume_by: string;
}
export interface PilotData {
  donors: Donor[]; recipients: Recipient[]; drivers: Driver[]; donations: Donation[];
  dispatch_events: DispatchEvent[]; records: RescueRecord[];
}
export const categoryLabels: Record<Category, string> = {
  cooked_hot: 'Hot meals', cooked_cold: 'Chilled food', packaged: 'Packaged food', produce: 'Fresh produce', bakery: 'Bakery',
}
export const statusLabels: Record<RescueStatus, string> = {
  posted: 'Awaiting match', matched: 'Matched', accepted: 'Driver assigned', picked_up: 'In transit', delivered: 'Delivered', expired: 'Window closed', cancelled: 'Cancelled',
}
export const isActive = (donation: Donation) => !['delivered', 'expired', 'cancelled'].includes(donation.status)
export function remainingLabel(date: string, now: number) {
  const minutes = Math.max(0, Math.ceil((new Date(date).getTime() - now) / 60000))
  if (minutes === 0) return 'Window closed'
  return minutes < 60 ? `${minutes}m left` : `${Math.floor(minutes / 60)}h ${minutes % 60}m left`
}
export const number = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value)

export function parseAccepts(raw: unknown): Category[] {
  if (Array.isArray(raw)) return raw as Category[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as Category[]
      if (typeof parsed === 'string') return [parsed as Category]
    } catch {
      return raw.split(',').map(s => s.trim()) as Category[]
    }
  }
  return ['cooked_hot', 'cooked_cold', 'packaged', 'produce', 'bakery']
}
