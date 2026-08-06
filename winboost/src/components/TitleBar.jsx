import { useLocation, useNavigate } from 'react-router-dom'
import { Minus, Square, X, Zap, LockKeyhole, Moon, Sun, Monitor } from 'lucide-react'
import { useAppearance } from '../context/AppearanceContext'

const labels = {
  '/': 'Dashboard',
  '/cleanup': 'System Cleanup',
  '/malware': 'System Scan',
  '/uninstaller': 'App Uninstaller',
  '/shredder': 'File Shredder',
  '/maintenance': 'Maintenance',
  '/disk': 'Disk Analyzer',
  '/largefiles': 'Large Files',
  '/registry': 'Registry Cleaner',
  '/startup': 'Startup Manager',
  '/privacy': 'Privacy Shield',
  '/performance': 'Performance',
  '/safety': 'Safety Center',
  '/settings': 'Settings',
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
      <button className="brand brand-button" onClick={() => navigate('/')} aria-label="Open dashboard">
        <span className="brand-mark"><Zap size={20} strokeWidth={2.4} /></span>
        <span className="brand-copy">
          <strong>WINBOOST</strong>
          <small>OPTIMIZER <b>PRO</b></small>
        </span>
      </button>

      <div className="titlebar-tabs" aria-label="Current section">
        <button className={location.pathname === '/' ? 'active' : ''} onClick={() => navigate('/')}>Dashboard</button>
        <button
          className={location.pathname !== '/' ? 'active' : ''}
          onClick={() => navigate(location.pathname === '/' ? '/maintenance' : location.pathname)}
        >
          {activeLabel === 'Dashboard' ? 'System Tools' : activeLabel}
        </button>
      </div>

      <div className="window-actions">
        <span className="live-indicator"><i /><LockKeyhole size={11} /> Offline &amp; local</span>
        <button className="theme-quick-toggle" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change`} title={`Theme: ${theme}`}><ThemeIcon size={14} /></button>
        <button onClick={() => sendWindowAction('minimize')} aria-label="Minimize"><Minus size={15} /></button>
        <button onClick={() => sendWindowAction('maximize')} aria-label="Maximize"><Square size={12} /></button>
        <button className="window-close" onClick={() => sendWindowAction('close')} aria-label="Close"><X size={15} /></button>
      </div>
    </header>
  )
}
