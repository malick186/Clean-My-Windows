import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Brush, Power, HardDrive, Shield, Gauge,
  ShieldAlert, Trash2, Shredder as ShredderIcon,
  Wrench, Search, Database, Boxes, BadgeCheck
} from 'lucide-react'

const items = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/malware', icon: ShieldAlert, label: 'System Scan' },
  { to: '/cleanup', icon: Brush, label: 'Junk Cleaner' },
  { to: '/performance', icon: Gauge, label: 'Performance' },
  { to: '/startup', icon: Power, label: 'Startup Manager' },
  { to: '/privacy', icon: Shield, label: 'Privacy Shield' },
  { to: '/safety', icon: BadgeCheck, label: 'Safety Center' },
  { to: '/disk', icon: HardDrive, label: 'Disk Health' },
  { to: '/largefiles', icon: Search, label: 'Large Files' },
  { to: '/registry', icon: Database, label: 'Registry' },
  { to: '/uninstaller', icon: Trash2, label: 'Uninstaller' },
  { to: '/shredder', icon: ShredderIcon, label: 'File Shredder' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon"><Icon size={19} strokeWidth={1.8} /></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Boxes size={14} />
        <div><strong>WinBoost 2.1</strong><span>Local system toolkit</span></div>
      </div>
    </aside>
  )
}
