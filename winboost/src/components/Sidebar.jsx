import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Brush, Power, HardDrive, Shield, Gauge,
  Sparkles, ShieldAlert, Trash2, Shredder as ShredderIcon,
  Wrench, Search, Database
} from 'lucide-react'

const groups = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: Sparkles, label: 'Dashboard' },
    ]
  },
  {
    label: 'Clean Up',
    items: [
      { to: '/cleanup', icon: Brush, label: 'System Cleanup' },
      { to: '/malware', icon: ShieldAlert, label: 'Malware Scan' },
      { to: '/uninstaller', icon: Trash2, label: 'Uninstaller' },
      { to: '/shredder', icon: ShredderIcon, label: 'Shredder' },
    ]
  },
  {
    label: 'Analyze',
    items: [
      { to: '/disk', icon: HardDrive, label: 'Disk Analyzer' },
      { to: '/largefiles', icon: Search, label: 'Large Files' },
      { to: '/registry', icon: Database, label: 'Registry' },
      { to: '/startup', icon: Power, label: 'Startup' },
    ]
  },
  {
    label: 'Tune',
    items: [
      { to: '/privacy', icon: Shield, label: 'Privacy' },
      { to: '/performance', icon: Gauge, label: 'Performance' },
      { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
    ]
  },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-[220px] bg-[var(--bg-sidebar)] border-r border-[var(--border)] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-[56px] border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-grad)' }}>
          <Sparkles size={16} className="text-white" />
        </div>
        <span className="font-bold text-[17px] tracking-[-0.02em]">
          Win<span className="text-gradient">Boost</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {groups.map(group => (
          <div key={group.label}>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-[var(--text-tertiary)]">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-[#0071e3]/10 text-[#0071e3]'
                        : 'text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text)]'
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="text-[11px] text-[var(--text-tertiary)] text-center">
          WinBoost v1.0
        </div>
      </div>
    </aside>
  )
}
