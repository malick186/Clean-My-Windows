import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Brush, Power, HardDrive, Shield, Gauge,
  ShieldCheck, Trash2, Shredder as ShredderIcon,
  Wrench, Search, Database, Boxes, Settings2
} from 'lucide-react'

const items = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/security', icon: ShieldCheck, label: 'Security' },
  { to: '/cleanup', icon: Brush, label: 'Junk Cleaner' },
  { to: '/performance', icon: Gauge, label: 'Performance' },
  { to: '/startup', icon: Power, label: 'Startup Manager' },
  { to: '/privacy', icon: Shield, label: 'Privacy Shield' },
  { to: '/disk', icon: HardDrive, label: 'Disk Health' },
  { to: '/largefiles', icon: Search, label: 'Large Files' },
  { to: '/registry', icon: Database, label: 'Registry' },
  { to: '/uninstaller', icon: Trash2, label: 'Uninstaller' },
  { to: '/shredder', icon: ShredderIcon, label: 'File Shredder' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/settings', icon: Settings2, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-[200px] flex-shrink-0 bg-sidebar border-r border-border overflow-y-auto">
      <nav className="flex-1 flex flex-col gap-0.5 py-4">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <div
                className={`flex items-center gap-3 px-3 py-[10px] mx-2 rounded-[10px] text-[13px] font-medium transition-all ${
                  isActive
                    ? 'text-text bg-accent/10 border-l-[3px] border-l-accent shadow-[inset_0_0_12px_rgba(34,211,238,0.06)]'
                    : 'text-text-secondary hover:text-text hover:bg-surface-secondary border-l-[3px] border-l-transparent'
                }`}
              >
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                  isActive ? 'bg-accent/20 text-accent' : 'text-text-tertiary'
                }`}>
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <span>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2 px-3 py-3 border-t border-border text-text-tertiary text-[10px]">
        <Boxes size={14} />
        <div className="flex flex-col">
          <strong className="text-text-secondary">WinBoost 3.0</strong>
          <span>Local system toolkit</span>
        </div>
      </div>
    </aside>
  )
}
