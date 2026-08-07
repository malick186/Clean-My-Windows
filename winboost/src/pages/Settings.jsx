import {
  Check, Cpu, Gauge, HardDrive, Laptop, Monitor, Moon, Palette,
  ShieldCheck, Sparkles, Sun, WandSparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-bg text-purple shadow-sm">
            <WandSparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Sparkles size={11} /> Personalize WinBoost
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Appearance &amp; experience</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Choose a Windows-aware theme, color system, and motion level. Every preference is stored locally on this PC.</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="flex items-center gap-2 h-auto py-2 px-3 text-[11px] rounded-xl"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${resolvedTheme === 'dark' ? 'bg-indigo-400' : 'bg-amber-400'}`} />
          {resolvedTheme} mode
        </Badge>
      </div>

      {/* Settings grid */}
      <div className="flex flex-col gap-5">
        {/* Theme */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Laptop size={20} className="flex-shrink-0 text-text-tertiary" />
              <div>
                <CardTitle className="text-base">Theme</CardTitle>
                <CardDescription className="text-[12px]">Switch instantly or follow your Windows setting</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {themes.map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                    theme === id
                      ? 'bg-accent/10 border-accent/30 text-text shadow-sm'
                      : 'bg-surface-secondary/50 border-white/[0.03] text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface">
                    <Icon size={19} />
                  </span>
                  <div className="flex flex-col flex-1">
                    <strong className="text-[13px]">{label}</strong>
                    <small className="text-[11px] text-text-tertiary">{desc}</small>
                  </div>
                  {theme === id && <Check size={16} className="text-accent ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accent */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Palette size={20} className="flex-shrink-0 text-text-tertiary" />
              <div>
                <CardTitle className="text-base">Accent colors</CardTitle>
                <CardDescription className="text-[12px]">Colorful without compromising readability</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {accents.map(({ id, label, colors }) => (
                <button
                  key={id}
                  onClick={() => setAccent(id)}
                  className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 ${
                    accent === id
                      ? 'bg-accent/10 border-accent/30 shadow-sm'
                      : 'bg-surface-secondary/50 border-white/[0.03] hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex gap-0.5 h-3 w-full rounded-full overflow-hidden">
                    {colors.map((c, i) => (
                      <span key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <strong className="text-[12px] text-text">{label}</strong>
                  {accent === id && <Check size={14} className="text-accent" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Motion */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Gauge size={20} className="flex-shrink-0 text-text-tertiary" />
              <div>
                <CardTitle className="text-base">Motion</CardTitle>
                <CardDescription className="text-[12px]">Control graphics and page transitions throughout the app</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {motionModes.map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => setMotion(id)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                    motion === id
                      ? 'bg-accent/10 border-accent/30 text-text shadow-sm'
                      : 'bg-surface-secondary/50 border-white/[0.03] text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span className="flex items-center gap-0.5 w-9 h-9 rounded-xl bg-surface items-center justify-center">
                    <span className={`w-1 h-1 rounded-full ${id === 'reduced' ? 'bg-text-tertiary' : 'bg-accent'}`} />
                    <span className={`w-1.5 h-1.5 rounded-full ${id === 'reduced' ? 'bg-text-tertiary' : 'bg-accent'}`} />
                    <span className={`w-1 h-1 rounded-full ${id === 'reduced' ? 'bg-text-tertiary' : 'bg-accent'}`} />
                  </span>
                  <div className="flex flex-col flex-1">
                    <strong className="text-[13px]">{label}</strong>
                    <small className="text-[11px] text-text-tertiary">{desc}</small>
                  </div>
                  {motion === id && <Check size={16} className="text-accent ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Assurance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="flex-shrink-0 text-text-tertiary" />
              <div>
                <CardTitle className="text-base">Local by design</CardTitle>
                <CardDescription className="text-[12px]">Privacy-first operation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center gap-3 text-[13px] text-text-secondary p-3 rounded-xl hover:bg-surface-secondary/50 transition-colors">
                <Check size={14} className="text-green flex-shrink-0" /> No cloud account or telemetry
              </li>
              <li className="flex items-center gap-3 text-[13px] text-text-secondary p-3 rounded-xl hover:bg-surface-secondary/50 transition-colors">
                <Check size={14} className="text-green flex-shrink-0" /> UAC requested only when required
              </li>
              <li className="flex items-center gap-3 text-[13px] text-text-secondary p-3 rounded-xl hover:bg-surface-secondary/50 transition-colors">
                <Check size={14} className="text-green flex-shrink-0" /> Registry and startup backups retained
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* System info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Cpu size={20} className="flex-shrink-0 text-text-tertiary" />
              <div>
                <CardTitle className="text-base">Optimized shell</CardTitle>
                <CardDescription className="text-[12px]">Built for Windows 10 and 11</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.03]">
                <HardDrive size={17} className="text-text-tertiary" />
                <div className="flex flex-col">
                  <strong className="text-[12px] text-text">Local</strong>
                  <small className="text-[11px] text-text-tertiary">System actions</small>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.03]">
                <Sparkles size={17} className="text-text-tertiary" />
                <div className="flex flex-col">
                  <strong className="text-[12px] text-text">Adaptive</strong>
                  <small className="text-[11px] text-text-tertiary">GPU-friendly effects</small>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
