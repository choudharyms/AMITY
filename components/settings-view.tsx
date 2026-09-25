import { useEffect, useState, type FormEvent } from 'react'
import {
  Bell,
  Bike,
  Building2,
  Check,
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  Globe,
  HeartHandshake,
  LockKeyhole,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Monitor,
  Phone,
  RefreshCw,
  Route,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  User,
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
      status: !backend?.ok
        ? 'Awaiting backend connection'
        : backend?.routing === 'ors'
        ? 'Key configured · checked on request'
        : 'Add ORS_API_KEY to the backend environment',
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
      status: !backend?.ok
        ? 'Awaiting backend connection'
        : backend?.gemini
        ? 'Configured'
        : 'Add GEMINI_API_KEY to the backend environment',
    },
    {
      name: 'Telegram Bot',
      description: 'Emergency food rescue broadcasts and safe-window escalation dispatch',
      icon: MessageCircle,
      ready: isTelegramReady,
      status: !backend?.ok
        ? 'Awaiting backend connection'
        : isTelegramReady
        ? `Configured (${tgStatus?.chat_id ? `ID: ${tgStatus.chat_id}` : 'Active'})`
        : tgStatus?.configured || backend?.telegram
        ? 'Needs chat ID'
        : 'Add TELEGRAM_BOT_TOKEN to backend',
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
      <div className="flex flex-col gap-6">
        <section className="panel account-panel">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <User size={16} />
            </span>
            <h2 className="font-display font-bold">Account & Verified Identity</h2>
          </div>
          <Badge variant={source === 'supabase' ? 'secondary' : 'outline'} className="text-[11px] font-medium">
            {source === 'supabase' ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Account
              </span>
            ) : (
              'Local Pilot Mode'
            )}
          </Badge>
        </div>

        <div className="p-5 space-y-5">
          {/* Identity Hero Card */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-emerald-500/5 p-5 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold text-lg flex items-center justify-center shadow-md font-display tracking-tight">
                    {profile?.display_name?.trim()
                      ? profile.display_name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      : accountEmail ? accountEmail.slice(0, 2).toUpperCase() : 'AS'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card ring-1 ring-emerald-400/40" title="Active Verified Session" />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-foreground font-display">
                      {profile?.display_name || (accountEmail ? accountEmail.split('@')[0] : 'Rescue Partner')}
                    </h3>
                    <Badge variant="secondary" className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 capitalize">
                      {profile?.role === 'coordinator' && <ShieldCheck size={12} className="mr-1 inline text-emerald-500" />}
                      {profile?.role === 'donor' && <Store size={12} className="mr-1 inline text-amber-500" />}
                      {profile?.role === 'driver' && <Bike size={12} className="mr-1 inline text-blue-500" />}
                      {(profile?.role === 'recipient' || profile?.role === 'shelter') && <HeartHandshake size={12} className="mr-1 inline text-purple-500" />}
                      {profile?.role ? `${profile.role} partner` : 'Member'}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {profile?.organization ? (
                      <span className="flex items-center gap-1 font-medium text-foreground/80">
                        <Building2 size={12} className="text-emerald-500" />
                        {profile.organization}
                      </span>
                    ) : (
                      'Independent Food Rescue Participant'
                    )}
                    <span>·</span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Mail size={11} className="text-muted-foreground" />
                      {accountEmail ?? 'Not authenticated'}
                    </span>
                  </p>
                </div>
              </div>

              {profile?.fssai_license && (
                <div className="self-start sm:self-auto bg-muted/50 border border-border/60 rounded-xl px-3 py-2 text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">FSSAI Status</span>
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                    <CheckCircle2 size={12} /> {profile.fssai_license}
                  </span>
                </div>
              )}
            </div>

            {profile?.requested_role && profile.requested_role !== profile.role && (
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                <span className="flex items-center gap-1.5 font-medium">
                  <CircleDashed size={14} className="animate-spin" /> Role elevation to <strong>{profile.requested_role}</strong> pending coordinator verification
                </span>
                <Badge variant="outline" className="text-[10px] bg-background">In review</Badge>
              </div>
            )}
          </div>

          {/* Operational City Territory Switcher */}
          <div className="p-4 rounded-xl border border-border/80 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Globe size={18} />
              </span>
              <div>
                <strong className="text-xs text-foreground block font-semibold">Active Operational Territory</strong>
                <span className="text-[11px] text-muted-foreground">
                  Scopes dispatch routes, shelter capacity, and live inventory to this municipal zone.
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <select
                id="active-city"
                value={cityId}
                disabled={savingCity}
                onChange={(event) => void selectCity(event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground cursor-pointer transition-colors focus:border-emerald-500 outline-none"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} Network ({city.state})
                  </option>
                ))}
              </select>
              {savingCity && <CircleDashed size={14} className="animate-spin text-emerald-500" />}
            </div>
          </div>

          {/* Account Profile Form */}
          {profile ? (
            <form className="space-y-4 pt-1" onSubmit={saveProfile}>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
                <User size={13} className="text-emerald-500" />
                Profile & Operational Credentials
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="account-display-name" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <User size={13} className="text-muted-foreground" /> Display Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="account-display-name"
                    value={profileForm.display_name}
                    maxLength={100}
                    onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
                    required
                    placeholder="Your legal or operational name"
                    className="h-10 text-sm bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="account-organization" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 size={13} className="text-muted-foreground" /> Organization / Entity Name
                  </label>
                  <Input
                    id="account-organization"
                    value={profileForm.organization}
                    maxLength={160}
                    onChange={(e) => setProfileForm({ ...profileForm, organization: e.target.value })}
                    placeholder="e.g. Hotel Ashok, Akshaya Patra, Robin Hood Army"
                    className="h-10 text-sm bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="account-phone" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Phone size={13} className="text-muted-foreground" /> Phone Number (Dispatch Contact)
                  </label>
                  <Input
                    id="account-phone"
                    value={profileForm.phone}
                    maxLength={40}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="h-10 text-sm bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="account-fssai" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-muted-foreground" /> FSSAI Registration / License
                  </label>
                  <Input
                    id="account-fssai"
                    value={profileForm.fssai_license}
                    maxLength={40}
                    onChange={(e) => setProfileForm({ ...profileForm, fssai_license: e.target.value })}
                    placeholder="14-digit FSSAI number (e.g. 11223344556677)"
                    className="h-10 text-sm bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="account-area" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin size={13} className="text-muted-foreground" /> Operating Area / Landmark Address
                  </label>
                  <Input
                    id="account-area"
                    value={profileForm.area}
                    maxLength={160}
                    onChange={(e) => setProfileForm({ ...profileForm, area: e.target.value })}
                    placeholder="e.g. Indiranagar 100ft Road / Koramangala 4th Block"
                    className="h-10 text-sm bg-background border-border"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Button type="submit" disabled={savingProfile} className="h-10 px-5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                  {savingProfile ? (
                    <>
                      <CircleDashed size={14} className="mr-1.5 animate-spin" /> Saving changes…
                    </>
                  ) : (
                    'Save account details'
                  )}
                </Button>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <LockKeyhole size={12} className="text-emerald-500 shrink-0" />
                  <span>Encrypted & protected by Supabase Row-Level Security</span>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border text-center">
              <p className="text-xs text-muted-foreground">Sign in to edit and manage your network profile credentials.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
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
    </div>

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
