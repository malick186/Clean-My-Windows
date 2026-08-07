import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShieldCheck, Brush, Gauge, Power, Shield,
  HardDrive, Search, Database, Trash2, Shredder as ShredderIcon,
  Monitor, Download, Wrench, Boxes, Wifi, Settings2, RefreshCw,
  Zap, Activity, Menu, Cpu, Files, Globe
} from 'lucide-react'

const items = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/security', icon: ShieldCheck, label: 'Security' },
  { to: '/cleanup', icon: Brush, label: 'Cleanup' },
  { to: '/performance', icon: Gauge, label: 'Performance' },
  { to: '/startup', icon: Power, label: 'Startup' },
  { to: '/privacy', icon: Shield, label: 'Privacy' },
  { to: '/disk', icon: HardDrive, label: 'Disk' },
  { to: '/largefiles', icon: Search, label: 'Large Files' },
  { to: '/registry', icon: Database, label: 'Registry' },
  { to: '/uninstaller', icon: Trash2, label: 'Uninstaller' },
  { to: '/shredder', icon: ShredderIcon, label: 'Shredder' },
  { to: '/debloat', icon: Monitor, label: 'Debloat' },
  { to: '/appinstaller', icon: Download, label: 'App Installer' },
  { to: '/sysutils', icon: Wrench, label: 'Sys Utils' },
  { to: '/maintenance', icon: Boxes, label: 'Maintenance' },
  { to: '/network', icon: Wifi, label: 'Network' },
  { to: '/power', icon: Zap, label: 'Power' },
  { to: '/network-diag', icon: Activity, label: 'Net Diag' },
  { to: '/system', icon: Cpu, label: 'System Info' },
  { to: '/duplicates', icon: Files, label: 'Duplicates' },
  { to: '/browser', icon: Globe, label: 'Browser' },
  { to: '/context-menu', icon: Menu, label: 'Context Menu' },
  { to: '/settings', icon: Settings2, label: 'Settings' },
]

export default function Sidebar({ isCollapsed }) {
  const location = useLocation()
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 })
  const [restartRequired] = useState(false)
  const sidebarRef = useRef(null)

  const updateIndicator = useCallback(() => {
    if (isCollapsed) {
      setIndicatorStyle({ top: 0, height: 0 })
      return
    }
    if (!sidebarRef.current) return
    const activeLink = sidebarRef.current.querySelector('[data-active="true"]')
    if (!activeLink) {
      setIndicatorStyle({ top: 0, height: 0 })
      return
    }
    const sidebarRect = sidebarRef.current.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()
    setIndicatorStyle({
      top: linkRect.top - sidebarRect.top,
      height: linkRect.height,
    })
  }, [isCollapsed])

  useEffect(() => {
    const raf = requestAnimationFrame(updateIndicator)
    return () => cancelAnimationFrame(raf)
  }, [location.pathname, isCollapsed, updateIndicator])

  useEffect(() => {
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [updateIndicator])

  const widthClass = isCollapsed ? 'w-[51px]' : 'w-[205px]'

  return (
    <aside
      ref={sidebarRef}
      className={`relative flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${widthClass} bg-sparkle-card border-r border-sparkle-border overflow-hidden`}
    >
      <div className="sidebar-active-indicator" style={{ top: `${indicatorStyle.top}px`, height: `${indicatorStyle.height}px` }} />

      <nav className="flex-1 flex flex-col gap-0.5 py-3 overflow-y-auto content-scroll">
        {items.map(({ to, icon: Icon, label }) =>
          isCollapsed ? (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-active={location.pathname === to ? 'true' : 'false'}
              title={label}
              className={({ isActive }) =>
                `flex items-center justify-center h-10 rounded-lg mx-1 transition-colors duration-150 ${
                  isActive
                    ? 'bg-sparkle-primary/10 text-sparkle-primary'
                    : 'text-sparkle-text-secondary hover:bg-sparkle-accent/50 hover:text-sparkle-text'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.5} />
            </NavLink>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-active={location.pathname === to ? 'true' : 'false'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-lg mx-1.5 transition-colors duration-150 ${
                  isActive
                    ? 'bg-sparkle-primary/10 text-sparkle-primary'
                    : 'text-sparkle-text-secondary hover:bg-sparkle-accent/50 hover:text-sparkle-text'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="truncate">{label}</span>
            </NavLink>
          )
        )}
      </nav>

      <div className={`flex-shrink-0 border-t border-sparkle-border ${isCollapsed ? 'px-1 py-3' : 'px-4 py-3'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold text-sparkle-text-muted" title="WinBoost 3.2">
              3.2
            </span>
            {restartRequired && (
              <RefreshCw size={14} className="text-sparkle-warning" title="Restart Required" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Boxes size={13} className="text-sparkle-text-muted flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <strong className="text-[10px] text-sparkle-text-secondary font-semibold tracking-tight">
                WinBoost 3.2
              </strong>
              <span className="text-[8px] text-sparkle-text-muted">
                {restartRequired ? 'Restart Required' : 'Local system toolkit'}
              </span>
            </div>
            {restartRequired && (
              <RefreshCw size={13} className="text-sparkle-warning flex-shrink-0 ml-auto" />
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
