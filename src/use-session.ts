import { useEffect } from 'react'
import useSWR from 'swr'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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
