import useSWR from 'swr'
import { apiRequest } from './api'

export interface AccountProfile {
  user_id: string
  email?: string
  display_name: string
  role: 'coordinator' | 'donor' | 'driver' | 'recipient' | 'shelter'
  requested_role?: string
  organization?: string
  phone?: string
  fssai_license?: string
  area?: string
  city_id: string
  active_city_id: string
}

export function useProfile(userId?: string) {
  const { data, error, mutate, isLoading } = useSWR<AccountProfile>(
    userId ? ['current-profile', userId] : null,
    () => apiRequest<AccountProfile>('/api/me'),
    { shouldRetryOnError: false },
  )
  return { profile: data, error, refresh: mutate, isLoading }
}
