import { ArrowUpRight, Bike, Boxes, ChevronDown, CircleHelp, HeartHandshake, LayoutDashboard, Leaf, LogOut, MapPin, Route, Settings2, ShieldCheck, Sprout, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Section } from '@/src/types'
import type { Session } from '@supabase/supabase-js'

const operations = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'donations', label: 'Donations', icon: Boxes },
  { id: 'dispatch', label: 'Dispatch & routes', icon: Route },
  { id: 'recipients', label: 'Recipients', icon: HeartHandshake },
  { id: 'drivers', label: 'Volunteer drivers', icon: Bike },
] as const
export const sectionNames: Record<Section, string> = { overview: 'Overview', donations: 'Donations', dispatch: 'Dispatch & routes', recipients: 'Recipients', drivers: 'Volunteer drivers', impact: 'Impact & reports', settings: 'Workspace settings' }

export function AppSidebar({ section, setSection, mobileOpen, close, session, signIn, signOut, activeCount, help }: {
  section: Section; setSection: (section: Section) => void; mobileOpen: boolean; close: () => void;
  session: Session | null | undefined; signIn: () => void; signOut: () => void; activeCount?: number; help: () => void;
}) {
  const navigate = (next: Section) => { setSection(next); close() }
  return <>
    {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={close} />}
    <aside className={cn('app-sidebar', mobileOpen && 'is-open')}>
      <a className="brand" href="#overview" onClick={() => navigate('overview')} aria-label="AaharSetu home"><span className="brand-icon"><Leaf size={23} /></span><span>AaharSetu<span className="brand-subline">Food Rescue Bridge</span></span></a>
      <Button variant="ghost" size="icon" className="mobile-sidebar-close" aria-label="Close navigation" onClick={close}><X /></Button>
      <button className="workspace-picker" onClick={() => navigate('settings')}><span className="workspace-icon"><MapPin size={16} /></span><span><strong>Bengaluru network</strong><small>Synthetic pilot workspace</small></span><ChevronDown size={14} /></button>
      <div className="nav-section-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="sidebar-nav">{operations.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={cn('nav-item', section === id && 'active')} aria-current={section === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{id === 'donations' && activeCount !== undefined && activeCount > 0 && <span className="nav-count">{activeCount}</span>}</button>)}</nav>
      <div className="nav-section-label mt-7">INSIGHTS</div>
      <nav aria-label="Workspace insights" className="sidebar-nav"><button onClick={() => navigate('impact')} className={cn('nav-item', section === 'impact' && 'active')} aria-current={section === 'impact' ? 'page' : undefined}><Sprout size={18} strokeWidth={1.7} /><span>Impact & reports</span></button><button onClick={() => navigate('settings')} className={cn('nav-item', section === 'settings' && 'active')} aria-current={section === 'settings' ? 'page' : undefined}><Settings2 size={18} strokeWidth={1.7} /><span>Workspace settings</span></button></nav>
      <div className="sidebar-spacer" />
      <div className="purpose-card"><span className="purpose-icon"><HeartHandshake size={22} strokeWidth={1.5} /></span><h3>Less waste.<br />More possibility.</h3><p>Every rescue is a small act<br />with a lasting impact.</p><button onClick={() => navigate('impact')}>Explore your impact <ArrowUpRight size={15} /></button></div>
      <button className="help-link" onClick={help}><CircleHelp size={17} />Help & safety guidelines<ArrowUpRight size={13} /></button>
      <div className="sidebar-profile"><span className="profile-avatar">{session ? <Users size={18} /> : <ShieldCheck size={19} />}</span><button onClick={signIn} className="profile-text"><strong>{session ? 'Rescue partner' : 'Pilot visitor'}</strong><small>{session ? 'Signed in securely' : 'Sign in to participate'}</small></button>{session && <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={signOut}><LogOut /></Button>}</div>
    </aside>
  </>
}
