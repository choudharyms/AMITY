import { useEffect, useMemo } from 'react'
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

const CACHED_PROFILE_KEY = 'aaharsetu-cached-profile'

export function getCachedProfile(): AccountProfile | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(CACHED_PROFILE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AccountProfile
      if (parsed && parsed.user_id && parsed.role) return parsed
    }
  } catch {}
  return undefined
}

export function saveCachedProfile(profile: AccountProfile) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile))
  } catch {}
}

export function clearCachedProfile() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CACHED_PROFILE_KEY)
  } catch {}
}

export function useProfile(userId?: string) {
  const initialProfile = useMemo(() => {
    const cached = getCachedProfile()
    if (cached && (!userId || cached.user_id === userId)) return cached
    return undefined
  }, [userId])

  const { data, error, mutate, isLoading } = useSWR<AccountProfile>(
    userId ? ['current-profile', userId] : null,
    async () => {
      // 1. Try FastAPI endpoint first
      try {
        const p = await apiRequest<AccountProfile>('/api/me')
        if (p && p.user_id) {
          saveCachedProfile(p)
          return p
        }
      } catch { /* proceed to direct Supabase query */ }

      // 2. Query Supabase directly
      if (isSupabaseConfigured && supabase && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (profile) {
          const accProfile = profile as AccountProfile
          saveCachedProfile(accProfile)
          return accProfile
        }
      }
      throw new Error('Profile not found')
    },
    {
      fallbackData: initialProfile,
      shouldRetryOnError: false,
      revalidateOnFocus: true,
    },
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
            const updated = payload.new as AccountProfile
            saveCachedProfile(updated)
            mutate(updated, false)
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

  return { profile: data ?? initialProfile, error, refresh: mutate, isLoading }
}
