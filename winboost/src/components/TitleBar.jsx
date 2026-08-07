import { Menu, Sparkles, Minus, Square, X, Moon, Sun, Monitor } from 'lucide-react'

function sendWindowAction(action) {
  window.electronAPI?.send?.(`window-${action}`)
}

let appearanceCtx = null
try {
  const mod = await import('../context/AppearanceContext')
  appearanceCtx = mod
} catch {
  appearanceCtx = null
}

export default function TitleBar({ onToggleSidebar }) {
  let theme, resolvedTheme, cycleTheme
  let ThemeIcon

  if (appearanceCtx) {
    try {
      const appearance = appearanceCtx.useAppearance()
      theme = appearance.theme
      resolvedTheme = appearance.resolvedTheme
      cycleTheme = appearance.cycleTheme
      ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun
    } catch {
      ThemeIcon = Sun
      cycleTheme = () => {}
    }
  } else {
    ThemeIcon = Sun
    cycleTheme = () => {}
  }

  return (
    <header className="titlebar">
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={onToggleSidebar}
          className="window-btn"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-sparkle-primary" />
          <span className="text-sm font-semibold text-sparkle-text">WinBoost</span>
          <span className="beta-badge">Beta</span>
        </div>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={cycleTheme}
          className="window-btn"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          <ThemeIcon size={15} />
        </button>
        <button
          onClick={() => sendWindowAction('minimize')}
          className="window-btn"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => sendWindowAction('maximize')}
          className="window-btn"
          aria-label="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => sendWindowAction('close')}
          className="window-btn close"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
