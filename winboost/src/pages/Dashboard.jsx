import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Brush, ShieldAlert, Trash2, Search, Shield, HardDrive, Wrench, Cpu, Activity, Monitor } from 'lucide-react'

function ScanCircle({ scanning, progress }) {
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 82
  const sw = 5
  const circumference = 2 * Math.PI * r
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0071e3" />
            <stop offset="50%" stopColor="#5e5ce6" />
            <stop offset="100%" stopColor="#0071e3" />
          </linearGradient>
          <linearGradient id="ringGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34c759" />
            <stop offset="50%" stopColor="#0071e3" />
            <stop offset="100%" stopColor="#5e5ce6" />
          </linearGradient>
        </defs>

        {/* Outer decorative ring */}
        <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth={1} />

        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={sw} />

        {/* Progress arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={sw}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dashoffset 0.4s ease' }} />

        {/* Animated dot on progress */}
        {scanning && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ringGrad2)" strokeWidth={6}
            strokeDasharray={`1 ${circumference}`} strokeLinecap="round"
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
            className="animate-spin" />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[56px] font-bold tracking-[-0.03em] text-gradient leading-none">
          {progress}
        </span>
        <span className="text-[13px] font-medium text-[var(--text-secondary)] mt-1 tracking-wide">
          {scanning ? 'Scanning...' : 'Health Score'}
        </span>
      </div>
    </div>
  )
}

function ModuleCard({ icon: Icon, label, desc, to, issues, color, delay }) {
  const colors = {
    blue:   { bg: '#007aff15', fg: '#007aff', grad: 'from-blue-50 to-indigo-50/50' },
    green:  { bg: '#34c75915', fg: '#34c759', grad: 'from-green-50 to-emerald-50/50' },
    orange: { bg: '#ff950015', fg: '#ff9500', grad: 'from-orange-50 to-amber-50/50' },
    red:    { bg: '#ff3b3015', fg: '#ff3b30', grad: 'from-red-50 to-rose-50/50' },
    purple: { bg: '#af52de15', fg: '#af52de', grad: 'from-purple-50 to-violet-50/50' },
    teal:   { bg: '#5ac8fa15', fg: '#5ac8fa', grad: 'from-cyan-50 to-sky-50/50' },
  }
  const c = colors[color] || colors.blue

  return (
    <Link to={to} className="block">
      <div className="card p-5 h-full group cursor-pointer"
        style={{ animationDelay: `${delay}ms` }}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: c.bg, color: c.fg }}>
            <Icon size={20} />
          </div>
          {issues !== undefined && issues > 0 && (
            <span className="badge badge-orange">{issues} issue{issues > 1 ? 's' : ''}</span>
          )}
          {issues === 0 && (
            <span className="badge badge-green">Clean</span>
          )}
        </div>
        <div>
          <div className="font-semibold text-[15px] tracking-[-0.01em]">{label}</div>
          <div className="text-[13px] text-[var(--text-secondary)] mt-0.5 leading-snug">{desc}</div>
        </div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(85)

  const startScan = () => {
    if (scanning) return
    setScanning(true)
    setProgress(0)
    let p = 0
    const iv = setInterval(() => {
      const speeds = [0.6, 0.9, 1.4, 1.1, 0.5, 0.3, 0.7, 1.0]
      p += speeds[Math.floor(Math.random() * speeds.length)]
      if (p >= 100) { p = 100; clearInterval(iv); setScanning(false) }
      setProgress(Math.round(p))
    }, 80)
  }

  const modules = [
    { icon: Brush, label: 'System Cleanup', desc: 'Junk files, caches & temp data', to: '/cleanup', issues: 3, color: 'blue', delay: 50 },
    { icon: ShieldAlert, label: 'Malware Scan', desc: 'Threat detection & removal', to: '/malware', issues: 0, color: 'red', delay: 100 },
    { icon: Trash2, label: 'Uninstaller', desc: 'Remove apps & leftovers', to: '/uninstaller', issues: 2, color: 'orange', delay: 150 },
    { icon: Search, label: 'Large Files', desc: 'Find space-hogging files', to: '/largefiles', issues: 4, color: 'teal', delay: 200 },
    { icon: Shield, label: 'Privacy', desc: 'Privacy settings control', to: '/privacy', issues: 1, color: 'purple', delay: 250 },
    { icon: Wrench, label: 'Maintenance', desc: 'System maintenance tasks', to: '/maintenance', issues: 0, color: 'green', delay: 300 },
  ]

  const stats = [
    { icon: Cpu, label: 'CPU', value: '24%', sub: 'Idle' },
    { icon: Activity, label: 'RAM', value: '5.2 GB', sub: 'of 16 GB' },
    { icon: HardDrive, label: 'Disk C:', value: '184 GB', sub: 'free of 512' },
    { icon: Monitor, label: 'Startup', value: '14.2s', sub: 'Boot time' },
  ]

  return (
    <div className="anim-fade-up">
      {/* Hero */}
      <div className="flex flex-col lg:flex-row items-center gap-12 mb-14">
        {/* Scan ring */}
        <div className="shrink-0">
          <ScanCircle scanning={scanning} progress={progress} />
        </div>

        {/* Info */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-[34px] font-extrabold tracking-[-0.03em] leading-tight">
            Your PC is<span className="text-gradient"> healthy</span>
          </h1>
          <p className="text-[15px] text-[var(--text-secondary)] mt-3 max-w-md leading-relaxed">
            WinBoost keeps your Windows clean, secure, and running at peak performance with smart automated tools.
          </p>

          <div className="flex flex-wrap gap-3 mt-6 justify-center lg:justify-start">
            <button onClick={startScan} disabled={scanning} className="btn btn-primary btn-lg">
              <Sparkles size={18} />
              {scanning ? 'Scanning...' : 'Start Smart Scan'}
            </button>
            <Link to="/maintenance" className="btn btn-secondary btn-lg">
              Run Maintenance
            </Link>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {stats.map((s, i) => (
              <div key={s.label} className="bg-white rounded-xl p-3 border border-[var(--border)] text-center"
                style={{ animationDelay: `${i * 80}ms` }}>
                <s.icon size={16} className="mx-auto mb-1.5 text-[var(--text-tertiary)]" />
                <div className="text-lg font-bold tracking-[-0.02em]">{s.value}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[1px] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map(m => (
            <ModuleCard key={m.label} {...m} />
          ))}
        </div>
      </div>
    </div>
  )
}
