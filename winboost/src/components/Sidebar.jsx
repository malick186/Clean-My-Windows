import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Brush, Power, HardDrive, Shield, Gauge,
  ShieldCheck, Trash2, Shredder as ShredderIcon,
  Wrench, Search, Database, Boxes, Settings2, Download,
  Wifi, Monitor
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
  { to: '/debloat', icon: Monitor, label: 'Debloat' },
  { to: '/appinstaller', icon: Download, label: 'App Installer' },
  { to: '/sysutils', icon: Wrench, label: 'System Utilities' },
  { to: '/maintenance', icon: Boxes, label: 'Maintenance' },
  { to: '/network', icon: Wifi, label: 'Network' },
  { to: '/settings', icon: Settings2, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-[210px] flex-shrink-0 bg-sidebar/90 backdrop-blur-2xl border-r border-white/[0.04] overflow-y-auto">
      <nav className="flex-1 flex flex-col gap-0.5 py-5 px-2.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-text shadow-sm'
                    : 'text-text-secondary hover:text-text hover:bg-surface-secondary'
                }`}
              >
                <span className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
                  isActive ? 'bg-accent/15 text-accent' : 'text-text-tertiary'
                }`}>
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="truncate">{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-t border-white/[0.04]">
        <Boxes size={13} className="text-text-tertiary flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <strong className="text-[10px] text-text-secondary font-semibold tracking-tight">WinBoost 3.1</strong>
          <span className="text-[8px] text-text-tertiary">Local system toolkit</span>
        </div>
      </div>
    </aside>
  )
}
