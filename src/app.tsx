import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Bell, ChevronDown, ChevronRight, CircleHelp, Database, Leaf, LoaderCircle, MapPin, Menu, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { AppSidebar, sectionNames } from '@/components/app-sidebar'
import { AuthDialog } from '@/components/auth-dialog'
import { ActivityFeed } from '@/components/activity-feed'
import { DonationDialog } from '@/components/donation-dialog'
import { DonationForm } from '@/components/donation-form'
import { DonationsTable } from '@/components/donations-table'
import { DispatchView } from '@/components/dispatch-view'
import { ImpactView } from '@/components/impact-view'
import { RecipientView, DriverView } from '@/components/network-views'
import { OverviewMetrics } from '@/components/overview-metrics'
import { RescueMap } from '@/components/rescue-map'
import { SettingsView } from '@/components/settings-view'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useSession } from './use-session'
import { useProfile } from './use-profile'
import { isActive, type Donation, type PilotData, type Section } from './types'
import type { BackendHealth } from './use-pilot-data'
import { cities } from './cities'

const descriptions: Record<Section, string> = {
  overview: 'Good food. Better destinations. Let’s make every rescue count.',
  donations: 'A little surplus can make a big difference. Keep it moving.',
  dispatch: 'The right food, the right route, before the window closes.',
  recipients: 'Open doors, available capacity, and communities ready to receive.',
  drivers: 'The people who make the last mile matter.',
  impact: 'Every rescue leaves a record. Every record tells a story.',
  settings: 'Your network, connections, and the things that keep it running.',
}
function getSection(): Section {
  const section = window.location.hash.slice(1)
  return Object.keys(sectionNames).includes(section) ? section as Section : 'overview'
}

export default function App({ data, source, refresh, backend, error, cityId, onCityChange }: { data?: PilotData; source?: 'supabase' | 'offline' | 'unavailable'; refresh?: () => void; backend?: BackendHealth; error?: Error; cityId: string; onCityChange: (cityId: string) => void }) {
  const [section, updateSection] = useState<Section>(getSection)
  const [mobile, setMobile] = useState(false)
  const [auth, setAuth] = useState(false)
  const [posting, setPosting] = useState(false)
  const [info, setInfo] = useState<'help' | 'notifications' | null>(null)
  const [selected, setSelected] = useState<Donation | null>(null)
  const [expandedMap, setExpandedMap] = useState(false)
  const [now, setNow] = useState(Date.now())
  const { data: session } = useSession()
  const { profile, error: profileError, refresh: refreshProfile } = useProfile(session?.user.id)
  const city = cities.find(item => item.id === cityId) ?? cities[0]
  const code = location.pathname === '/auth/callback' ? new URLSearchParams(location.search).get('code') : null
  const callback = useSWR(code && supabase ? ['auth-callback', code] : null, async ([, callbackCode]) => {
    if (!supabase) return false
    const { error } = await supabase.auth.exchangeCodeForSession(callbackCode)
    if (error) throw error
    history.replaceState(null, '', '/')
    toast.success('Email confirmed. You are signed in.')
    return true
  }, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false })
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    const handleHash = () => updateSection(getSection())
    window.addEventListener('hashchange', handleHash)
    return () => { clearInterval(tick); window.removeEventListener('hashchange', handleHash) }
  }, [])
  function setSection(next: Section) { updateSection(next); window.location.hash = next }
  async function signOut() { if (!supabase) { toast.error('Authentication is not configured in this build.'); return } const { error } = await supabase.auth.signOut(); if (error) toast.error('Could not sign out. Try again.'); else toast.success('Signed out securely.') }
  const active = data?.donations.filter(isActive)
  const canPost = source === 'supabase' && profile?.role === 'donor'
  const urgent = active?.filter(d => new Date(d.safe_until).getTime() > now && new Date(d.safe_until).getTime() - now < 3600000)
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><AppSidebar section={section} setSection={setSection} mobileOpen={mobile} close={() => setMobile(false)} session={session} signIn={() => setAuth(true)} signOut={signOut} activeCount={active?.length} help={() => setInfo('help')} /><div className="app-main"><header className="topbar"><div className="breadcrumb"><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu /></Button><span>Workspace</span><ChevronRight size={13} /><strong>{sectionNames[section]}</strong></div><div className="topbar-actions"><button className="location-button" onClick={() => setSection('settings')}><MapPin size={14} /><span>{city.name}, IN</span><ChevronDown size={12} /></button><span className="topbar-divider" /><Button variant="ghost" size="icon" aria-label="Safety guidelines" onClick={() => setInfo('help')}><CircleHelp /></Button><Button variant="ghost" size="icon" aria-label="View notifications" onClick={() => setInfo('notifications')}><Bell /></Button><button className="topbar-avatar" onClick={() => setAuth(true)} aria-label={session ? 'Account' : 'Sign in'}>{session ? 'RP' : <Leaf size={17} />}</button></div></header>
    <main id="main-content" className="page-content"><div className="page-heading"><div><div className="heading-eyebrow"><span className="status-dot" />AAHARSETU · {city.name.toUpperCase()} FOOD RESCUE NETWORK</div><h1>{section === 'overview' ? 'Rescue overview' : sectionNames[section]}</h1><p>{descriptions[section]}</p></div><div className="heading-actions"><Badge variant="outline">{source === 'supabase' ? 'Supabase Live' : source === 'offline' ? 'Synthetic demo' : 'Sign in for live data'}</Badge><Button size="lg" onClick={() => setPosting(true)} disabled={!canPost}><Plus data-icon="inline-start" />Post a donation</Button></div></div>
    {callback.error && <Alert variant="destructive" className="mb-5"><AlertTitle>Confirmation link unavailable</AlertTitle><AlertDescription>This link may have expired or already been used. Please try signing in or request a new confirmation.</AlertDescription></Alert>}
    {callback.isLoading && <p className="flex gap-2 items-center mb-4"><LoaderCircle size={16} className="animate-spin" />Confirming your email…</p>}
    {!data && <div className="setup-banner"><span className="setup-banner-icon"><Database size={16} /></span><p><strong>{error?.message ?? 'Connect to the live rescue network'}</strong><span>Sign in to load city-scoped records. Demo locations are never substituted for live operational data.</span></p><button onClick={() => error?.message.includes('Sign in') ? setAuth(true) : setSection('settings')}>{error?.message.includes('Sign in') ? 'Sign in' : 'View setup'}<ChevronRight size={14} /></button></div>}
    {section === 'overview' && <div className="overview-content"><OverviewMetrics data={data} /><div className="overview-middle"><RescueMap data={data} cityId={cityId} expanded={expandedMap} onExpand={() => setExpandedMap(!expandedMap)} /><ActivityFeed data={data} navigate={setSection} /></div>{!!urgent?.length && <div className="urgency-banner"><ShieldCheck size={17} /><p><strong>{urgent.length} {urgent.length === 1 ? 'rescue needs' : 'rescues need'} attention.</strong> Less than an hour remains in the safe window.</p><Button variant="ghost" size="sm" onClick={() => setSection('dispatch')}>Review rescues<ChevronRight data-icon="inline-end" /></Button></div>}<DonationsTable data={data} now={now} openDonation={setSelected} viewAll={() => setSection('donations')} /></div>}
    {section === 'donations' && <DonationsTable data={data} now={now} full openDonation={setSelected} viewAll={() => {}} />}
    {section === 'dispatch' && <DispatchView data={data} now={now} cityId={cityId} role={profile?.role} openDonation={setSelected} refresh={refresh ?? (() => {})} />}
    {section === 'recipients' && <RecipientView data={data} />}
    {section === 'drivers' && <DriverView data={data} onDispatch={() => setSection('dispatch')} />}
    {section === 'impact' && <ImpactView data={data} />}
    {section === 'settings' && <SettingsView source={source} backend={backend} cityId={cityId} onCityChange={onCityChange} accountEmail={session?.user.email} profile={profile} profileError={profileError} refreshProfile={refreshProfile} />}
    <footer className="page-footer"><span><Leaf size={13} />AaharSetu (आहारसेतु) · Food Rescue Bridge</span><span>{city.name} network</span></footer>
    </main></div>
    <AuthDialog open={auth} onOpenChange={setAuth} cityId={cityId} />
    <DonationDialog donation={selected} data={data} now={now} close={() => setSelected(null)} />
    <DonationForm open={posting} data={data} cityId={cityId} refresh={refresh ?? (() => {})} onClose={() => setPosting(false)} />
    <Dialog open={info !== null} onOpenChange={open => { if (!open) setInfo(null) }}><DialogContent className="sm:max-w-lg p-6"><DialogHeader><DialogTitle>{info === 'help' ? 'Safe food. Responsible rescues.' : 'Your rescue updates'}</DialogTitle><DialogDescription>{info === 'help' ? 'Pilot coordination rules, not a substitute for trained food-safety assessment.' : 'Important changes across your rescue network.'}</DialogDescription></DialogHeader>{info === 'help' ? <div className="help-content"><p><strong>Never dispatch after the safe window.</strong> Preparation time, temperature, condition, and handling time must all be checked.</p><p><strong>License collected, not verified.</strong> A recorded FSSAI number is not proof of compliance.</p><p><strong>Synthetic means synthetic.</strong> Pilot locations, people, and food records are demonstration inputs. Only synthetic text may go to AI services.</p><a href="https://sharefood.eatrightindia.gov.in/guidance-for-fresh-cooked-food.html" target="_blank" rel="noreferrer">Read IFSA food-safety guidance ↗</a></div> : <div className="help-content">{urgent?.length ? urgent.map(d => <button className="notification-item" key={d.id} onClick={() => { setSelected(d); setInfo(null) }}><ClockNotice /><span>{d.item} needs attention before its safe window closes.</span><ChevronRight size={15} /></button>) : <p>No urgent rescue alerts right now. All active donations are within their safety windows.</p>}</div>}</DialogContent></Dialog>
  </div>
}
function ClockNotice() { return <ShieldCheck size={18} /> }
