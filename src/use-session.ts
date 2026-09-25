import { useEffect } from 'react'
import useSWR from 'swr'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export function hasStoredSupabaseSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token')) && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key)
        if (val && val.includes('access_token')) return true
      }
    }
  } catch {}
  return false
}

export function useSession() {
  const session = useSWR(isSupabaseConfigured ? 'supabase-session' : null, async () => {
    const { data, error } = await supabase!.auth.getSession()
    if (error) throw error
    return data.session
  }, { revalidateOnFocus: true })
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, next) => { void session.mutate(next, false) })
    return () => subscription?.data.subscription.unsubscribe()
  }, [session.mutate])
  return session
}
