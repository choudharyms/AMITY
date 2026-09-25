import { useEffect } from 'react'
import useSWR from 'swr'
import { apiRequest } from './api'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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
    async () => {
      // 1. Try FastAPI endpoint first
      try {
        const p = await apiRequest<AccountProfile>('/api/me')
        if (p && p.user_id) return p
      } catch { /* proceed to direct Supabase query */ }

      // 2. Query Supabase directly
      if (isSupabaseConfigured && supabase && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (profile) return profile as AccountProfile
      }
      throw new Error('Profile not found')
    },
    { shouldRetryOnError: false, revalidateOnFocus: true },
  )

  // Realtime subscription for immediate profile & role updates
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) return

    const channel = supabase
      .channel(`profile-rt-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new && (payload.new as any).user_id) {
            mutate(payload.new as AccountProfile, false)
          } else {
            mutate()
          }
        },
      )
      .subscribe()

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId, mutate])

  return { profile: data, error, refresh: mutate, isLoading }
}
