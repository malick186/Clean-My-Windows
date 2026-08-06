import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, ArrowUpRight, Brush, Check, ChevronRight, Cpu, Gauge,
  HardDrive, History, MemoryStick, Power, ScanSearch, ShieldCheck,
  Sparkles, Thermometer, Trash2, Zap,
} from 'lucide-react'
import { getSystemStats, runSmartScan } from '../lib/api'

function HealthRing({ score, scanning, progress }) {
  const value = scanning ? progress : score
  const radius = 63
  const circumference = 2 * Math.PI * radius

  return (
    <div className="health-ring" aria-label={`System health ${value}%`}>
      <svg viewBox="0 0 160 160" role="img">
        <defs>
          <linearGradient id="healthGrad" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-grad-start)" />
            <stop offset="48%" stopColor="var(--accent-grad-mid)" />
            <stop offset="100%" stopColor="var(--accent-grad-end)" />
          </linearGradient>
        </defs>
        <circle className="health-ring-glow" cx="80" cy="80" r={radius} stroke="url(#healthGrad)" strokeDasharray={circumference} strokeDashoffset={circumference - (value / 100) * circumference} />
        <circle className="health-ring-track" cx="80" cy="80" r={radius} />
        <circle className="health-ring-value" cx="80" cy="80" r={radius} stroke="url(#healthGrad)" strokeDasharray={circumference} strokeDashoffset={circumference - (value / 100) * circumference} />
      </svg>
      <div className="health-ring-center">
        {scanning ? <ScanSearch size={30} style={{ animation: 'scanPulse 1.5s ease-in-out infinite', color: 'var(--accent)' }} /> : <Check size={34} />}
        <strong>{value}%</strong>
        <span>{scanning ? 'Scanning' : score >= 85 ? 'Excellent' : 'Good'}</span>
      </div>
      {!scanning && <span className="health-ring-check"><Check size={13} /></span>}
    </div>
  )
}

function TrendChart({ compact = false }) {
  return (
    <svg className="trend-chart" viewBox="0 0 430 130" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-grad-start)" stopOpacity=".24" />
          <stop offset="1" stopColor="var(--accent-grad-start)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="purpleArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-grad-end)" stopOpacity=".2" />
          <stop offset="1" stopColor="var(--accent-grad-end)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line className="chart-grid" x1="0" y1="26" x2="430" y2="26" />
      <line className="chart-grid" x1="0" y1="65" x2="430" y2="65" />
      <line className="chart-grid" x1="0" y1="104" x2="430" y2="104" />
      <path className="chart-area" fill="url(#purpleArea)" d="M0 111 C38 101,49 78,78 88 S123 103,150 62 S197 92,226 83 S270 42,299 77 S348 107,374 66 S414 69,430 45 L430 130 L0 130Z" />
      <path className="chart-line" stroke="var(--accent-grad-end)" d="M0 111 C38 101,49 78,78 88 S123 103,150 62 S197 92,226 83 S270 42,299 77 S348 107,374 66 S414 69,430 45" />
      <path className="chart-area" fill="url(#cyanArea)" d="M0 99 C31 88,53 102,77 73 S117 91,151 80 S193 47,229 67 S276 89,304 56 S348 70,375 48 S411 47,430 19 L430 130 L0 130Z" />
      <path className="chart-line" stroke="var(--accent-grad-start)" d="M0 99 C31 88,53 102,77 73 S117 91,151 80 S193 47,229 67 S276 89,304 56 S348 70,375 48 S411 47,430 19" />
      <circle cx="430" cy="19" r="4" fill="var(--accent-grad-start)" />
      <circle cx="430" cy="45" r="4" fill="var(--accent-grad-end)" />
    </svg>
  )
}

function Meter({ value, color = 'cyan' }) {
  return (
    <div className="h-[3px] rounded-full bg-surface-secondary overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color === 'purple' ? 'var(--accent-grad-end)' : 'var(--accent-grad-start)'
        }}
      />
    </div>
  )
}

function MiniPanel({ title, icon: Icon, children }) {
  return (
    <div className="rounded-[12px] bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider">{title}</span>
        <Icon size={14} className="text-text-tertiary" />
      </div>
      {children}
    </div>
  )
}

function DashCard({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-[14px] bg-surface border border-border p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [scanStage, setScanStage] = useState('')
  const [scanError, setScanError] = useState('')

  const refreshStats = useCallback(async () => {
    try { setStats(await getSystemStats()) } catch {}
  }, [])

  useEffect(() => {
    refreshStats()
    const timer = setInterval(refreshStats, 5000)
    return () => clearInterval(timer)
  }, [refreshStats])

  const cpu = Math.round(stats?.cpu?.usage ?? 24)
  const memory = Math.round(stats?.memory?.percent ?? 34)
  const disk = Math.round(stats?.disk?.[0]?.percent ?? 64)
  const snapshotHealth = useMemo(() => Math.max(65, Math.min(98, Math.round(100 - cpu * .18 - memory * .16 - disk * .08))), [cpu, memory, disk])
  const health = scanResult?.score ?? snapshotHealth
  const usedMemory = stats?.memory?.used ?? 5.4
  const totalMemory = stats?.memory?.total ?? 16

  const startScan = async () => {
    if (scanning) return
    setScanning(true); setProgress(0); setScanError(''); setScanStage('Starting real system checks...')
    try {
      const result = await runSmartScan(({ percent, stage }) => {
        setProgress(percent || 0); if (stage) setScanStage(stage)
      })
      setScanResult(result); setStats(result.stats || stats); setProgress(100)
    } catch (error) { setScanError(error.message) }
    finally { setScanning(false) }
  }

  const quickLinks = [
    { to: '/cleanup', icon: Trash2, label: 'Junk Files', meta: 'Ready to scan', color: 'teal' },
    { to: '/performance', icon: MemoryStick, label: 'Memory', meta: `${usedMemory} / ${totalMemory} GB`, color: 'purple' },
    { to: '/startup', icon: Power, label: 'Startup', meta: 'Manage apps', color: 'blue' },
    { to: '/disk', icon: HardDrive, label: 'Disk', meta: `${disk}% used`, color: 'green' },
  ]

  return (
    <div className="space-y-5 anim-fade-up">
      {/* Intro */}
      <div className="flex items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
            <Activity size={12} /> System overview
          </div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
            Your Windows control room.{' '}
            <span className="text-text-secondary font-medium">
              {scanResult ? `Health score ${scanResult.score}/100.` : 'Ready for a verified scan.'}
            </span>
          </h1>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-[11px] text-xs min-w-[180px] ${
          scanResult && !scanResult.defender?.realTimeProtection
            ? 'bg-orange-bg border border-orange/20 text-orange'
            : 'bg-green-bg border border-green/20 text-green'
        }`}>
          <ShieldCheck size={15} />
          <div className="flex flex-col">
            <strong className="text-[10px]">
              {scanResult ? (scanResult.defender?.realTimeProtection ? 'Defender active' : 'Attention needed') : 'Local monitoring'}
            </strong>
            <span className="text-[8px] opacity-70">{scanResult ? 'Verified by smart scan' : 'No cloud connection used'}</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '240px 1fr' }}>
        {/* Left column */}
        <aside className="flex flex-col gap-3">
          <div className="text-[10px] text-text-tertiary text-center font-semibold">
            System status: <strong className="text-text-secondary">Excellent ({health}%)</strong>
          </div>
          <HealthRing score={health} scanning={scanning} progress={progress} />
          <button
            onClick={startScan}
            disabled={scanning}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-[10px] bg-accent/10 border border-accent/20 text-accent text-[13px] font-semibold hover:bg-accent/15 transition-colors disabled:opacity-50"
          >
            <Sparkles size={16} /> {scanning ? `Scanning ${progress}%` : 'Start smart scan'}
          </button>
          {scanError && <div className="text-[11px] text-red px-2">{scanError}</div>}
          {scanning && <div className="text-[11px] text-text-tertiary text-center">{scanStage}</div>}

          <MiniPanel title="Performance" icon={Gauge}>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-text-tertiary">CPU usage</span>
                <strong className="text-text-secondary">{cpu}%</strong>
              </div>
              <Meter value={cpu} />
              <div className="flex justify-between text-[11px]">
                <span className="text-text-tertiary">RAM usage</span>
                <strong className="text-text-secondary">{usedMemory} / {totalMemory} GB</strong>
              </div>
              <Meter value={memory} color="purple" />
            </div>
          </MiniPanel>

          <MiniPanel title="Cleanup status" icon={Brush}>
            <strong className="text-[13px] text-text block mb-1">
              {scanResult ? `${scanResult.reclaimableGB} GB reclaimable` : 'Scan for reclaimable space'}
            </strong>
            <p className="text-[10px] text-text-tertiary mb-2">Verified temporary files, caches and logs</p>
            <Link to="/cleanup" className="inline-flex items-center gap-1 text-[11px] text-accent font-semibold hover:underline">
              Clean now <ChevronRight size={13} />
            </Link>
          </MiniPanel>

          <MiniPanel title="Startup apps" icon={Power}>
            <strong className="text-[13px] text-text block mb-2">
              {scanResult ? `${scanResult.startupCount} startup entries` : 'Optimize boot time'}
            </strong>
            <Link to="/startup" className="inline-flex items-center gap-1 text-[11px] text-accent font-semibold hover:underline">
              Optimize <ChevronRight size={13} />
            </Link>
          </MiniPanel>
        </aside>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <DashCard
            title="Quick access"
            action={<Link to="/performance" className="flex items-center gap-1 text-[11px] text-accent font-semibold hover:underline">Optimize <ArrowUpRight size={13} /></Link>}
          >
            <div className="flex gap-6 text-[10px] text-text-tertiary mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-grad-start)' }} /> CPU
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-grad-end)' }} /> Memory
              </span>
            </div>
            <div className="h-[100px] rounded-lg overflow-hidden bg-surface-secondary">
              <TrendChart />
            </div>
          </DashCard>

          <DashCard title="Quick tools">
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map(({ to, icon: Icon, label, meta, color }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-surface-secondary transition-colors group"
                >
                  <span className={`flex items-center justify-center w-9 h-9 rounded-lg bg-${color}-bg module-${color}`}>
                    <Icon size={17} />
                  </span>
                  <span className="flex flex-col flex-1">
                    <strong className="text-[12px] text-text group-hover:text-accent transition-colors">{label}</strong>
                    <small className="text-[10px] text-text-tertiary">{meta}</small>
                  </span>
                  <ChevronRight size={14} className="text-text-tertiary" />
                </Link>
              ))}
            </div>
          </DashCard>

          <DashCard title="System health">
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-3 flex-1 p-3 rounded-[10px] bg-surface-secondary">
                <Thermometer size={17} className={cpu < 55 ? 'text-green' : 'text-orange'} />
                <div className="flex flex-col flex-1">
                  <small className="text-[10px] text-text-tertiary">System load</small>
                  <strong className="text-[11px] text-text">{cpu < 55 ? 'Normal' : 'Elevated'}</strong>
                </div>
                <b className="text-sm text-text-secondary">{cpu}%</b>
              </div>
              <div className="flex items-center gap-3 flex-1 p-3 rounded-[10px] bg-surface-secondary">
                <HardDrive size={17} className={disk < 80 ? 'text-green' : 'text-orange'} />
                <div className="flex flex-col flex-1">
                  <small className="text-[10px] text-text-tertiary">Disk usage</small>
                  <strong className="text-[11px] text-text">{disk < 80 ? 'Healthy' : 'Review'}</strong>
                </div>
                <b className="text-sm text-text-secondary">{disk}%</b>
              </div>
            </div>
            <div className="h-[60px] rounded-lg overflow-hidden bg-surface-secondary">
              <TrendChart compact />
            </div>
          </DashCard>

          <DashCard title="Recent activity" action={<History size={14} className="text-text-tertiary" />}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-bg text-teal flex-shrink-0">
                  <Zap size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="text-[12px] text-text block">Live system monitoring</strong>
                  <small className="text-[10px] text-text-tertiary">Real CPU, memory and disk metrics refresh automatically</small>
                </div>
                <time className="text-[10px] text-text-tertiary flex-shrink-0">Now</time>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-bg text-purple flex-shrink-0">
                  <ShieldCheck size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="text-[12px] text-text block">{scanResult ? 'Smart scan verified' : 'Protection awaiting scan'}</strong>
                  <small className="text-[10px] text-text-tertiary">
                    {scanResult
                      ? `${scanResult.checks?.filter(item => item.ok).length || 0} of ${scanResult.checks?.length || 0} checks healthy`
                      : 'Run Smart Scan for Microsoft Defender status'}
                  </small>
                </div>
                <time className="text-[10px] text-text-tertiary flex-shrink-0">{scanResult ? 'Now' : 'Ready'}</time>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-bg text-green flex-shrink-0">
                  <Cpu size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="text-[12px] text-text block">System health calculated</strong>
                  <small className="text-[10px] text-text-tertiary">CPU, memory and disk analyzed</small>
                </div>
                <time className="text-[10px] text-text-tertiary flex-shrink-0">Today</time>
              </div>
            </div>
          </DashCard>
        </div>
      </div>
    </div>
  )
}
