import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Bell, ChevronDown, ChevronRight, CircleHelp, Database, Leaf, LoaderCircle,
  MapPin, Menu, Monitor, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, User
} from 'lucide-react'
import { toast } from 'sonner'
import { isDesktopBrowser, subscribeToWebPush } from '@/src/lib/push-notifications'
import { supabase } from '@/lib/supabase'
import { AppSidebar, sectionNames, roleLabel } from '@/components/app-sidebar'
import { ActivityFeed } from '@/components/activity-feed'
import { DonationDialog } from '@/components/donation-dialog'
import { DonationForm } from '@/components/donation-form'
import { DonationsTable } from '@/components/donations-table'
import { DispatchView } from '@/components/dispatch-view'
import { DonorDashboard } from '@/components/donor-dashboard'
import { DriverDashboard } from '@/components/driver-dashboard'
import { RecipientDashboard } from '@/components/recipient-dashboard'
import { RecipientView, DriverView } from '@/components/network-views'
import { RecipientDialog } from '@/components/recipient-dialog'
import { DriverDialog } from '@/components/driver-dialog'
import { OnboardingWizard } from '@/components/onboarding-wizard'
import { OverviewMetrics } from '@/components/overview-metrics'
import { OverviewInsights } from '@/components/overview-insights'
import { SettingsView } from '@/components/settings-view'
import { PostDonationView } from '@/components/post-donation-view'
import { WorkspacesView } from '@/components/workspaces-view'
import { ErrorBoundary } from '@/components/error-boundary'

// Code-split heavy visualization modules (MapLibre GL and Recharts)
const RescueMap = lazy(() => import('@/components/rescue-map').then(m => ({ default: m.RescueMap })))
const ImpactView = lazy(() => import('@/components/impact-view').then(m => ({ default: m.ImpactView })))

function MapSkeleton() {
  return (
    <div className="map-card flex flex-col items-center justify-center min-h-[380px] bg-card/50 backdrop-blur-sm border border-border/60 rounded-2xl p-6 text-center text-muted-foreground animate-pulse">
      <LoaderCircle className="animate-spin mb-3 text-primary" size={28} />
      <span className="text-sm font-semibold text-foreground">Loading rescue corridor map…</span>
      <span className="text-xs text-muted-foreground/75 mt-1">Connecting to geospatial telemetry</span>
    </div>
  )
}

function ImpactSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center text-muted-foreground animate-pulse">
      <LoaderCircle className="animate-spin mb-3 text-primary" size={28} />
      <span className="text-sm font-medium">Generating municipal impact analytics…</span>
    </div>
  )
}
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useSession, hasStoredSupabaseSession } from './use-session'
import { useProfile, clearCachedProfile } from './use-profile'
import { isActive, type Donation, type Driver, type PilotData, type Recipient, type Section } from './types'
import type { BackendHealth } from './use-pilot-data'
import { cities } from './cities'

const descriptions: Record<Section, string> = {
  overview: "Good food. Better destinations. Let's make every rescue count.",
  workspaces: 'Municipal food rescue networks across India. Select an operational territory.',
  donations: 'A little surplus can make a big difference. Keep it moving.',
  dispatch: 'The right food, the right route, before the window closes.',
  recipients: 'Open doors, available capacity, and communities ready to receive.',
  drivers: 'The people who make the last mile matter.',
  impact: 'Every rescue leaves a record. Every record tells a story.',
  settings: 'Your network, connections, and the things that keep it running.',
}

function getSection(): Section {
  if (typeof window === 'undefined') return 'overview'
  const rawHash = window.location.hash.slice(1)
  const hash = rawHash.split('?')[0].split('&')[0]
  if (hash === 'post-donation' || hash === 'post-food-donation') return 'donations'
  if (hash.startsWith('recipients') || hash.startsWith('recipient-')) return 'recipients'
  if (hash.startsWith('drivers') || hash.startsWith('driver-')) return 'drivers'
  return Object.keys(sectionNames).includes(hash) ? hash as Section : 'overview'
}

function getRecipientIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (hash.startsWith('#recipient-')) {
    return hash.replace('#recipient-', '')
  }
  if (hash.includes('?')) {
    const qs = hash.slice(hash.indexOf('?') + 1)
    const params = new URLSearchParams(qs)
    const id = params.get('id') || params.get('recipient')
    if (id && (hash.startsWith('#recipients') || hash.startsWith('#recipient-'))) return id
  }
  const params = new URLSearchParams(window.location.search)
  return params.get('recipient') || params.get('shelter') || null
}

function getDriverIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (hash.startsWith('#driver-')) {
    return hash.replace('#driver-', '')
  }
  if (hash.includes('?')) {
    const qs = hash.slice(hash.indexOf('?') + 1)
    const params = new URLSearchParams(qs)
    const id = params.get('id') || params.get('driver')
    if (id && (hash.startsWith('#drivers') || hash.startsWith('#driver-'))) return id
  }
  const params = new URLSearchParams(window.location.search)
  return params.get('driver') || null
}

/** Detect a freshly signed-up user who still has the default placeholder name */
function isProfileIncomplete(profile: ReturnType<typeof useProfile>['profile']) {
  if (!profile) return false
  return profile.display_name === 'AaharSetu member' || !profile.display_name
}

export default function App({
  data,
  source,
  refresh,
  backend,
  error,
  cityId = 'blr',
  onCityChange,
  onBackToLanding,
}: {
  data?: PilotData
  source?: 'supabase' | 'offline' | 'unavailable'
  refresh?: () => void
  backend?: BackendHealth
  error?: Error
  cityId: string
  onCityChange?: (cityId: string) => void
  onBackToLanding?: () => void
}) {
  const [section, updateSection] = useState<Section>(getSection)
  const [isPostingView, setIsPostingView] = useState(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    return hash === '#post-donation' || hash === '#post-food-donation'
  })
  const [mobile, setMobile] = useState(false)
  const [posting, setPosting] = useState(false)
  const [info, setInfo] = useState<'help' | 'notifications' | null>(null)
  const [selected, setSelected] = useState<Donation | null>(null)
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [focusedMapPointId, setFocusedMapPointId] = useState<string | null>(null)
  const [expandedMap, setExpandedMap] = useState(false)
  const [dismissDesktopPrompt, setDismissDesktopPrompt] = useState(false)
  const [isDesktop] = useState(isDesktopBrowser)
  const [desktopPerm, setDesktopPerm] = useState(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted')
  const [now, setNow] = useState(Date.now())
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('aaharsetu-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('aaharsetu-sidebar-collapsed', String(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openLogin = () => { window.location.hash = 'login' }

  const { data: session, isLoading: sessionLoading } = useSession()
  const { profile, error: profileError, refresh: refreshProfile, isLoading: profileLoading } = useProfile(session?.user.id)
  const city = cities.find(item => item.id === cityId) ?? cities[0]

  const hasStoredSession = useMemo(() => hasStoredSupabaseSession(), [])
  const isAuthInitializing = (sessionLoading && hasStoredSession) || (Boolean(session) && profileLoading && !profile)

  const code = location.pathname === '/auth/callback'
    ? new URLSearchParams(location.search).get('code')
    : null

  const callback = useSWR(
    code && supabase ? ['auth-callback', code] : null,
    async ([, callbackCode]) => {
      if (!supabase) return false
      const { error } = await supabase.auth.exchangeCodeForSession(callbackCode)
      if (error) throw error
      history.replaceState(null, '', '/')
      toast.success('Email confirmed. You are signed in.')
      return true
    },
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false },
  )

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    const handleHash = () => {
      const hash = window.location.hash
      const isPost = hash === '#post-donation' || hash === '#post-food-donation'
      // Redirect unauthenticated users to login if they try to open the donation form via URL
      if (isPost && !session) {
        toast.info('Please sign in or register to post a donation.')
        window.location.hash = 'login'
        setIsPostingView(false)
        return
      }
      setIsPostingView(isPost)
      updateSection(getSection())

      const targetRecipientId = getRecipientIdFromUrl()
      if (targetRecipientId && data?.recipients) {
        const found = data.recipients.find(r => r.id === targetRecipientId)
        if (found) setSelectedRecipient(found)
      } else if (!hash.startsWith('#recipients') && !hash.startsWith('#recipient-')) {
        setSelectedRecipient(null)
      }

      const targetDriverId = getDriverIdFromUrl()
      if (targetDriverId && data?.drivers) {
        const found = data.drivers.find(d => d.id === targetDriverId)
        if (found) setSelectedDriver(found)
      } else if (!hash.startsWith('#drivers') && !hash.startsWith('#driver-')) {
        setSelectedDriver(null)
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => { clearInterval(tick); window.removeEventListener('hashchange', handleHash) }
  }, [data?.recipients, data?.drivers])

  // Guard: if user lands on #post-donation without a session, redirect to login
  useEffect(() => {
    if (!sessionLoading && !session && isPostingView) {
      toast.info('Please sign in or register to post a donation.')
      window.location.hash = 'login'
      setIsPostingView(false)
    }
  }, [sessionLoading, session, isPostingView])

  useEffect(() => {
    const targetId = getRecipientIdFromUrl()
    if (targetId && data?.recipients) {
      const found = data.recipients.find(r => r.id === targetId)
      if (found) setSelectedRecipient(found)
    }
  }, [data?.recipients])

  useEffect(() => {
    const targetId = getDriverIdFromUrl()
    if (targetId && data?.drivers) {
      const found = data.drivers.find(d => d.id === targetId)
      if (found) setSelectedDriver(found)
    }
  }, [data?.drivers])

  function handleSelectRecipient(r: Recipient) {
    setSelectedRecipient(r)
    window.location.hash = `recipients?id=${encodeURIComponent(r.id)}`
  }

  function handleCloseRecipient() {
    setSelectedRecipient(null)
    if (window.location.hash.startsWith('#recipients') || window.location.hash.startsWith('#recipient-')) {
      window.location.hash = 'recipients'
    }
  }

  function handleSelectDriver(d: Driver) {
    setSelectedDriver(d)
    window.location.hash = `drivers?id=${encodeURIComponent(d.id)}`
  }

  function handleCloseDriver() {
    setSelectedDriver(null)
    if (window.location.hash.startsWith('#drivers') || window.location.hash.startsWith('#driver-')) {
      window.location.hash = 'drivers'
    }
  }

  function handleLocateDriver(d: Driver) {
    setFocusedMapPointId(d.id)
    setSection('overview')
    toast.info(`Volunteer located on live map: ${d.name} (${d.vehicle})`)
  }

  function handleDispatchDriver(d?: Driver) {
    setSection('dispatch')
    if (d) {
      toast.info(`Viewing dispatch corridors for ${d.name}`)
    }
  }

  function setSection(next: Section) {
    setIsPostingView(false)
    updateSection(next)
    window.location.hash = next
  }

  function openPostDonation() {
    if (!session) {
      toast.info('Please sign in or register to post a donation.')
      window.location.hash = 'login'
      return
    }
    setIsPostingView(true)
    updateSection('donations')
    window.location.hash = 'post-donation'
  }

  async function signOut() {
    if (!supabase) { toast.error('Authentication is not configured in this build.'); return }
    clearCachedProfile()
    const { error } = await supabase.auth.signOut()
    if (error) toast.error('Could not sign out. Try again.')
    else toast.success('Signed out securely.')
  }

  const active = data?.donations.filter(isActive)
  const urgent = active?.filter(d =>
    new Date(d.safe_until).getTime() > now && new Date(d.safe_until).getTime() - now < 3600000
  )

  // Role-based capability flags
  const role = profile?.role
  const isCoordinator = role === 'coordinator'
  const isDonor = role === 'donor'
  const isDriver = role === 'driver'
  const isRecipient = role === 'recipient' || role === 'shelter'
  const canPost = source === 'supabase' && (isDonor || isCoordinator)
  const showOnboarding = session && profile && isProfileIncomplete(profile) && !onboardingDismissed

  // Role-adaptive overview: coordinators see the full ops view, others see their role dashboard
  function renderOverview() {
    if (isAuthInitializing) {
      return (
        <div className="overview-content animate-pulse" aria-label="Loading your workspace">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-card/60 border border-border/60 rounded-2xl p-5 flex flex-col justify-between">
                <div className="h-4 bg-muted/60 rounded w-1/2" />
                <div className="h-8 bg-muted/70 rounded w-1/3" />
                <div className="h-3 bg-muted/50 rounded w-2/3" />
              </div>
            ))}
          </div>
          <div className="h-80 bg-card/60 border border-border/60 rounded-2xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <LoaderCircle className="animate-spin text-primary" size={28} />
              <span className="text-xs font-medium">Loading your operational workspace…</span>
            </div>
          </div>
        </div>
      )
    }

    if (!session || !profile) {
      // Unauthenticated — show generic overview
      return (
        <div className="overview-content">
          <OverviewMetrics data={data} onNavigate={setSection} />
          <div className="overview-middle">
            <Suspense fallback={<MapSkeleton />}>
              <RescueMap data={data} cityId={cityId} expanded={expandedMap} onExpand={() => setExpandedMap(!expandedMap)} selectedDonationId={selected?.id} selectedPointId={focusedMapPointId ?? undefined} />
            </Suspense>
            <ActivityFeed data={data} navigate={setSection} />
          </div>
          <OverviewInsights data={data} onNavigateToImpact={() => setSection('impact')} />
          {!!urgent?.length && <UrgencyBanner count={urgent.length} onDispatch={() => setSection('dispatch')} />}
          <DonationsTable data={data} now={now} openDonation={setSelected} viewAll={() => setSection('donations')} />
        </div>
      )
    }
    if (isDonor) {
      return <DonorDashboard data={data} now={now} profile={profile} onPost={openPostDonation} onSelect={setSelected} />
    }
    if (isDriver) {
      return <DriverDashboard data={data} now={now} profile={profile} cityId={cityId} onSelect={setSelected} refresh={refresh ?? (() => {})} />
    }
    if (isRecipient) {
      return <RecipientDashboard data={data} now={now} profile={profile} cityId={cityId} onSelect={setSelected} refresh={refresh ?? (() => {})} />
    }
    // Coordinator: full ops overview
    return (
      <div className="overview-content">
        <OverviewMetrics data={data} onNavigate={setSection} />
        <div className="overview-middle">
          <Suspense fallback={<MapSkeleton />}>
            <RescueMap data={data} cityId={cityId} expanded={expandedMap} onExpand={() => setExpandedMap(!expandedMap)} selectedDonationId={selected?.id} selectedPointId={focusedMapPointId ?? undefined} />
          </Suspense>
          <ActivityFeed data={data} navigate={setSection} />
        </div>
        <OverviewInsights data={data} onNavigateToImpact={() => setSection('impact')} />
        {!!urgent?.length && <UrgencyBanner count={urgent.length} onDispatch={() => setSection('dispatch')} />}
        <DonationsTable data={data} now={now} openDonation={setSelected} viewAll={() => setSection('donations')} />
      </div>
    )
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : undefined

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <AppSidebar
        section={section} setSection={setSection}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        mobileOpen={mobile} close={() => setMobile(false)}
        session={session} profile={profile ?? undefined}
        signIn={openLogin} signOut={signOut}
        activeCount={active?.length} help={() => setInfo('help')}
        cityId={cityId} onCityChange={onCityChange}
        source={source}
        onBackToLanding={onBackToLanding}
      />

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <Button variant="ghost" size="icon" className="mobile-menu md:hidden" aria-label="Open navigation" onClick={() => setMobile(true)}>
              <Menu size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              title={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              onClick={toggleSidebar}
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground mr-1"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium text-xs cursor-pointer"
              onClick={() => setSection('workspaces')}
            >
              Workspace
            </button>
            <ChevronRight size={13} />
            {isPostingView ? (
              <>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors font-medium text-xs cursor-pointer"
                  onClick={() => setSection('donations')}
                >
                  Donations
                </button>
                <ChevronRight size={13} />
                <strong>Post food donation</strong>
              </>
            ) : (
              <strong>{sectionNames[section]}</strong>
            )}
          </div>
          <div className="topbar-actions">
            <button
              className="location-button"
              onClick={() => setSection('workspaces')}
              aria-label={`Current workspace: ${city.name}`}
            >
              <MapPin size={14} />
              <span>{city.name}, IN</span>
              <ChevronDown size={12} />
            </button>
            <span className="topbar-divider" />
            <Button variant="ghost" size="icon" aria-label="Safety guidelines" onClick={() => setInfo('help')}>
              <CircleHelp />
            </Button>
            <Button variant="ghost" size="icon" aria-label="View notifications" onClick={() => setInfo('notifications')}>
              <Bell />
              {!!urgent?.length && <span className="notif-dot" />}
            </Button>
            <button
              className="topbar-account-button group"
              onClick={session ? () => setSection('settings') : openLogin}
              aria-label={session ? 'Account & verified credentials' : 'Sign in to participate'}
              title={session ? 'Manage account & credentials' : 'Sign in'}
            >
              <div className="relative flex items-center justify-center">
                <span className="topbar-avatar">
                  {session && initials ? initials : <User size={15} />}
                </span>
                {session && (
                  <span className="topbar-status-dot" title="Authenticated session" />
                )}
              </div>
              <div className="account-text hidden sm:flex flex-col text-left pr-1">
                <strong className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                  {session ? (profile?.display_name || session.user.email?.split('@')[0]) : 'Sign In'}
                </strong>
                <small className="text-[10px] text-muted-foreground leading-tight">
                  {session ? (profile ? roleLabel[profile.role] : 'Account') : 'Guest'}
                </small>
              </div>
            </button>
          </div>
        </header>

        <main id="main-content" className="page-content">
          {isPostingView ? (
            <PostDonationView
              data={data}
              cityId={cityId}
              profile={profile}
              refresh={refresh ?? (() => {})}
              onNavigateToDonations={() => setSection('donations')}
              onNavigateToOverview={() => setSection('overview')}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="heading-eyebrow">
                    <span className="status-dot" />
                    AAHARSETU · {city.name.toUpperCase()} FOOD RESCUE NETWORK
                    {profile && <span className="role-eyebrow-badge">{profile.role.toUpperCase()}</span>}
                  </div>
                  <h1>{section === 'overview'
                    ? (isAuthInitializing
                      ? 'Loading workspace…'
                      : isDonor ? `Welcome, ${profile?.display_name.split(' ')[0]}`
                      : isDriver ? 'Volunteer Driver Dashboard'
                      : isRecipient ? 'Shelter Recipient Dashboard'
                      : isCoordinator ? 'Municipal Rescue Overview'
                      : 'Rescue overview')
                    : sectionNames[section]}
                  </h1>
                  <p>{section === 'overview' && profile && !isAuthInitializing
                    ? (isDonor ? 'Post surplus food and track verified rescue pickups in real time.'
                      : isDriver ? 'Active rescue runs, route corridor waypoints, and OTP handover verification.'
                      : isRecipient ? 'Incoming rescue shipments, kitchen capacity allocations, and delivery confirmations.'
                      : 'Municipal food rescue telemetry, real-time corridors, and verified impact analytics.')
                    : descriptions[section]}</p>
                </div>
                <div className="heading-actions">
                  <Badge variant="outline">
                    {source === 'supabase' ? 'Supabase Live' : source === 'offline' ? 'Synthetic demo' : 'Sign in for live data'}
                  </Badge>
                  {/* Post a donation button opens multi-step form */}
                  {(canPost || isCoordinator || !session) && (
                    <Button size="lg" onClick={openPostDonation}>
                      <Plus data-icon="inline-start" />
                      Post a donation
                    </Button>
                  )}
                </div>
              </div>

              {isDesktop && desktopPerm === 'default' && !dismissDesktopPrompt && (
                <div className="desktop-notification-bar">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <Monitor size={17} />
                    </div>
                    <div>
                      <strong className="text-xs text-foreground block">Desktop Emergency Rescue Notifications</strong>
                      <span className="text-[11px] text-muted-foreground">Enable Windows & Mac system alerts with audio chimes when urgent food rescues are posted or expire.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      onClick={async () => {
                        const res = await subscribeToWebPush(cityId)
                        if (res.success) {
                          toast.success(res.message)
                          setDesktopPerm('granted')
                        } else {
                          toast.error(res.message)
                        }
                      }}
                    >
                      <Bell size={12} /> Enable Desktop Alerts
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => setDismissDesktopPrompt(true)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {callback.error && (
                <Alert variant="destructive" className="mb-5">
                  <AlertTitle>Confirmation link unavailable</AlertTitle>
                  <AlertDescription>This link may have expired or already been used. Please try signing in or request a new confirmation.</AlertDescription>
                </Alert>
              )}
              {callback.isLoading && (
                <p className="flex gap-2 items-center mb-4"><LoaderCircle size={16} className="animate-spin" />Confirming your email…</p>
              )}

              {/* Sign-in / setup banner for unauthenticated users */}
              {!data && (
                <div className="setup-banner">
                  <span className="setup-banner-icon"><Database size={16} /></span>
                  <p>
                    <strong>{error?.message ?? 'Connect to the live rescue network'}</strong>
                    <span>Sign in to load city-scoped records. Demo locations are never substituted for live operational data.</span>
                  </p>
                  <button onClick={() => error?.message.includes('Sign in') ? openLogin() : setSection('settings')}>
                    {error?.message.includes('Sign in') ? 'Sign in' : 'View setup'}
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Section routing with per-section ErrorBoundary protection */}
              <ErrorBoundary>
                {section === 'overview' && renderOverview()}
                {section === 'workspaces' && (
                  <WorkspacesView
                    cityId={cityId}
                    onCityChange={onCityChange ?? (() => {})}
                    data={data}
                    source={source}
                  />
                )}
                {section === 'donations' && (
                  <DonationsTable
                    data={data}
                    now={now}
                    full
                    openDonation={setSelected}
                    viewAll={() => {}}
                    onPostDonation={openPostDonation}
                  />
                )}
                {section === 'dispatch' && (
                  <DispatchView data={data} now={now} cityId={cityId} role={profile?.role} openDonation={setSelected} refresh={refresh ?? (() => {})} />
                )}
                {section === 'recipients' && (
                  <RecipientView
                    data={data}
                    cityId={cityId}
                    onSelectRecipient={handleSelectRecipient}
                    onDonateToRecipient={r => {
                      openPostDonation()
                      toast.info(`Posting donation earmarked for ${r.name} (${r.area})`)
                    }}
                    onLocateOnMap={r => {
                      setFocusedMapPointId(r.id)
                      setSection('overview')
                      toast.info(`Shelter located: ${r.name} · ${r.area}`)
                    }}
                  />
                )}
                {section === 'drivers' && (
                  <DriverView
                    data={data}
                    cityId={cityId}
                    onSelectDriver={handleSelectDriver}
                    onLocateOnMap={handleLocateDriver}
                    onDispatch={handleDispatchDriver}
                  />
                )}
                {section === 'impact' && (
                  <Suspense fallback={<ImpactSkeleton />}>
                    <ImpactView data={data} />
                  </Suspense>
                )}
                {section === 'settings' && (
                  <SettingsView
                    source={source} backend={backend} cityId={cityId} onCityChange={onCityChange ?? (() => {})}
                    accountEmail={session?.user.email} profile={profile} profileError={profileError}
                    refreshProfile={refreshProfile}
                  />
                )}
              </ErrorBoundary>

              <footer className="page-footer">
                <span><Leaf size={13} />AaharSetu (आहारसेतु) · Food Rescue Bridge</span>
                <span>{city.name} network</span>
              </footer>
            </>
          )}
        </main>
      </div>

      {/* Onboarding wizard for new users with incomplete profile */}
      {showOnboarding && profile && (
        <OnboardingWizard
          profile={profile}
          onComplete={() => { setOnboardingDismissed(true); refreshProfile() }}
        />
      )}

      <DonationDialog donation={selected} data={data} now={now} close={() => setSelected(null)} />
      <RecipientDialog
        recipient={selectedRecipient}
        data={data}
        cityId={cityId}
        now={now}
        onClose={handleCloseRecipient}
        onDonate={r => {
          openPostDonation()
          toast.info(`Posting donation earmarked for ${r.name} (${r.area})`)
        }}
        onLocateOnMap={r => {
          setFocusedMapPointId(r.id)
          setSection('overview')
          toast.info(`Shelter located on live map: ${r.name} · ${r.area}`)
        }}
        onViewDispatch={() => {
          setSection('dispatch')
        }}
        onSelectDonation={d => {
          setSelected(d)
        }}
      />
      <DriverDialog
        driver={selectedDriver}
        data={data}
        cityId={cityId}
        now={now}
        onClose={handleCloseDriver}
        onLocateOnMap={handleLocateDriver}
        onViewDispatch={handleDispatchDriver}
        onSelectDonation={d => {
          setSelected(d)
        }}
      />
      <DonationForm open={posting} data={data} cityId={cityId} refresh={refresh ?? (() => {})} onClose={() => setPosting(false)} />

      {/* Help / Notifications dialog */}
      <Dialog open={info !== null} onOpenChange={open => { if (!open) setInfo(null) }}>
        <DialogContent className="sm:max-w-lg p-6">
          <DialogHeader>
            <DialogTitle>{info === 'help' ? 'Safe food. Responsible rescues.' : 'Your rescue updates'}</DialogTitle>
            <DialogDescription>{info === 'help' ? 'Pilot coordination rules, not a substitute for trained food-safety assessment.' : 'Important changes across your rescue network.'}</DialogDescription>
          </DialogHeader>
          {info === 'help' ? (
            <div className="help-content">
              <p><strong>Never dispatch after the safe window.</strong> Preparation time, temperature, condition, and handling time must all be checked.</p>
              <p><strong>License collected, not verified.</strong> A recorded FSSAI number is not proof of compliance.</p>
              <p><strong>Synthetic means synthetic.</strong> Pilot locations, people, and food records are demonstration inputs. Only synthetic text may go to AI services.</p>
              <a href="https://sharefood.eatrightindia.gov.in/guidance-for-fresh-cooked-food.html" target="_blank" rel="noreferrer">Read IFSA food-safety guidance ↗</a>
            </div>
          ) : (
            <div className="help-content space-y-3">
              {urgent?.length ? (
                <div className="space-y-2">
                  {urgent.map(d => (
                    <button className="notification-item" key={d.id} onClick={() => { setSelected(d); setInfo(null) }}>
                      <ShieldCheck size={18} />
                      <span>{d.item} needs attention before its safe window closes.</span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              ) : (
                <p>No urgent rescue alerts right now. All active donations are within their safety windows.</p>
              )}

              <div className="mt-4 rounded-xl border border-border/70 bg-card/60 p-3 text-xs flex items-center justify-between gap-3">
                <div>
                  <strong className="block text-foreground">Emergency Alerts Dispatch</strong>
                  <span className="text-[11px] text-muted-foreground">Web Push notifications and Telegram bot broadcasts.</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => { setSection('settings'); setInfo(null) }}>
                  Manage Alerts
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UrgencyBanner({ count, onDispatch }: { count: number; onDispatch: () => void }) {
  return (
    <div className="urgency-banner">
      <ShieldCheck size={17} />
      <p>
        <strong>{count} {count === 1 ? 'rescue needs' : 'rescues need'} attention.</strong> Less than an hour remains in the safe window.
      </p>
      <Button variant="ghost" size="sm" onClick={onDispatch}>
        Review rescues<ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  )
}

