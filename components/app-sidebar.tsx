import { useState, useRef, useEffect } from 'react'
import {
  ArrowUpRight,
  Bike,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Globe,
  HeartHandshake,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  X,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Section } from '@/src/types'
import { cities, type City } from '@/src/cities'
import type { Session } from '@supabase/supabase-js'
import type { AccountProfile } from '@/src/use-profile'

// Role-based nav: each role only sees what's relevant to them
function roleNav(role?: AccountProfile['role']) {
  if (role === 'coordinator') {
    return [
      { id: 'overview' as Section, label: 'Overview', icon: LayoutDashboard },
      { id: 'donations' as Section, label: 'Donations', icon: Boxes },
      { id: 'dispatch' as Section, label: 'Dispatch & routes', icon: Route },
      { id: 'recipients' as Section, label: 'Recipients', icon: HeartHandshake },
      { id: 'drivers' as Section, label: 'Volunteer drivers', icon: Bike },
    ]
  }
  if (role === 'donor') {
    return [
      { id: 'overview' as Section, label: 'Overview', icon: LayoutDashboard },
      { id: 'donations' as Section, label: 'My donations', icon: Boxes },
    ]
  }
  if (role === 'driver') {
    return [
      { id: 'overview' as Section, label: 'Overview', icon: LayoutDashboard },
      { id: 'dispatch' as Section, label: 'My pickups', icon: Bike },
    ]
  }
  if (role === 'recipient' || role === 'shelter') {
    return [
      { id: 'overview' as Section, label: 'Overview', icon: LayoutDashboard },
      { id: 'donations' as Section, label: 'Incoming food', icon: Boxes },
      { id: 'recipients' as Section, label: 'My organisation', icon: HeartHandshake },
    ]
  }
  // Default / unauthenticated
  return [
    { id: 'overview' as Section, label: 'Overview', icon: LayoutDashboard },
    { id: 'donations' as Section, label: 'Donations', icon: Boxes },
    { id: 'dispatch' as Section, label: 'Dispatch & routes', icon: Route },
    { id: 'recipients' as Section, label: 'Recipients', icon: HeartHandshake },
    { id: 'drivers' as Section, label: 'Volunteer drivers', icon: Bike },
  ]
}

export const sectionNames: Record<Section, string> = {
  overview: 'Overview',
  workspaces: 'City workspaces',
  donations: 'Donations',
  dispatch: 'Dispatch & routes',
  recipients: 'Recipients',
  drivers: 'Volunteer drivers',
  impact: 'Impact & reports',
  settings: 'Workspace settings',
}

const roleLabel: Record<AccountProfile['role'], string> = {
  coordinator: 'Network Coordinator',
  donor: 'Food Donor',
  driver: 'Volunteer Driver',
  recipient: 'Recipient Organisation',
  shelter: 'Shelter',
}

export function AppSidebar({
  section,
  setSection,
  mobileOpen,
  close,
  session,
  profile,
  signIn,
  signOut,
  activeCount,
  help,
  cityId,
  onCityChange,
  source,
  onBackToLanding,
  collapsed,
  onToggleCollapsed,
}: {
  section: Section
  setSection: (section: Section) => void
  mobileOpen: boolean
  close: () => void
  session: Session | null | undefined
  profile?: AccountProfile
  signIn: () => void
  signOut: () => void
  activeCount?: number
  help: () => void
  cityId?: string
  onCityChange?: (cityId: string) => void
  source?: 'supabase' | 'offline' | 'unavailable'
  onBackToLanding?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed
  const toggleCollapse = onToggleCollapsed ?? (() => setInternalCollapsed(prev => !prev))

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const currentCity = cities.find(c => c.id === cityId) ?? cities[0]

  const navigate = (next: Section) => {
    setSection(next)
    setDropdownOpen(false)
    close()
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  function handleCitySelect(c: City) {
    if (onCityChange) {
      onCityChange(c.id)
    }
    setDropdownOpen(false)
  }

  const navItems = roleNav(profile?.role)
  const initials = profile?.display_name?.trim()
    ? profile.display_name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : undefined

  const cityCode = currentCity.name.slice(0, 3).toUpperCase()

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          'app-sidebar',
          isCollapsed && 'is-collapsed',
          mobileOpen && 'is-open'
        )}
        aria-label="Application navigation"
      >
        {/* Header Section */}
        {!isCollapsed ? (
          <div className="sidebar-header">
            <a
              className="brand"
              href="#overview"
              onClick={() => navigate('overview')}
              aria-label="AaharSetu home"
            >
              <span className="brand-icon-wrapper">
                <img src="/surplus-logo.jpg" alt="AaharSetu logo" className="brand-logo-img" />
                <span className="brand-status-beacon" title="Live mesh telemetry active" />
              </span>
              <span className="brand-text">
                <span className="brand-title">AaharSetu</span>
                <span className="brand-subline">Food Rescue Bridge</span>
              </span>
            </a>

            <div className="sidebar-header-controls">
              <Button
                variant="ghost"
                size="icon-xs"
                className="sidebar-collapse-trigger hidden md:inline-flex"
                aria-label="Collapse sidebar (Ctrl+B)"
                title="Collapse sidebar (Ctrl+B)"
                onClick={toggleCollapse}
              >
                <PanelLeftClose size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="mobile-sidebar-close md:hidden"
                aria-label="Close navigation"
                onClick={close}
              >
                <X size={17} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="sidebar-header-collapsed">
            <a
              className="brand-collapsed"
              href="#overview"
              onClick={() => navigate('overview')}
              aria-label="AaharSetu home"
              title="AaharSetu • Food Rescue Bridge"
            >
              <span className="brand-icon-wrapper">
                <img src="/surplus-logo.jpg" alt="AaharSetu logo" className="brand-logo-img" />
                <span className="brand-status-beacon" />
              </span>
            </a>
            <Button
              variant="ghost"
              size="icon-xs"
              className="sidebar-expand-trigger hidden md:inline-flex"
              aria-label="Expand sidebar (Ctrl+B)"
              title="Expand sidebar (Ctrl+B)"
              onClick={toggleCollapse}
            >
              <PanelLeftOpen size={16} />
            </Button>
          </div>
        )}

        {/* Dynamic Workspace Picker with interactive city switcher */}
        <div className="relative mb-3.5" ref={dropdownRef}>
          {!isCollapsed ? (
            <button
              type="button"
              className="workspace-picker w-full group transition-all hover:border-emerald-600/50 cursor-pointer"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
              aria-label="Change city workspace"
            >
              <span className="workspace-icon bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <MapPin size={15} />
              </span>
              <span className="workspace-details">
                <strong className="text-foreground">{currentCity.name} network</strong>
                <small className="text-muted-foreground">
                  {session && profile ? roleLabel[profile.role] : `${currentCity.state} · ${source === 'supabase' ? 'Live workspace' : 'Pilot demo'}`}
                </small>
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  'transition-transform duration-200 text-muted-foreground group-hover:text-foreground shrink-0',
                  dropdownOpen && 'rotate-180 text-primary'
                )}
              />
            </button>
          ) : (
            <div className="sidebar-tooltip-wrapper">
              <button
                type="button"
                className="workspace-picker-collapsed"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-label={`City: ${currentCity.name}`}
              >
                <MapPin size={17} className="text-emerald-600 dark:text-emerald-400" />
                <span className="workspace-badge-code">{cityCode}</span>
              </button>
              <div className="sidebar-tooltip">
                <span>{currentCity.name} ({cityCode}) · Click to switch</span>
              </div>
            </div>
          )}

          {dropdownOpen && (
            <div
              className={cn(
                'absolute z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-2.5 max-h-80 overflow-y-auto animate-in fade-in-50 slide-in-from-top-1',
                isCollapsed
                  ? 'left-full top-0 ml-3 w-64'
                  : 'top-full left-0 right-0 mt-1.5'
              )}
            >
              <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground flex items-center justify-between border-b border-border/50 mb-1.5">
                <span>SELECT CITY WORKSPACE</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                  {cities.length} cities
                </Badge>
              </div>
              <div className="space-y-0.5">
                {cities.map(c => {
                  const isCurrent = c.id === currentCity.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCitySelect(c)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer',
                        isCurrent
                          ? 'bg-emerald-50 text-emerald-950 font-semibold dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MapPin
                          size={14}
                          className={isCurrent ? 'text-emerald-600 dark:text-emerald-400 shrink-0' : 'text-muted-foreground shrink-0'}
                        />
                        <div className="truncate">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.state}</div>
                        </div>
                      </div>
                      {isCurrent && <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-1.5" />}
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-border/50 mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('workspaces')}
                  className="w-full text-center text-[11px] text-primary hover:underline py-1 font-medium cursor-pointer"
                >
                  Browse all city networks →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Telemetry / Network Health Strip */}
        {!isCollapsed && (
          <div className="sidebar-telemetry-pill">
            <div className="flex items-center gap-2 min-w-0">
              <span className="telemetry-beacon-dot" />
              <span className="truncate text-[11px] font-medium text-foreground/80">
                {source === 'supabase' ? 'Supabase Realtime' : 'Pilot Local Mesh'}
              </span>
            </div>
            {activeCount !== undefined && activeCount > 0 ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 font-mono">
                {activeCount} active
              </Badge>
            ) : (
              <span className="text-[10px] font-mono text-muted-foreground">Ready</span>
            )}
          </div>
        )}

        {/* Workspace Navigation */}
        {!isCollapsed ? (
          <>
            <div className="nav-section-label">WORKSPACE</div>
            <nav aria-label="Main navigation" className="sidebar-nav">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={cn('nav-item group', section === id && 'active')}
                  aria-current={section === id ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.75} className="nav-item-icon" />
                  <span className="nav-item-label">{label}</span>
                  {id === 'donations' && activeCount !== undefined && activeCount > 0 && (
                    <span className="nav-count">{activeCount}</span>
                  )}
                  {section === id && <span className="nav-active-pill" />}
                </button>
              ))}
            </nav>
          </>
        ) : (
          <nav aria-label="Main navigation" className="sidebar-nav-collapsed">
            {navItems.map(({ id, label, icon: Icon }) => (
              <div key={id} className="sidebar-tooltip-wrapper">
                <button
                  onClick={() => navigate(id)}
                  className={cn('nav-item-collapsed', section === id && 'active')}
                  aria-current={section === id ? 'page' : undefined}
                  aria-label={label}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  {id === 'donations' && activeCount !== undefined && activeCount > 0 && (
                    <span className="nav-collapsed-badge">
                      {activeCount > 9 ? '9+' : activeCount}
                    </span>
                  )}
                  {section === id && <span className="nav-active-indicator-collapsed" />}
                </button>
                <div className="sidebar-tooltip">
                  <span>{label}</span>
                  {id === 'donations' && activeCount !== undefined && activeCount > 0 && (
                    <span className="sidebar-tooltip-badge">{activeCount} pending</span>
                  )}
                </div>
              </div>
            ))}
          </nav>
        )}

        {/* Insights Navigation */}
        {!isCollapsed ? (
          <>
            <div className="nav-section-label mt-6">INSIGHTS</div>
            <nav aria-label="Workspace insights" className="sidebar-nav">
              <button
                onClick={() => navigate('impact')}
                className={cn('nav-item group', section === 'impact' && 'active')}
                aria-current={section === 'impact' ? 'page' : undefined}
              >
                <Sprout size={18} strokeWidth={1.75} className="nav-item-icon" />
                <span className="nav-item-label">Impact & reports</span>
                {section === 'impact' && <span className="nav-active-pill" />}
              </button>
              <button
                onClick={() => navigate('settings')}
                className={cn('nav-item group', section === 'settings' && 'active')}
                aria-current={section === 'settings' ? 'page' : undefined}
              >
                <Settings2 size={18} strokeWidth={1.75} className="nav-item-icon" />
                <span className="nav-item-label">Workspace settings</span>
                {section === 'settings' && <span className="nav-active-pill" />}
              </button>
            </nav>
          </>
        ) : (
          <>
            <div className="sidebar-divider-collapsed" />
            <nav aria-label="Workspace insights" className="sidebar-nav-collapsed">
              <div className="sidebar-tooltip-wrapper">
                <button
                  onClick={() => navigate('impact')}
                  className={cn('nav-item-collapsed', section === 'impact' && 'active')}
                  aria-current={section === 'impact' ? 'page' : undefined}
                  aria-label="Impact & reports"
                >
                  <Sprout size={19} strokeWidth={1.8} />
                  {section === 'impact' && <span className="nav-active-indicator-collapsed" />}
                </button>
                <div className="sidebar-tooltip">Impact & reports</div>
              </div>
              <div className="sidebar-tooltip-wrapper">
                <button
                  onClick={() => navigate('settings')}
                  className={cn('nav-item-collapsed', section === 'settings' && 'active')}
                  aria-current={section === 'settings' ? 'page' : undefined}
                  aria-label="Workspace settings"
                >
                  <Settings2 size={19} strokeWidth={1.8} />
                  {section === 'settings' && <span className="nav-active-indicator-collapsed" />}
                </button>
                <div className="sidebar-tooltip">Workspace settings</div>
              </div>
            </nav>
          </>
        )}

        <div className="sidebar-spacer" />

        {/* Purpose / Impact Card */}
        {!isCollapsed ? (
          <div className="purpose-card">
            <span className="purpose-icon">
              <HeartHandshake size={20} strokeWidth={1.7} />
            </span>
            <h3>Less waste.<br />More possibility.</h3>
            <p>Every rescue is a small act with a lasting community impact.</p>
            <button onClick={() => navigate('impact')}>
              Explore your impact <ArrowUpRight size={14} />
            </button>
          </div>
        ) : (
          <div className="sidebar-tooltip-wrapper mb-2">
            <button
              onClick={() => navigate('impact')}
              className="purpose-btn-collapsed"
              aria-label="Mission & Impact"
            >
              <HeartHandshake size={19} strokeWidth={1.8} className="text-emerald-600 dark:text-emerald-400" />
            </button>
            <div className="sidebar-tooltip">Our Mission & Impact</div>
          </div>
        )}

        {/* Utility Links */}
        {!isCollapsed ? (
          <div className="sidebar-utility-links">
            {onBackToLanding && (
              <button className="help-link" onClick={onBackToLanding}>
                <Sparkles size={16} />
                <span>Interactive story / Landing</span>
                <ArrowUpRight size={13} className="ml-auto opacity-70" />
              </button>
            )}
            <button className="help-link" onClick={help}>
              <CircleHelp size={16} />
              <span>Help & safety guidelines</span>
              <ArrowUpRight size={13} className="ml-auto opacity-70" />
            </button>
          </div>
        ) : (
          <div className="sidebar-utilities-collapsed">
            {onBackToLanding && (
              <div className="sidebar-tooltip-wrapper">
                <button className="nav-item-collapsed utility-icon-btn" onClick={onBackToLanding} aria-label="Interactive Story">
                  <Sparkles size={17} />
                </button>
                <div className="sidebar-tooltip">Interactive story / Landing</div>
              </div>
            )}
            <div className="sidebar-tooltip-wrapper">
              <button className="nav-item-collapsed utility-icon-btn" onClick={help} aria-label="Help & guidelines">
                <CircleHelp size={17} />
              </button>
              <div className="sidebar-tooltip">Help & safety guidelines</div>
            </div>
          </div>
        )}

        {/* Profile Footer */}
        {!isCollapsed ? (
          <div className="sidebar-profile">
            <span className="profile-avatar">
              {session && initials ? (
                <span className="font-bold text-xs">{initials}</span>
              ) : session ? (
                <Users size={17} />
              ) : (
                <ShieldCheck size={18} />
              )}
            </span>
            <button onClick={signIn} className="profile-text text-left">
              <strong>{session ? (profile?.display_name || session.user.email?.split('@')[0] || 'Rescue partner') : 'Pilot visitor'}</strong>
              <small>{session ? (profile ? roleLabel[profile.role] : 'Loading profile…') : 'Sign in to participate'}</small>
            </button>
            {session && (
              <Button variant="ghost" size="icon-xs" aria-label="Sign out" onClick={signOut} title="Sign out" className="shrink-0 text-muted-foreground hover:text-destructive">
                <LogOut size={15} />
              </Button>
            )}
          </div>
        ) : (
          <div className="sidebar-profile-collapsed">
            <div className="sidebar-tooltip-wrapper">
              <button
                onClick={signIn}
                className="profile-avatar-btn-collapsed"
                aria-label={session ? (profile?.display_name || 'My profile') : 'Sign in'}
              >
                {session && initials ? (
                  <span className="font-bold text-xs">{initials}</span>
                ) : session ? (
                  <Users size={17} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                <span className="profile-status-dot" />
              </button>
              <div className="sidebar-tooltip">
                <div className="flex flex-col">
                  <strong>{session ? (profile?.display_name || session.user.email?.split('@')[0] || 'Rescue partner') : 'Pilot visitor'}</strong>
                  <small className="text-[10px] text-muted-foreground">{session && profile ? roleLabel[profile.role] : 'Click to sign in'}</small>
                </div>
              </div>
            </div>

            {session && (
              <div className="sidebar-tooltip-wrapper mt-1">
                <button
                  onClick={signOut}
                  className="nav-item-collapsed utility-icon-btn text-muted-foreground hover:text-destructive"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
                <div className="sidebar-tooltip">Sign out</div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
