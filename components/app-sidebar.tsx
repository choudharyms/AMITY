import { ArrowUpRight, Bike, Boxes, ChevronDown, CircleHelp, HeartHandshake, LayoutDashboard, Leaf, LogOut, MapPin, Route, Settings2, ShieldCheck, Sparkles, Sprout, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Section } from '@/src/types'
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

export const sectionNames: Record<Section, string> = { overview: 'Overview', donations: 'Donations', dispatch: 'Dispatch & routes', recipients: 'Recipients', drivers: 'Volunteer drivers', impact: 'Impact & reports', settings: 'Workspace settings' }

const roleLabel: Record<AccountProfile['role'], string> = {
  coordinator: 'Network Coordinator',
  donor: 'Food Donor',
  driver: 'Volunteer Driver',
  recipient: 'Recipient Organisation',
  shelter: 'Shelter',
}

export function AppSidebar({ section, setSection, mobileOpen, close, session, profile, signIn, signOut, activeCount, help, onBackToLanding }: {
  section: Section; setSection: (section: Section) => void; mobileOpen: boolean; close: () => void;
  session: Session | null | undefined; profile?: AccountProfile; signIn: () => void; signOut: () => void; activeCount?: number; help: () => void;
  onBackToLanding?: () => void;
}) {
  const navigate = (next: Section) => { setSection(next); close() }
  const navItems = roleNav(profile?.role)
  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : undefined

  return <>
    {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={close} />}
    <aside className={cn('app-sidebar', mobileOpen && 'is-open')}>
      <a className="brand" href="#overview" onClick={() => navigate('overview')} aria-label="AaharSetu home">
        <span className="brand-icon-wrapper">
          <img src="/surplus-logo.jpg" alt="AaharSetu logo" className="brand-logo-img" />
        </span>
        <span>AaharSetu<span className="brand-subline">Food Rescue Bridge</span></span>
      </a>
      <Button variant="ghost" size="icon" className="mobile-sidebar-close" aria-label="Close navigation" onClick={close}><X /></Button>

      <button className="workspace-picker" onClick={() => navigate('settings')}>
        <span className="workspace-icon"><MapPin size={16} /></span>
        <span><strong>Bengaluru network</strong><small>{session ? roleLabel[profile?.role ?? 'donor'] : 'Synthetic pilot workspace'}</small></span>
        <ChevronDown size={14} />
      </button>

      <div className="nav-section-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => navigate(id)} className={cn('nav-item', section === id && 'active')} aria-current={section === id ? 'page' : undefined}>
            <Icon size={18} strokeWidth={1.7} />
            <span>{label}</span>
            {id === 'donations' && activeCount !== undefined && activeCount > 0 && <span className="nav-count">{activeCount}</span>}
          </button>
        ))}
      </nav>

      <div className="nav-section-label mt-7">INSIGHTS</div>
      <nav aria-label="Workspace insights" className="sidebar-nav">
        <button onClick={() => navigate('impact')} className={cn('nav-item', section === 'impact' && 'active')} aria-current={section === 'impact' ? 'page' : undefined}>
          <Sprout size={18} strokeWidth={1.7} /><span>Impact & reports</span>
        </button>
        <button onClick={() => navigate('settings')} className={cn('nav-item', section === 'settings' && 'active')} aria-current={section === 'settings' ? 'page' : undefined}>
          <Settings2 size={18} strokeWidth={1.7} /><span>Workspace settings</span>
        </button>
      </nav>

      <div className="sidebar-spacer" />
      <div className="purpose-card">
        <span className="purpose-icon"><HeartHandshake size={22} strokeWidth={1.5} /></span>
        <h3>Less waste.<br />More possibility.</h3>
        <p>Every rescue is a small act<br />with a lasting impact.</p>
        <button onClick={() => navigate('impact')}>Explore your impact <ArrowUpRight size={15} /></button>
      </div>
      {onBackToLanding && <button className="help-link mb-1" onClick={onBackToLanding}><Sparkles size={17} />Interactive story / Landing<ArrowUpRight size={13} /></button>}
      <button className="help-link" onClick={help}><CircleHelp size={17} />Help & safety guidelines<ArrowUpRight size={13} /></button>

      <div className="sidebar-profile">
        <span className="profile-avatar">
          {session && initials ? <span style={{ fontSize: 13, fontWeight: 700 }}>{initials}</span> : session ? <Users size={18} /> : <ShieldCheck size={19} />}
        </span>
        <button onClick={signIn} className="profile-text">
          <strong>{session ? (profile?.display_name || 'Rescue partner') : 'Pilot visitor'}</strong>
          <small>{session ? (profile ? roleLabel[profile.role] : 'Loading profile…') : 'Sign in to participate'}</small>
        </button>
        {session && <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut}><LogOut /></Button>}
      </div>
    </aside>
  </>
}
