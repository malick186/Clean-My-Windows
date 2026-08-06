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
  { id: 'aurora', label: 'Aurora', colors: ['#43e6ff', '#7777ff', '#d159ff'] },
  { id: 'ocean', label: 'Ocean', colors: ['#20d5ff', '#2e78ff', '#73a7ff'] },
  { id: 'sunset', label: 'Sunset', colors: ['#ffb14f', '#ff627d', '#bc5dff'] },
  { id: 'forest', label: 'Forest', colors: ['#45e6a8', '#13b9a6', '#4e8dff'] },
]

const motionModes = [
  { id: 'system', label: 'Automatic', desc: 'Respect Windows accessibility settings' },
  { id: 'full', label: 'Full effects', desc: 'Ambient graphics and smooth transitions' },
  { id: 'reduced', label: 'Reduced', desc: 'Minimize non-essential movement' },
]

function Choice({ active, icon: Icon, label, desc, onClick }) {
  return (
    <button className={`appearance-choice ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="appearance-choice-icon"><Icon size={19} /></span>
      <span><strong>{label}</strong><small>{desc}</small></span>
      {active && <Check size={15} className="choice-check" />}
    </button>
  )
}

export default function Settings() {
  const { theme, resolvedTheme, setTheme, accent, setAccent, motion, setMotion } = useAppearance()

  return (
    <div className="settings-page anim-fade-up">
      <section className="page-hero settings-hero">
        <div className="page-hero-icon purple"><WandSparkles size={22} /></div>
        <div>
          <span className="eyebrow"><Sparkles size={11} /> Personalize WinBoost</span>
          <h1>Appearance &amp; experience</h1>
          <p>Choose a Windows-aware theme, color system, and motion level. Every preference is stored locally on this PC.</p>
        </div>
        <div className="theme-preview-pill"><span className={`preview-dot ${resolvedTheme}`} />{resolvedTheme} mode</div>
      </section>

      <div className="settings-grid">
        <section className="card settings-card settings-card-wide">
          <div className="settings-heading"><span><Laptop size={18} /></span><div><h2>Theme</h2><p>Switch instantly or follow your Windows setting</p></div></div>
          <div className="appearance-choice-grid">
            {themes.map(option => <Choice key={option.id} {...option} active={theme === option.id} onClick={() => setTheme(option.id)} />)}
          </div>
        </section>

        <section className="card settings-card settings-card-wide">
          <div className="settings-heading"><span><Palette size={18} /></span><div><h2>Accent colors</h2><p>Colorful without compromising readability</p></div></div>
          <div className="accent-grid">
            {accents.map(option => (
              <button key={option.id} className={`accent-choice ${accent === option.id ? 'active' : ''}`} onClick={() => setAccent(option.id)} aria-pressed={accent === option.id}>
                <span className="accent-swatch">{option.colors.map(color => <i key={color} style={{ background: color }} />)}</span>
                <strong>{option.label}</strong>
                {accent === option.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-card settings-card-wide">
          <div className="settings-heading"><span><Gauge size={18} /></span><div><h2>Motion</h2><p>Control graphics and page transitions throughout the app</p></div></div>
          <div className="motion-grid">
            {motionModes.map(option => (
              <button key={option.id} className={`motion-choice ${motion === option.id ? 'active' : ''}`} onClick={() => setMotion(option.id)} aria-pressed={motion === option.id}>
                <span className="motion-orbit"><i /><b /></span>
                <span><strong>{option.label}</strong><small>{option.desc}</small></span>
                {motion === option.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-card assurance-card">
          <div className="settings-heading"><span><ShieldCheck size={18} /></span><div><h2>Local by design</h2><p>Privacy-first operation</p></div></div>
          <ul className="assurance-list">
            <li><Check size={13} />No cloud account or telemetry</li>
            <li><Check size={13} />UAC requested only when required</li>
            <li><Check size={13} />Registry and startup backups retained</li>
          </ul>
        </section>

        <section className="card settings-card system-card">
          <div className="settings-heading"><span><Cpu size={18} /></span><div><h2>Optimized shell</h2><p>Built for Windows 10 and 11</p></div></div>
          <div className="system-feature-grid">
            <span><HardDrive size={16} /><strong>Local</strong><small>System actions</small></span>
            <span><Sparkles size={16} /><strong>Adaptive</strong><small>GPU-friendly effects</small></span>
          </div>
        </section>
      </div>
    </div>
  )
}
