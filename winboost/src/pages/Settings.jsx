import {
  Check, Cpu, Gauge, HardDrive, Laptop, Monitor, Moon, Palette,
  ShieldCheck, Sparkles, Sun, WandSparkles,
} from 'lucide-react'
import { useAppearance } from '../context/AppearanceContext'

const themes = [
  { id: 'system', label: 'System', desc: 'Follow Windows', icon: Monitor },
  { id: 'dark', label: 'Dark', desc: 'Deep contrast', icon: Moon },
  { id: 'light', label: 'Light', desc: 'Bright and clear', icon: Sun },
]

const accents = [
  { id: 'aurora', label: 'Aurora', colors: ['#22d3ee', '#818cf8', '#c084fc'] },
  { id: 'ocean', label: 'Ocean', colors: ['#2dd4bf', '#38bdf8', '#818cf8'] },
  { id: 'sunset', label: 'Sunset', colors: ['#fb923c', '#f87171', '#e879f9'] },
  { id: 'forest', label: 'Forest', colors: ['#34d399', '#a3e635', '#2dd4bf'] },
]

const motionModes = [
  { id: 'system', label: 'Automatic', desc: 'Respect Windows accessibility settings' },
  { id: 'full', label: 'Full effects', desc: 'Ambient graphics and smooth transitions' },
  { id: 'reduced', label: 'Reduced', desc: 'Minimize non-essential movement' },
]

export default function Settings() {
  const { theme, resolvedTheme, setTheme, accent, setAccent, motion, setMotion } = useAppearance()

  const cardClass = "rounded-[14px] bg-surface border border-border p-5"
  const headingClass = "flex items-center gap-4 mb-4"

  return (
    <div className="space-y-5 anim-fade-up">
      {/* Hero */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-bg text-purple flex-shrink-0">
            <WandSparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Sparkles size={11} /> Personalize WinBoost
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Appearance &amp; experience</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Choose a Windows-aware theme, color system, and motion level. Every preference is stored locally on this PC.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-surface-secondary border border-border text-[11px] text-text-secondary">
          <span className={`w-1.5 h-1.5 rounded-full ${resolvedTheme === 'dark' ? 'bg-indigo-400' : 'bg-amber-400'}`} />
          {resolvedTheme} mode
        </div>
      </div>

      {/* Settings grid */}
      <div className="flex flex-col gap-4">
        {/* Theme */}
        <div className={cardClass}>
          <div className={headingClass}>
            <Laptop size={18} className="flex-shrink-0 text-text-tertiary" />
            <div>
              <h2 className="text-[14px] font-semibold text-text">Theme</h2>
              <p className="text-[11px] text-text-tertiary">Switch instantly or follow your Windows setting</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(({ id, label, desc, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all ${
                  theme === id
                    ? 'bg-accent/10 border-accent/30 text-text'
                    : 'bg-surface-secondary border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface">
                  <Icon size={19} />
                </span>
                <div className="flex flex-col">
                  <strong className="text-[12px]">{label}</strong>
                  <small className="text-[10px] text-text-tertiary">{desc}</small>
                </div>
                {theme === id && <Check size={15} className="text-accent ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Accent */}
        <div className={cardClass}>
          <div className={headingClass}>
            <Palette size={18} className="flex-shrink-0 text-text-tertiary" />
            <div>
              <h2 className="text-[14px] font-semibold text-text">Accent colors</h2>
              <p className="text-[11px] text-text-tertiary">Colorful without compromising readability</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {accents.map(({ id, label, colors }) => (
              <button
                key={id}
                onClick={() => setAccent(id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-[12px] border transition-all ${
                  accent === id
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-surface-secondary border-border hover:bg-surface-hover'
                }`}
              >
                <div className="flex gap-0.5 h-2.5 w-full rounded-full overflow-hidden">
                  {colors.map((c, i) => (
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <strong className="text-[11px] text-text">{label}</strong>
                {accent === id && <Check size={14} className="text-accent" />}
              </button>
            ))}
          </div>
        </div>

        {/* Motion */}
        <div className={cardClass}>
          <div className={headingClass}>
            <Gauge size={18} className="flex-shrink-0 text-text-tertiary" />
            <div>
              <h2 className="text-[14px] font-semibold text-text">Motion</h2>
              <p className="text-[11px] text-text-tertiary">Control graphics and page transitions throughout the app</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {motionModes.map(({ id, label, desc }) => (
              <button
                key={id}
                onClick={() => setMotion(id)}
                className={`flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all ${
                  motion === id
                    ? 'bg-accent/10 border-accent/30 text-text'
                    : 'bg-surface-secondary border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <span className="flex items-center gap-0.5 w-9 h-9 rounded-lg bg-surface items-center justify-center">
                  <span className={`w-1 h-1 rounded-full ${id === 'reduced' ? 'bg-text-tertiary' : 'bg-accent'}`} />
                  <span className={`w-1.5 h-1.5 rounded-full ${id === 'reduced' ? 'bg-text-tertiary' : 'bg-accent'}`} />
                  <span className={`w-1 h-1 rounded-full ${id === 'reduced' ? 'bg-text-tertiary' : 'bg-accent'}`} />
                </span>
                <div className="flex flex-col">
                  <strong className="text-[12px]">{label}</strong>
                  <small className="text-[10px] text-text-tertiary">{desc}</small>
                </div>
                {motion === id && <Check size={14} className="text-accent ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Assurance */}
        <div className={cardClass}>
          <div className={headingClass}>
            <ShieldCheck size={18} className="flex-shrink-0 text-text-tertiary" />
            <div>
              <h2 className="text-[14px] font-semibold text-text">Local by design</h2>
              <p className="text-[11px] text-text-tertiary">Privacy-first operation</p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-2 text-[12px] text-text-secondary">
              <Check size={13} className="text-green" /> No cloud account or telemetry
            </li>
            <li className="flex items-center gap-2 text-[12px] text-text-secondary">
              <Check size={13} className="text-green" /> UAC requested only when required
            </li>
            <li className="flex items-center gap-2 text-[12px] text-text-secondary">
              <Check size={13} className="text-green" /> Registry and startup backups retained
            </li>
          </ul>
        </div>

        {/* System info */}
        <div className={cardClass}>
          <div className={headingClass}>
            <Cpu size={18} className="flex-shrink-0 text-text-tertiary" />
            <div>
              <h2 className="text-[14px] font-semibold text-text">Optimized shell</h2>
              <p className="text-[11px] text-text-tertiary">Built for Windows 10 and 11</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-[10px] bg-surface-secondary">
              <HardDrive size={16} className="text-text-tertiary" />
              <div className="flex flex-col">
                <strong className="text-[11px] text-text">Local</strong>
                <small className="text-[10px] text-text-tertiary">System actions</small>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-[10px] bg-surface-secondary">
              <Sparkles size={16} className="text-text-tertiary" />
              <div className="flex flex-col">
                <strong className="text-[11px] text-text">Adaptive</strong>
                <small className="text-[10px] text-text-tertiary">GPU-friendly effects</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
