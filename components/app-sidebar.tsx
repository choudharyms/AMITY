import { useState, useRef, useEffect } from 'react'
import { ArrowUpRight, Bike, Boxes, Check, ChevronDown, CircleHelp, Globe, HeartHandshake, LayoutDashboard, Leaf, LogOut, MapPin, Route, Settings2, ShieldCheck, Sparkles, Sprout, UserCog, Users, X } from 'lucide-react'
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
  settings: 'Account & settings',
}

export const roleLabel: Record<AccountProfile['role'], string> = {
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
}) {
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

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={close} />}
      <aside className={cn('app-sidebar', mobileOpen && 'is-open')}>
        <a className="brand" href="#overview" onClick={() => navigate('overview')} aria-label="AaharSetu home">
          <span className="brand-icon-wrapper">
            <img src="/surplus-logo.jpg" alt="AaharSetu logo" className="brand-logo-img" />
          </span>
          <span>
            AaharSetu<span className="brand-subline">Food Rescue Bridge</span>
          </span>
        </a>
        <Button variant="ghost" size="icon" className="mobile-sidebar-close" aria-label="Close navigation" onClick={close}>
          <X />
        </Button>

        {/* Dynamic Workspace Picker with interactive city switcher */}
        <div className="relative mb-5" ref={dropdownRef}>
          <button
            type="button"
            className="workspace-picker w-full group transition-colors hover:border-emerald-600/50 cursor-pointer"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-label="Change city workspace"
          >
            <span className="workspace-icon bg-emerald-100/60 text-emerald-800">
              <MapPin size={16} />
            </span>
            <span>
              <strong>{currentCity.name} network</strong>
              <small>{session && profile ? roleLabel[profile.role] : `${currentCity.state} · ${source === 'supabase' ? 'Live workspace' : 'Pilot demo'}`}</small>
            </span>
            <ChevronDown size={14} className={cn('transition-transform duration-200 text-muted-foreground', dropdownOpen && 'rotate-180 text-primary')} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 max-h-80 overflow-y-auto animate-in fade-in-50 slide-in-from-top-1">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground flex items-center justify-between border-b border-border/50 mb-1">
                <span>SELECT CITY WORKSPACE</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">{cities.length} cities</Badge>
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
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left transition-colors',
                        isCurrent
                          ? 'bg-emerald-50 text-emerald-900 font-medium dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className={isCurrent ? 'text-emerald-600' : 'text-muted-foreground'} />
                        <div>
                          <div>{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.state}</div>
                        </div>
                      </div>
                      {isCurrent && <Check size={13} className="text-emerald-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-border/50 mt-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => navigate('workspaces')}
                  className="w-full text-center text-[11px] text-primary hover:underline py-1 font-medium"
                >
                  Browse all city networks →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="nav-section-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn('nav-item', section === id && 'active')}
              aria-current={section === id ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {id === 'donations' && activeCount !== undefined && activeCount > 0 && <span className="nav-count">{activeCount}</span>}
            </button>
          ))}
        </nav>

        <div className="nav-section-label mt-7">INSIGHTS</div>
        <nav aria-label="Workspace insights" className="sidebar-nav">
          <button
            onClick={() => navigate('impact')}
            className={cn('nav-item', section === 'impact' && 'active')}
            aria-current={section === 'impact' ? 'page' : undefined}
          >
            <Sprout size={18} strokeWidth={1.7} />
            <span>Impact & reports</span>
          </button>
          <button
            onClick={() => navigate('settings')}
            className={cn('nav-item', section === 'settings' && 'active')}
            aria-current={section === 'settings' ? 'page' : undefined}
          >
            <UserCog size={18} strokeWidth={1.7} />
            <span>Account & settings</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="purpose-card">
          <span className="purpose-icon">
            <HeartHandshake size={22} strokeWidth={1.5} />
          </span>
          <h3>Less waste.<br />More possibility.</h3>
          <p>Every rescue is a small act<br />with a lasting impact.</p>
          <button onClick={() => navigate('impact')}>
            Explore your impact <ArrowUpRight size={15} />
          </button>
        </div>

        {onBackToLanding && (
          <button className="help-link mb-1" onClick={onBackToLanding}>
            <Sparkles size={17} />Interactive story / Landing<ArrowUpRight size={13} />
          </button>
        )}

        <button className="help-link" onClick={help}>
          <CircleHelp size={17} />Help & safety guidelines<ArrowUpRight size={13} />
        </button>

        <div className="sidebar-profile">
          <div className="relative">
            <span className="profile-avatar">
              {session && initials ? <span style={{ fontSize: 13, fontWeight: 700 }}>{initials}</span> : session ? <Users size={18} /> : <ShieldCheck size={19} />}
            </span>
            {session && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" title="Connected" />}
          </div>
          <button onClick={session ? () => navigate('settings') : signIn} className="profile-text text-left group cursor-pointer" title={session ? 'Manage account & credentials' : 'Sign in to participate'}>
            <strong className="group-hover:text-primary transition-colors">{session ? (profile?.display_name || session.user.email?.split('@')[0] || 'Rescue partner') : 'Pilot visitor'}</strong>
            <small className="flex items-center gap-1">{session ? (profile ? roleLabel[profile.role] : 'Loading profile…') : 'Sign in to participate'}</small>
          </button>
          {session && (
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut} className="hover:text-destructive">
              <LogOut size={16} />
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}
