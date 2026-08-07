import { useCallback, useEffect, useState } from 'react'
import {
  Cpu, HardDrive, MemoryStick, Monitor, Shield,
  Sparkles, Wrench, Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getSystemStats, runSmartScan } from '@/lib/api'

const FALLBACK_STATS = {
  cpu: { usage: 18, model: 'Intel Core i7-12700K', cores: 12, threads: 20, speed: 3.6 },
  memory: { used: 8.5, total: 16, free: 7.5, percent: 53 },
  disk: [{ fs: 'C:', used: 328, total: 512, free: 184, percent: 64 }],
  os: { platform: 'Windows 11 Pro', version: '23H2', build: '22631', uptime: 2.4, hostname: 'DESKTOP-WINBOOST' },
}

function formatUptime(hours) {
  if (!hours && hours !== 0) return 'N/A'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${Math.round(hours)} hr`
  const days = Math.floor(hours / 24)
  const remainder = Math.round(hours % 24)
  return remainder > 0 ? `${days}d ${remainder}h` : `${days}d`
}

function formatGB(gb) {
  if (gb == null) return 'N/A'
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`
  return `${gb.toFixed(1)} GB`
}

function InfoCard({ icon: Icon, title, subtitle, badgeVariant, badgeValue, iconBg, iconColor, rows, children }) {
  return (
    <Card className="hover:border-sparkle-primary/50 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon size={20} className={iconColor} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-sparkle-text">{title}</h3>
            <p className="text-xs text-sparkle-text-secondary mt-0.5">{subtitle}</p>
          </div>
        </div>
        {badgeValue != null && (
          <Badge variant={badgeVariant}>{badgeValue}</Badge>
        )}
      </div>
      {rows && rows.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-sparkle-text-secondary">{row.label}</span>
              <span className="text-sparkle-text font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </Card>
  )
}

function ProgressRow({ label, value, percent, animate }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-sparkle-text-secondary">{label}</span>
        <span className="text-sparkle-text font-medium">{value}</span>
      </div>
      <Progress value={percent} className={animate ? '[&>div]:animate-shimmer' : ''} />
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanError, setScanError] = useState(null)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const data = await getSystemStats()
      setStats(data || FALLBACK_STATS)
    } catch {
      setStats(FALLBACK_STATS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleSmartScan = async () => {
    if (scanning) return
    setScanning(true)
    setScanProgress(0)
    setScanError(null)
    try {
      const result = await runSmartScan(({ percent }) => {
        setScanProgress(percent || 0)
      })
      setStats(result?.stats || stats)
    } catch (err) {
      setScanError(err.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <span>Loading dashboard...</span>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="loading-state">
        <div className="text-sparkle-danger mb-2">
          <Shield size={32} className="mx-auto mb-2" />
          <span>Failed to load system stats</span>
        </div>
        <Button variant="outline" onClick={fetchStats}>Retry</Button>
      </div>
    )
  }

  const cpu = stats?.cpu ?? FALLBACK_STATS.cpu
  const memory = stats?.memory ?? FALLBACK_STATS.memory
  const disk = stats?.disk?.[0] ?? FALLBACK_STATS.disk[0]
  const os = stats?.os ?? FALLBACK_STATS.os

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-sparkle-text">
          Hello, there!{' '}
          <span className="text-gradient">{os.hostname?.split('-')[0] ?? 'User'}</span>
        </h1>
        <p className="text-sm text-sparkle-text-secondary mt-1">
          Here&apos;s your system overview
        </p>
      </div>

      {/* System Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CPU */}
        <InfoCard
          icon={Cpu}
          title="Processor"
          subtitle={cpu.model ?? 'Unknown CPU'}
          iconBg="bg-sparkle-primary/10"
          iconColor="text-sparkle-primary"
          badgeVariant="default"
          badgeValue={`${Math.round(cpu.usage ?? 0)}%`}
          rows={[
            { label: 'Cores', value: `${cpu.cores ?? 'N/A'}` },
            { label: 'Threads', value: `${cpu.threads ?? 'N/A'}` },
            { label: 'Base Speed', value: cpu.speed ? `${cpu.speed} GHz` : 'N/A' },
          ]}
        />

        {/* GPU */}
        <InfoCard
          icon={Monitor}
          title="Graphics"
          subtitle={stats?.gpu?.name ?? 'NVIDIA RTX 3060'}
          iconBg="bg-sparkle-purple/10"
          iconColor="text-sparkle-purple"
          badgeVariant="purple"
          badgeValue={stats?.gpu?.temp != null ? `${Math.round(stats.gpu.temp)}°C` : '45°C'}
          rows={[
            { label: 'Driver', value: stats?.gpu?.driverVersion ?? '537.42' },
            { label: 'VRAM', value: stats?.gpu?.vram ? `${stats.gpu.vram} GB` : '12 GB' },
          ]}
        />

        {/* RAM */}
        <InfoCard
          icon={MemoryStick}
          title="Memory"
          subtitle={`${formatGB(memory.total)} Total`}
          iconBg="bg-sparkle-success/10"
          iconColor="text-sparkle-success"
          badgeVariant="success"
          badgeValue={`${Math.round(memory.percent ?? 0)}%`}
          rows={[
            { label: 'Used', value: formatGB(memory.used) },
            { label: 'Free', value: formatGB(memory.free) },
          ]}
        >
          <ProgressRow
            label="Usage"
            value={`${Math.round(memory.percent ?? 0)}%`}
            percent={memory.percent ?? 0}
          />
        </InfoCard>

        {/* System */}
        <InfoCard
          icon={Monitor}
          title="System"
          subtitle={os.hostname ?? 'Unknown'}
          iconBg="bg-sparkle-teal/10"
          iconColor="text-sparkle-teal"
          badgeVariant="teal"
          badgeValue={os.platform ?? 'Windows'}
          rows={[
            { label: 'Version', value: os.version ?? 'N/A' },
            { label: 'Uptime', value: formatUptime(os.uptime) },
          ]}
        />

        {/* Storage */}
        <InfoCard
          icon={HardDrive}
          title="Storage"
          subtitle={`${disk.fs ?? 'C:'} Drive`}
          iconBg="bg-sparkle-warning/10"
          iconColor="text-sparkle-warning"
          badgeVariant="warning"
          badgeValue={`${Math.round(disk.percent ?? 0)}%`}
          rows={[
            { label: 'Total', value: formatGB(disk.total) },
            { label: 'Free', value: formatGB(disk.free) },
          ]}
        >
          <ProgressRow
            label="Used"
            value={formatGB(disk.used)}
            percent={disk.percent ?? 0}
          />
        </InfoCard>

        {/* Tweaks */}
        <InfoCard
          icon={Wrench}
          title="Tweaks"
          subtitle="Security & Optimization"
          iconBg="bg-sparkle-pink/10"
          iconColor="text-sparkle-pink"
          badgeVariant="pink"
          badgeValue="Active"
          rows={[
            { label: 'Active Tweaks', value: stats?.tweaks?.applied != null ? `${stats.tweaks.applied} applied` : '—' },
            { label: 'Security', value: stats?.tweaks?.status ?? '—' },
            { label: 'Last Scan', value: stats?.lastScan ?? '—' },
          ]}
        />
      </div>

      {/* CTA Banner */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-sparkle-primary/5 via-sparkle-card to-sparkle-purple/5 border-sparkle-primary/20">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-sparkle-primary" />
            <h3 className="text-base font-semibold text-sparkle-text">Ready to optimize your system?</h3>
          </div>
          <p className="text-sm text-sparkle-text-secondary">
            Run a smart scan to check for issues, junk, and performance bottlenecks.
          </p>
          {scanError && (
            <p className="text-xs text-sparkle-danger mt-2">{scanError}</p>
          )}
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSmartScan}
          disabled={scanning}
          className="shrink-0"
        >
          <Sparkles size={18} />
          {scanning ? `Scanning ${scanProgress}%` : 'Run Smart Scan'}
        </Button>
      </Card>
    </div>
  )
}
