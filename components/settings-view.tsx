import { useEffect, useState, type FormEvent } from 'react'
import { Check, CircleDashed, Database, Globe, LockKeyhole, Map, MessageCircle, Route, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/src/api'
import { cities } from '@/src/cities'
import type { BackendHealth } from '@/src/use-pilot-data'
import type { AccountProfile } from '@/src/use-profile'

export function SettingsView({ source, backend, cityId, onCityChange, accountEmail, profile, profileError, refreshProfile }: {
  source?: 'supabase' | 'offline' | 'unavailable'
  backend?: BackendHealth
  cityId: string
  onCityChange: (cityId: string) => void
  accountEmail?: string
  profile?: AccountProfile
  profileError?: Error
  refreshProfile: () => Promise<unknown>
}) {
  const [savingCity, setSavingCity] = useState(false)
  const [profileForm, setProfileForm] = useState({ display_name: '', organization: '', phone: '', fssai_license: '', area: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  useEffect(() => {
    if (profile?.active_city_id && cities.some(city => city.id === profile.active_city_id) && profile.active_city_id !== cityId) {
      onCityChange(profile.active_city_id)
    }
  }, [profile?.user_id, profile?.active_city_id])
  useEffect(() => {
    if (!profile) return
    setProfileForm({
      display_name: profile.display_name ?? '',
      organization: profile.organization ?? '',
      phone: profile.phone ?? '',
      fssai_license: profile.fssai_license ?? '',
      area: profile.area ?? '',
    })
  }, [profile])
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true)
    try {
      await apiRequest<AccountProfile>('/api/me', { method: 'PATCH', body: JSON.stringify(profileForm) })
      await refreshProfile()
      toast.success('Account details saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your account details.')
    } finally { setSavingProfile(false) }
  }
  async function selectCity(nextCityId: string) {
    onCityChange(nextCityId)
    if (!accountEmail) return
    setSavingCity(true)
    try {
      await apiRequest<AccountProfile>('/api/me', { method: 'PATCH', body: JSON.stringify({ active_city_id: nextCityId }) })
      await refreshProfile()
      toast.success('Your active city was saved to your account.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this city to your account.')
    } finally { setSavingCity(false) }
  }

  const integrations = [
    { name: 'Supabase Auth + Postgres', description: 'Signed-in API requests with city-scoped RLS', icon: Database, ready: source === 'supabase', status: source === 'supabase' ? 'Connected' : source === 'offline' ? 'Not configured' : 'Sign in / check connection' },
    { name: 'OpenStreetMap basemap', description: 'Live map tiles with OpenStreetMap attribution', icon: Map, ready: true, status: 'Available' },
    { name: 'OpenRouteService', description: 'Road directions for dispatch comparison', icon: Route, ready: backend?.routing === 'ors', status: backend?.routing === 'ors' ? 'Key configured · checked on request' : 'Add ORS_API_KEY to the backend environment' },
    { name: 'FastAPI', description: 'Authenticated API for profiles, live data, and dispatch', icon: ShieldCheck, ready: !!backend?.ok, status: backend?.ok ? 'Running' : 'Offline' },
    { name: 'Gemini intake', description: 'Structured extraction; send only operational text that is safe to share', icon: Sparkles, ready: !!backend?.gemini, status: backend?.gemini ? 'Configured' : 'Not configured' },
    { name: 'Telegram', description: 'Bot token is server-side; no notification is sent until a destination is configured', icon: MessageCircle, ready: !!backend?.telegram && !!backend?.telegram_target, status: backend?.telegram_target ? 'Destination configured' : backend?.telegram ? 'Needs chat ID' : 'Not configured' },
  ]

  return <div className="settings-grid">
    <section className="panel">
      <div className="panel-header"><h2>Account and network</h2><Badge variant="outline">{source === 'supabase' ? 'Live account' : 'Local demo'}</Badge></div>
      <div className="integration-list">
        <div className="integration-row"><span className="integration-icon"><LockKeyhole size={19} /></span><div><h3>Signed-in account</h3><p>{accountEmail ?? 'Sign in to view your account'}</p></div><Badge variant="outline">{profile?.role ?? (profileError ? 'Profile unavailable' : 'Checking…')}</Badge></div>
        {profile?.requested_role && profile.requested_role !== profile.role && <div className="integration-row"><span className="integration-icon"><CircleDashed size={19} /></span><div><h3>Role request</h3><p>{profile.requested_role} access needs organization verification</p></div><Badge variant="outline">Pending</Badge></div>}
        {profile?.organization && <div className="integration-row"><span className="integration-icon"><ShieldCheck size={19} /></span><div><h3>Organization</h3><p>{profile.organization}</p></div><Badge variant="outline">{profile.display_name}</Badge></div>}
        <div className="integration-row"><span className="integration-icon"><Globe size={19} /></span><div><h3>Active city</h3><p>{profile ? 'Stored in your account and used to scope live records.' : 'Select a city to view its network.'}</p></div><label className="sr-only" htmlFor="active-city">Active city</label><select id="active-city" value={cityId} disabled={savingCity} onChange={event => void selectCity(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">{cities.map(city => <option key={city.id} value={city.id}>{city.name}, {city.state}</option>)}</select></div>
      </div>
      {profile && <form className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={saveProfile}>
        <label className="grid gap-1 text-xs font-medium">Display name<Input value={profileForm.display_name} maxLength={100} onChange={e => setProfileForm({ ...profileForm, display_name: e.target.value })} required /></label>
        <label className="grid gap-1 text-xs font-medium">Organization<Input value={profileForm.organization} maxLength={160} onChange={e => setProfileForm({ ...profileForm, organization: e.target.value })} /></label>
        <label className="grid gap-1 text-xs font-medium">Phone<Input value={profileForm.phone} maxLength={40} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} type="tel" /></label>
        <label className="grid gap-1 text-xs font-medium">FSSAI license<Input value={profileForm.fssai_license} maxLength={40} onChange={e => setProfileForm({ ...profileForm, fssai_license: e.target.value })} /></label>
        <label className="grid gap-1 text-xs font-medium sm:col-span-2">Area / service address<Input value={profileForm.area} maxLength={160} onChange={e => setProfileForm({ ...profileForm, area: e.target.value })} /></label>
        <div className="sm:col-span-2"><Button type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save account details'}</Button></div>
      </form>}
      <div className="panel-header mt-5"><h2>Service connections</h2><Badge variant="outline">Live status</Badge></div>
      <div className="integration-list">{integrations.map(item => <div className="integration-row" key={item.name}><span className="integration-icon"><item.icon size={19} /></span><div><h3>{item.name}</h3><p>{item.description}</p></div><Badge variant={item.ready ? 'secondary' : 'outline'}>{item.ready ? <Check /> : <CircleDashed />}{item.status}</Badge></div>)}</div>
    </section>
    <div className="flex flex-col gap-5">
      <section className="panel settings-note"><LockKeyhole size={23} /><h2>Roles are server controlled.</h2><p>Your account role is read from the protected profile record. Signup metadata cannot grant coordinator or dispatch access.</p><p>Coordinators must be provisioned by an administrator.</p></section>
      <section className="panel settings-note"><h2>City network</h2><dl><div><dt>City</dt><dd>{cities.find(city => city.id === cityId)?.name ?? 'Unknown'}</dd></div><div><dt>Timezone</dt><dd>{cities.find(city => city.id === cityId)?.timezone ?? '—'}</dd></div><div><dt>Data mode</dt><dd>{source === 'supabase' ? 'Authenticated Supabase data' : source === 'offline' ? 'Bengaluru synthetic demo only' : 'No live data loaded'}</dd></div><div><dt>Backend</dt><dd>FastAPI / Python</dd></div></dl></section>
    </div>
  </div>
}
