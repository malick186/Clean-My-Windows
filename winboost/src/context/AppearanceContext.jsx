/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AppearanceContext = createContext(null)

const themeOrder = ['system', 'dark', 'light']

function readPreference(key, fallback) {
  try { return window.localStorage.getItem(key) || fallback }
  catch { return fallback }
}

export function AppearanceProvider({ children }) {
  const [theme, setTheme] = useState(() => readPreference('winboost-theme', 'system'))
  const [accent, setAccent] = useState(() => readPreference('winboost-accent', 'aurora'))
  const [motion, setMotion] = useState(() => readPreference('winboost-motion', 'system'))
  const [resolvedTheme, setResolvedTheme] = useState('dark')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      const root = document.documentElement
      root.dataset.theme = resolved
      root.dataset.themePreference = theme
      root.dataset.accent = accent
      root.dataset.motion = motion
      root.style.colorScheme = resolved
      setResolvedTheme(resolved)
    }

    applyTheme()
    media.addEventListener?.('change', applyTheme)
    return () => media.removeEventListener?.('change', applyTheme)
  }, [accent, motion, theme])

  useEffect(() => {
    try {
      window.localStorage.setItem('winboost-theme', theme)
      window.localStorage.setItem('winboost-accent', accent)
      window.localStorage.setItem('winboost-motion', motion)
    } catch {}
  }, [accent, motion, theme])

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    accent,
    motion,
    setTheme,
    setAccent,
    setMotion,
    cycleTheme: () => setTheme(current => themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length]),
  }), [accent, motion, resolvedTheme, theme])

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider')
  return value
}
