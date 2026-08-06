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

  return (
    <header className="titlebar">
      <button
        onClick={() => navigate('/')}
        aria-label="Open dashboard"
        className="flex items-center gap-[10px] bg-transparent border-none cursor-pointer"
      >
        <span className="titlebar-brand-icon"><Zap size={16} /></span>
        <span className="flex flex-col items-start">
          <strong className="text-[13px] text-text leading-tight">WINBOOST</strong>
          <small className="text-[9px] text-text-tertiary leading-tight">OPTIMIZER <b>PRO</b></small>
        </span>
      </button>

      <div className="flex justify-center gap-6">
        <button
          onClick={() => navigate('/')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${location.pathname === '/' ? 'bg-accent/15 text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
        >Dashboard</button>
        <button
          onClick={() => navigate(location.pathname === '/' ? '/maintenance' : location.pathname)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${location.pathname !== '/' ? 'bg-accent/15 text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
        >{activeLabel === 'Dashboard' ? 'System Tools' : activeLabel}</button>
      </div>

      <div className="flex items-center justify-end gap-5 -webkit-app-region-no-drag">
        <span className="flex items-center gap-[5px] text-[10px] text-text-tertiary">
          <span className="w-[6px] h-[6px] rounded-full bg-green" />
          <LockKeyhole size={11} /> Offline &amp; local
        </span>
        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme}`}
          className="window-btn"
        ><ThemeIcon size={14} /></button>
        <button onClick={() => sendWindowAction('minimize')} aria-label="Minimize" className="window-btn"><Minus size={15} /></button>
        <button onClick={() => sendWindowAction('maximize')} aria-label="Maximize" className="window-btn"><Square size={12} /></button>
        <button onClick={() => sendWindowAction('close')} aria-label="Close" className="window-btn close"><X size={15} /></button>
      </div>
    </header>
  )
}
