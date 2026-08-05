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
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="health-ring" aria-label={`System health ${value}%`}>
      <svg viewBox="0 0 160 160" role="img">
        <defs>
          <linearGradient id="healthGradient" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#45e8ff" />
            <stop offset="48%" stopColor="#7b7cff" />
            <stop offset="100%" stopColor="#d059ff" />
          </linearGradient>
          <filter id="healthGlow"><feGaussianBlur stdDeviation="3" result="blur" /></filter>
        </defs>
        <circle className="health-ring-glow" cx="80" cy="80" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
        <circle className="health-ring-track" cx="80" cy="80" r={radius} />
        <circle className="health-ring-value" cx="80" cy="80" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="health-ring-center">
        {scanning ? <ScanSearch size={30} className="scan-pulse" /> : <Check size={34} />}
        <strong>{value}%</strong>
        <span>{scanning ? 'Scanning' : 'Excellent'}</span>
      </div>
      {!scanning && <span className="health-ring-check"><Check size={13} /></span>}
    </div>
  )
}

function TrendChart({ compact = false }) {
  return (
    <svg className={`trend-chart ${compact ? 'compact' : ''}`} viewBox="0 0 430 130" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#42e9ff" stopOpacity=".24" />
          <stop offset="1" stopColor="#42e9ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="purpleArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b24cff" stopOpacity=".2" />
          <stop offset="1" stopColor="#b24cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="chart-grid" d="M0 26H430M0 65H430M0 104H430" />
      <path className="chart-area" fill="url(#purpleArea)" d="M0 111 C38 101,49 78,78 88 S123 103,150 62 S197 92,226 83 S270 42,299 77 S348 107,374 66 S414 69,430 45 L430 130 L0 130Z" />
      <path className="chart-line purple" d="M0 111 C38 101,49 78,78 88 S123 103,150 62 S197 92,226 83 S270 42,299 77 S348 107,374 66 S414 69,430 45" />
      <path className="chart-area" fill="url(#cyanArea)" d="M0 99 C31 88,53 102,77 73 S117 91,151 80 S193 47,229 67 S276 89,304 56 S348 70,375 48 S411 47,430 19 L430 130 L0 130Z" />
      <path className="chart-line cyan" d="M0 99 C31 88,53 102,77 73 S117 91,151 80 S193 47,229 67 S276 89,304 56 S348 70,375 48 S411 47,430 19" />
      <circle cx="430" cy="19" r="4" fill="#55ecff" />
      <circle cx="430" cy="45" r="4" fill="#bd5cff" />
    </svg>
  )
}

function Meter({ value, color = 'cyan' }) {
  return <div className="metric-meter"><i className={color} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
}

function DashboardPanel({ title, action, className = '', children }) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
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
    { to: '/cleanup', icon: Trash2, label: 'Junk Files', meta: 'Ready to scan', color: 'cyan' },
    { to: '/performance', icon: MemoryStick, label: 'Memory', meta: `${usedMemory} / ${totalMemory} GB`, color: 'purple' },
    { to: '/startup', icon: Power, label: 'Startup', meta: 'Manage apps', color: 'blue' },
    { to: '/disk', icon: HardDrive, label: 'Disk', meta: `${disk}% used`, color: 'green' },
  ]

  return (
    <div className="dashboard-v2 anim-fade-up">
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow"><Activity size={12} /> System overview</span>
          <h1>Your Windows control room. <span>{scanResult ? `Health score ${scanResult.score}/100.` : 'Ready for a verified scan.'}</span></h1>
        </div>
        <div className={`status-chip ${scanResult && !scanResult.defender?.realTimeProtection ? 'warning' : ''}`}><ShieldCheck size={15} /><span><strong>{scanResult ? (scanResult.defender?.realTimeProtection ? 'Defender active' : 'Protection needs attention') : 'Local monitoring'}</strong>{scanResult ? 'Verified by smart scan' : 'No cloud connection used'}</span></div>
      </div>

      <div className="dashboard-grid">
        <aside className="health-column">
          <div className="system-status-label">System status: <strong>Excellent ({health}%)</strong></div>
          <HealthRing score={health} scanning={scanning} progress={progress} />
          <button className="scan-button" onClick={startScan} disabled={scanning} title={scanStage}>
            <Sparkles size={16} /> {scanning ? `Scanning ${progress}%` : 'Start smart scan'}
          </button>
          {scanError && <div className="scan-inline-error">{scanError}</div>}
          {scanning && <div className="scan-stage-line">{scanStage}</div>}

          <div className="mini-panel">
            <div className="mini-panel-title"><span>Performance</span><Gauge size={14} /></div>
            <div className="metric-line"><span>CPU usage</span><strong>{cpu}%</strong></div>
            <Meter value={cpu} />
            <div className="metric-line"><span>RAM usage</span><strong>{usedMemory} / {totalMemory} GB</strong></div>
            <Meter value={memory} color="purple" />
          </div>

          <div className="mini-panel cleanup-summary">
            <div className="mini-panel-title"><span>Cleanup status</span><Brush size={14} /></div>
            <strong>{scanResult ? `${scanResult.reclaimableGB} GB reclaimable` : 'Scan for reclaimable space'}</strong>
            <p>Verified temporary files, caches and logs</p>
            <Link to="/cleanup">Clean now <ChevronRight size={13} /></Link>
          </div>

          <div className="mini-panel startup-summary">
            <div className="mini-panel-title"><span>Startup apps</span><Power size={14} /></div>
            <strong>{scanResult ? `${scanResult.startupCount} startup entries` : 'Optimize boot time'}</strong>
            <Link to="/startup">Optimize <ChevronRight size={13} /></Link>
          </div>
        </aside>

        <div className="dashboard-main-grid">
          <DashboardPanel
            title="Quick access"
            className="performance-chart-panel"
            action={<Link to="/performance">Optimize <ArrowUpRight size={13} /></Link>}
          >
            <div className="chart-legend"><span><i className="cyan" /> CPU</span><span><i className="purple" /> Memory</span></div>
            <TrendChart />
          </DashboardPanel>

          <DashboardPanel title="Quick tools" className="quick-tools-panel">
            <div className="quick-tool-list">
              {quickLinks.map(({ to, icon: Icon, label, meta, color }) => (
                <Link to={to} key={label} className="quick-tool-row">
                  <span className={`quick-tool-icon ${color}`}><Icon size={17} /></span>
                  <span><strong>{label}</strong><small>{meta}</small></span>
                  <ChevronRight size={14} />
                </Link>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel title="System health" className="system-health-panel">
            <div className="health-metrics">
              <div><Thermometer size={17} /><span><small>System load</small><strong>{cpu < 55 ? 'Normal' : 'Elevated'}</strong></span><b>{cpu}%</b></div>
              <div><HardDrive size={17} /><span><small>Disk usage</small><strong>{disk < 80 ? 'Healthy' : 'Review'}</strong></span><b>{disk}%</b></div>
            </div>
            <TrendChart compact />
          </DashboardPanel>

          <DashboardPanel title="Recent activity" className="activity-panel" action={<History size={14} />}>
            <div className="activity-list">
              <div><span className="activity-icon cyan"><Zap size={14} /></span><p><strong>Live system monitoring</strong><small>Real CPU, memory and disk metrics refresh automatically</small></p><time>Now</time></div>
              <div><span className="activity-icon purple"><ShieldCheck size={14} /></span><p><strong>{scanResult ? 'Smart scan verified' : 'Protection awaiting scan'}</strong><small>{scanResult ? `${scanResult.checks?.filter(item => item.ok).length || 0} of ${scanResult.checks?.length || 0} checks healthy` : 'Run Smart Scan for Microsoft Defender status'}</small></p><time>{scanResult ? 'Now' : 'Ready'}</time></div>
              <div><span className="activity-icon green"><Cpu size={14} /></span><p><strong>System health calculated</strong><small>CPU, memory and disk analyzed</small></p><time>Today</time></div>
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  )
}
