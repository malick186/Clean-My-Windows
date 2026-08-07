import { useLocation, useNavigate } from 'react-router-dom'
import { Minus, Square, X, Zap, LockKeyhole, Moon, Sun, Monitor } from 'lucide-react'
import { useAppearance } from '../context/AppearanceContext'

const labels = {
  '/': 'Dashboard', '/security': 'Security', '/cleanup': 'System Cleanup',
  '/malware': 'System Scan', '/uninstaller': 'App Uninstaller',
  '/shredder': 'File Shredder', '/maintenance': 'Maintenance',
  '/disk': 'Disk Analyzer', '/largefiles': 'Large Files',
  '/registry': 'Registry Cleaner', '/startup': 'Startup Manager',
  '/privacy': 'Privacy Shield', '/performance': 'Performance',
  '/safety': 'Safety Center', '/settings': 'Settings',
}

function sendWindowAction(action) {
  window.electronAPI?.send?.(`window-${action}`)
}

export default function TitleBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, resolvedTheme, cycleTheme } = useAppearance()
  const activeLabel = labels[location.pathname] || 'System Tools'
  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  const tabClass = (active) =>
    `px-5 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 ${
      active
        ? 'bg-accent/10 text-accent shadow-sm'
        : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary'
    }`

  return (
    <header className="titlebar">
      <button
        onClick={() => navigate('/')}
        aria-label="Open dashboard"
        className="flex items-center gap-3 bg-transparent border-none cursor-pointer group"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-2xl bg-gradient-to-br from-accent to-purple text-white shadow-sm group-hover:shadow-md transition-shadow">
          <Zap size={15} />
        </span>
        <span className="flex flex-col items-start">
          <strong className="text-[13px] text-text font-semibold tracking-tight leading-tight">WinBoost</strong>
          <small className="text-[9px] text-text-tertiary tracking-widest leading-tight uppercase">Pro</small>
        </span>
      </button>

      <div className="flex justify-center gap-1.5">
        <button onClick={() => navigate('/')} className={tabClass(location.pathname === '/')}>
          Dashboard
        </button>
        <button
          onClick={() => navigate(location.pathname === '/' ? '/settings' : location.pathname)}
          className={tabClass(location.pathname !== '/')}
        >
          {activeLabel === 'Dashboard' ? 'Settings' : activeLabel}
        </button>
      </div>

      <div className="flex items-center justify-end gap-5 titlebar-window-actions">
        <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <LockKeyhole size={10} /> Offline
        </span>
        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme}`}
          className="window-btn"
        ><ThemeIcon size={14} /></button>
        <button onClick={() => sendWindowAction('minimize')} aria-label="Minimize" className="window-btn"><Minus size={14} /></button>
        <button onClick={() => sendWindowAction('maximize')} aria-label="Maximize" className="window-btn"><Square size={11} /></button>
        <button onClick={() => sendWindowAction('close')} aria-label="Close" className="window-btn close"><X size={14} /></button>
      </div>
    </header>
  )
}
