import { useEffect, useState, type FormEvent } from 'react'
import {
  Bell,
  Check,
  CircleDashed,
  Database,
  ExternalLink,
  Globe,
  LockKeyhole,
  Map,
  MessageCircle,
  Monitor,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/src/api'
import { cities } from '@/src/cities'
import {
  getPushNotificationStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  triggerTestPush,
  type PushStatus,
} from '@/src/lib/push-notifications'
import type { BackendHealth } from '@/src/use-pilot-data'
import type { AccountProfile } from '@/src/use-profile'

interface TelegramStatusResponse {
  configured: boolean
  target_configured: boolean
  chat_id: string | null
  bot: { id: number; first_name: string; username: string } | null
  recent_updates_count: number
  latest_sender: string | null
  error?: string | null
}

export function SettingsView({
  source,
  backend,
  cityId,
  onCityChange,
  accountEmail,
  profile,
  profileError,
  refreshProfile,
}: {
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
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    organization: '',
    phone: '',
    fssai_license: '',
    area: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  // Telegram state
  const [tgStatus, setTgStatus] = useState<TelegramStatusResponse | null>(null)
  const [loadingTgStatus, setLoadingTgStatus] = useState(false)
  const [detectingTg, setDetectingTg] = useState(false)
  const [testingTg, setTestingTg] = useState(false)
  const [manualChatId, setManualChatId] = useState('')
  const [savingManualChat, setSavingManualChat] = useState(false)

  // Web Push state
  const [pushStatus, setPushStatus] = useState<PushStatus>({
    supported: false,
    permission: 'default',
    subscribed: false,
    endpoint: null,
    isDesktop: false,
  })
  const [updatingPush, setUpdatingPush] = useState(false)
  const [testingPush, setTestingPush] = useState(false)

  useEffect(() => {
    if (
      profile?.active_city_id &&
      cities.some((city) => city.id === profile.active_city_id) &&
      profile.active_city_id !== cityId
    ) {
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

  // Load Telegram and Web Push status
  const fetchTelegramStatus = async () => {
    try {
      setLoadingTgStatus(true)
      const data = await apiRequest<TelegramStatusResponse>('/api/telegram/status')
      setTgStatus(data)
      if (data.chat_id) {
        setManualChatId(data.chat_id)
      }
    } catch {
      // Backend may be offline
    } finally {
      setLoadingTgStatus(false)
    }
  }

  const checkPushStatus = async () => {
    const status = await getPushNotificationStatus()
    setPushStatus(status)
  }

  useEffect(() => {
    void fetchTelegramStatus()
    void checkPushStatus()
  }, [])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true)
    try {
      await apiRequest<AccountProfile>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify(profileForm),
      })
      await refreshProfile()
      toast.success('Account details saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your account details.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function selectCity(nextCityId: string) {
    onCityChange(nextCityId)
    if (!accountEmail) return
    setSavingCity(true)
    try {
      await apiRequest<AccountProfile>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ active_city_id: nextCityId }),
      })
      await refreshProfile()
      toast.success('Your active city was saved to your account.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this city to your account.')
    } finally {
      setSavingCity(false)
    }
  }

  // Telegram Handlers
  async function handleDetectTelegramChat() {
    setDetectingTg(true)
    try {
      const res = await apiRequest<{
        success: boolean
        message: string
        chat_id?: string
        sender?: string
      }>('/api/telegram/detect', { method: 'POST' })

      if (res.success) {
        toast.success(res.message)
        await fetchTelegramStatus()
      } else {
        toast.error(res.message, { duration: 6000 })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to scan Telegram updates.')
    } finally {
      setDetectingTg(false)
    }
  }

  async function handleSaveManualChat() {
    if (!manualChatId.trim()) {
      toast.error('Please enter a valid Chat ID or Group ID.')
      return
    }
    setSavingManualChat(true)
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/telegram/configure', {
        method: 'POST',
        body: JSON.stringify({ chat_id: manualChatId.trim() }),
      })
      if (res.success) {
        toast.success(res.message)
        await fetchTelegramStatus()
      } else {
        toast.error(res.message)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to configure Telegram chat ID.')
    } finally {
      setSavingManualChat(false)
    }
  }

  async function handleTestTelegramAlert() {
    setTestingTg(true)
    try {
      const res = await apiRequest<{ sent: boolean; message_id?: number }>('/api/telegram/test-alert', {
        method: 'POST',
      })
      if (res.sent) {
        toast.success('Emergency test alert dispatched to Telegram!')
      } else {
        toast.error('Could not send alert. Check your chat ID.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test alert failed.')
    } finally {
      setTestingTg(false)
    }
  }

  // Web Push Handlers
  async function handleTogglePush() {
    setUpdatingPush(true)
    try {
      if (pushStatus.subscribed) {
        const res = await unsubscribeFromWebPush()
        if (res.success) {
          toast.success(res.message)
          await checkPushStatus()
        } else {
          toast.error(res.message)
        }
      } else {
        const res = await subscribeToWebPush(cityId)
        if (res.success) {
          toast.success(res.message)
          await checkPushStatus()
        } else {
          toast.error(res.message, { duration: 6000 })
        }
      }
    } finally {
      setUpdatingPush(false)
    }
  }

  async function handleTestWebPush() {
    setTestingPush(true)
    try {
      const res = await triggerTestPush(cityId)
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } finally {
      setTestingPush(false)
    }
  }

  const isTelegramReady = !!(tgStatus?.target_configured || backend?.telegram_target)

  const integrations = [
    {
      name: 'Supabase Auth + Postgres',
      description: 'Signed-in API requests with city-scoped RLS',
      icon: Database,
      ready: source === 'supabase',
      status:
        source === 'supabase'
          ? 'Connected'
          : source === 'offline'
          ? 'Not configured'
          : 'Sign in / check connection',
    },
    {
      name: 'OpenStreetMap basemap',
      description: 'Live map tiles with OpenStreetMap attribution',
      icon: Map,
      ready: true,
      status: 'Available',
    },
    {
      name: 'OpenRouteService',
      description: 'Road directions for dispatch comparison',
      icon: Route,
      ready: backend?.routing === 'ors',
      status: backend?.routing === 'ors' ? 'Key configured · checked on request' : 'Add ORS_API_KEY to the backend environment',
    },
    {
      name: 'FastAPI',
      description: 'Authenticated API for profiles, live data, and dispatch',
      icon: ShieldCheck,
      ready: !!backend?.ok,
      status: backend?.ok ? 'Running' : 'Offline',
    },
    {
      name: 'Gemini intake',
      description: 'Structured extraction; send only operational text that is safe to share',
      icon: Sparkles,
      ready: !!backend?.gemini,
      status: backend?.gemini ? 'Configured' : 'Not configured',
    },
    {
      name: 'Telegram Bot',
      description: 'Emergency food rescue broadcasts and safe-window escalation dispatch',
      icon: MessageCircle,
      ready: isTelegramReady,
      status: isTelegramReady
        ? `Configured (${tgStatus?.chat_id ? `ID: ${tgStatus.chat_id}` : 'Active'})`
        : tgStatus?.configured || backend?.telegram
        ? 'Needs chat ID'
        : 'Not configured',
    },
    {
      name: 'Web Push Notifications',
      description: 'Instant browser rescue notifications for expiring donations and new matches',
      icon: Bell,
      ready: pushStatus.subscribed,
      status: pushStatus.subscribed
        ? 'Enabled on this browser'
        : pushStatus.supported
        ? 'Supported (Inactive)'
        : 'Unsupported in browser',
    },
  ]

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Account and network</h2>
          <Badge variant="outline">{source === 'supabase' ? 'Live account' : 'Local demo'}</Badge>
        </div>
        <div className="integration-list">
          <div className="integration-row">
            <span className="integration-icon">
              <LockKeyhole size={19} />
            </span>
            <div>
              <h3>Signed-in account</h3>
              <p>{accountEmail ?? 'Sign in to view your account'}</p>
            </div>
            <Badge variant="outline">
              {profile?.role ?? (profileError ? 'Profile unavailable' : 'Checking…')}
            </Badge>
          </div>
          {profile?.requested_role && profile.requested_role !== profile.role && (
            <div className="integration-row">
              <span className="integration-icon">
                <CircleDashed size={19} />
              </span>
              <div>
                <h3>Role request</h3>
                <p>{profile.requested_role} access needs organization verification</p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          )}
          {profile?.organization && (
            <div className="integration-row">
              <span className="integration-icon">
                <ShieldCheck size={19} />
              </span>
              <div>
                <h3>Organization</h3>
                <p>{profile.organization}</p>
              </div>
              <Badge variant="outline">{profile.display_name}</Badge>
            </div>
          )}
          <div className="integration-row">
            <span className="integration-icon">
              <Globe size={19} />
            </span>
            <div>
              <h3>Active city</h3>
              <p>
                {profile
                  ? 'Stored in your account and used to scope live records.'
                  : 'Select a city to view its network.'}
              </p>
            </div>
            <label className="sr-only" htmlFor="active-city">
              Active city
            </label>
            <select
              id="active-city"
              value={cityId}
              disabled={savingCity}
              onChange={(event) => void selectCity(event.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}, {city.state}
                </option>
              ))}
            </select>
          </div>
        </div>

        {profile && (
          <form className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={saveProfile}>
            <label className="grid gap-1 text-xs font-medium">
              Display name
              <Input
                value={profileForm.display_name}
                maxLength={100}
                onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
                required
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Organization
              <Input
                value={profileForm.organization}
                maxLength={160}
                onChange={(e) => setProfileForm({ ...profileForm, organization: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Phone
              <Input
                value={profileForm.phone}
                maxLength={40}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                type="tel"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              FSSAI license
              <Input
                value={profileForm.fssai_license}
                maxLength={40}
                onChange={(e) => setProfileForm({ ...profileForm, fssai_license: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium sm:col-span-2">
              Area / service address
              <Input
                value={profileForm.area}
                maxLength={160}
                onChange={(e) => setProfileForm({ ...profileForm, area: e.target.value })}
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save account details'}
              </Button>
            </div>
          </form>
        )}

        {/* ==================== TELEGRAM BOT DISPATCH CONTROL ==================== */}
        <div className="panel-header mt-6">
          <div className="flex items-center gap-2">
            <MessageCircle size={17} className="text-emerald-500" />
            <h2>Telegram Bot Integration</h2>
          </div>
          <Badge variant={isTelegramReady ? 'secondary' : 'outline'}>
            {isTelegramReady ? <Check size={12} className="mr-1 inline text-emerald-500" /> : <CircleDashed size={12} className="mr-1 inline" />}
            {isTelegramReady ? 'Destination Configured' : 'Needs Chat ID'}
          </Badge>
        </div>

        <div className="mt-3 rounded-xl border border-border/70 bg-card/60 p-4 text-xs leading-relaxed space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/50">
            <div>
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span>Bot:</span>
                <span className="text-emerald-500 font-mono">@{tgStatus?.bot?.username ?? 'ahaarsetu_bot'}</span>
                <span className="text-muted-foreground font-normal">({tgStatus?.bot?.first_name ?? 'AhaarSetu'})</span>
              </div>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                {isTelegramReady
                  ? `Active broadcast target: Chat ID ${tgStatus?.chat_id || manualChatId}`
                  : 'Telegram bots cannot initiate unsolicited messages. Open the bot and press Start to enable alerts.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <a
                href={`https://t.me/${tgStatus?.bot?.username ?? 'ahaarsetu_bot'}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1.5 rounded-lg transition-colors border border-emerald-500/20"
              >
                Open Bot <ExternalLink size={11} />
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchTelegramStatus}
                disabled={loadingTgStatus}
                title="Refresh Telegram status"
              >
                <RefreshCw size={13} className={loadingTgStatus ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          {!isTelegramReady && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-700 dark:text-amber-300 text-[11px] space-y-1.5">
              <div className="font-medium flex items-center gap-1">
                <span>⚠️ Why it shows "Needs chat ID":</span>
              </div>
              <p>
                The server has the Telegram bot token, but Telegram prevents bots from messaging someone without knowing their user or group <strong>Chat ID</strong>.
              </p>
              <div className="font-medium pt-1">Quick 2-step setup:</div>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground dark:text-amber-200/80">
                <li>
                  Click <strong>Open Bot</strong> above (or search <code>@{tgStatus?.bot?.username ?? 'ahaarsetu_bot'}</code> on Telegram) and tap <strong>Start</strong>.
                </li>
                <li>
                  Click the <strong>Auto-Detect Chat ID</strong> button below!
                </li>
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleDetectTelegramChat}
              disabled={detectingTg}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {detectingTg ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {detectingTg ? 'Scanning updates…' : 'Auto-Detect Chat ID from /start'}
            </Button>

            {isTelegramReady && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestTelegramAlert}
                disabled={testingTg}
                className="gap-1.5 text-xs"
              >
                <Send size={12} className={testingTg ? 'animate-pulse' : ''} />
                {testingTg ? 'Sending…' : 'Send Test Alert'}
              </Button>
            )}
          </div>

          <details className="text-[11px] text-muted-foreground pt-1">
            <summary className="cursor-pointer hover:text-foreground font-medium select-none">
              Or manually set a Telegram Chat ID or Group ID
            </summary>
            <div className="mt-2 flex items-center gap-2 max-w-sm">
              <Input
                placeholder="e.g. 12345678 or -100123456789"
                value={manualChatId}
                onChange={(e) => setManualChatId(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveManualChat}
                disabled={savingManualChat}
                className="h-8 text-xs shrink-0"
              >
                {savingManualChat ? 'Saving…' : 'Save ID'}
              </Button>
            </div>
          </details>
        </div>

        {/* ==================== WEB PUSH NOTIFICATIONS ==================== */}
        <div className="panel-header mt-6">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-emerald-500" />
            <h2>Web Push Notifications</h2>
          </div>
          <Badge variant={pushStatus.subscribed ? 'secondary' : 'outline'}>
            {pushStatus.subscribed ? <Check size={12} className="mr-1 inline text-emerald-500" /> : <CircleDashed size={12} className="mr-1 inline" />}
            {pushStatus.subscribed ? 'Active' : pushStatus.permission === 'denied' ? 'Blocked' : 'Inactive'}
          </Badge>
        </div>

        <div className="mt-3 rounded-xl border border-border/70 bg-card/60 p-4 text-xs leading-relaxed space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <span>{pushStatus.isDesktop ? 'Desktop System & Web Push Alerts' : 'Real-Time Browser Dispatch Alerts'}</span>
                {pushStatus.isDesktop && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Monitor size={10} className="mr-1 inline" /> Desktop Ready
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                {pushStatus.isDesktop
                  ? 'Receive native Windows & macOS Notification Center popups with audible emergency chimes even when the browser is minimized.'
                  : 'Receive instant notifications on your browser when a new food donation is posted or safe-window expiry escalates.'}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                size="sm"
                variant={pushStatus.subscribed ? 'outline' : 'default'}
                onClick={handleTogglePush}
                disabled={updatingPush || !pushStatus.supported}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Bell size={12} />
                {updatingPush
                  ? 'Configuring…'
                  : pushStatus.subscribed
                  ? 'Unsubscribe'
                  : pushStatus.isDesktop
                  ? 'Enable Desktop Push'
                  : 'Enable Push Alerts'}
              </Button>
              {pushStatus.subscribed && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleTestWebPush}
                  disabled={testingPush}
                  className="gap-1.5 text-xs"
                >
                  <Volume2 size={12} className={testingPush ? 'animate-pulse text-emerald-500' : ''} />
                  {testingPush ? 'Testing…' : 'Test Desktop Alert & Chime'}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="rounded-lg bg-background/50 border border-border/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Environment</span>
              <span className="font-medium text-foreground flex items-center gap-1">
                {pushStatus.isDesktop ? <Monitor size={12} /> : null}
                {pushStatus.isDesktop ? 'Desktop OS' : 'Mobile / Tablet'}
              </span>
            </div>
            <div className="rounded-lg bg-background/50 border border-border/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Notification API</span>
              <span className="font-medium text-foreground">
                {pushStatus.supported ? 'Supported' : 'Not supported'}
              </span>
            </div>
            <div className="rounded-lg bg-background/50 border border-border/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Permission</span>
              <span className="font-medium capitalize text-foreground">
                {pushStatus.permission}
              </span>
            </div>
            <div className="rounded-lg bg-background/50 border border-border/40 p-2">
              <span className="text-muted-foreground block text-[10px]">Subscribers</span>
              <span className="font-medium text-foreground">
                {backend?.web_push_subscribers ?? (pushStatus.subscribed ? 1 : 0)} connected
              </span>
            </div>
          </div>
        </div>

        {/* ==================== GENERAL SERVICE CONNECTIONS ==================== */}
        <div className="panel-header mt-6">
          <h2>Service connections</h2>
          <Badge variant="outline">Live status</Badge>
        </div>
        <div className="integration-list">
          {integrations.map((item) => (
            <div className="integration-row" key={item.name}>
              <span className="integration-icon">
                <item.icon size={19} />
              </span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <Badge variant={item.ready ? 'secondary' : 'outline'}>
                {item.ready ? <Check size={12} className="mr-1 inline text-emerald-500" /> : <CircleDashed size={12} className="mr-1 inline" />}
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-5">
        <section className="panel settings-note">
          <LockKeyhole size={23} />
          <h2>Roles are server controlled.</h2>
          <p>
            Your account role is read from the protected profile record. Signup metadata cannot grant
            coordinator or dispatch access.
          </p>
          <p>Coordinators must be provisioned by an administrator.</p>
        </section>
        <section className="panel settings-note">
          <h2>City network</h2>
          <dl>
            <div>
              <dt>City</dt>
              <dd>{cities.find((city) => city.id === cityId)?.name ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{cities.find((city) => city.id === cityId)?.timezone ?? '—'}</dd>
            </div>
            <div>
              <dt>Data mode</dt>
              <dd>
                {source === 'supabase'
                  ? 'Authenticated Supabase data'
                  : source === 'offline'
                  ? 'Bengaluru synthetic demo only'
                  : 'No live data loaded'}
              </dd>
            </div>
            <div>
              <dt>Backend</dt>
              <dd>FastAPI / Python</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
