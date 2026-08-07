import { useCallback, useEffect, useState } from 'react'
import {
  Cpu, HardDrive, MemoryStick, Monitor, Shield,
  Sparkles, Wrench, Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getHardwareInfo, getSystemStats, runSmartScan } from '@/lib/api'

const FALLBACK_STATS = {
  cpu: { usage: 18, model: 'Intel Core i7-12700K', cores: 16, speed: '3600 MHz', architecture: 'x64' },
  gpu: { model: 'NVIDIA GeForce RTX 3060', vram: '12 GB' },
  ram: { total: 17179869184, used: 8589934592, free: 8589934592, percent: 50 },
  disks: [{ drive: 'C:', label: 'Windows', total: 500107862016, free: 250053931008, used: 250053931008, percent: 50 }],
  os: { platform: 'win32', release: '10.0.22621', arch: 'x64', uptime: 86400 },
  hostname: 'DESKTOP-WINBOOST',
  tweaks: { applied: 12, status: 'Protected' },
  lastScan: '2 hours ago',
}

function formatGB(bytes) {
  if (bytes == null) return 'N/A'
  return (bytes / (1024 ** 3)).toFixed(1)
}

function formatUptime(seconds) {
  if (seconds == null) return 'N/A'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

function formatBytes(bytes) {
  if (bytes == null) return 'N/A'
  if (bytes >= 1024 ** 4) return `${(bytes / (1024 ** 4)).toFixed(1)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
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
      const [hw, sys] = await Promise.all([
        getHardwareInfo().catch(() => null),
        getSystemStats().catch(() => null),
      ])

      if (!hw && !sys) {
        setStats(FALLBACK_STATS)
        setLoading(false)
        return
      }

      const ramTotal = hw?.ram?.total
        ?? (sys?.memory?.total != null ? sys.memory.total * (1024 ** 3) : null)
        ?? 0
      const ramUsed = hw?.ram?.used
        ?? (sys?.memory?.used != null ? sys.memory.used * (1024 ** 3) : null)
        ?? 0
      const ramFree = hw?.ram?.free
        ?? (sys?.memory?.free != null ? sys.memory.free * (1024 ** 3) : null)
        ?? 0
      const ramPercent = sys?.memory?.percent
        ?? (ramTotal > 0 ? (ramUsed / ramTotal) * 100 : 0)

      const disks = hw?.disks?.map(d => ({
        drive: d.drive,
        label: d.label,
        total: d.total,
        free: d.free,
        used: d.total - d.free,
        percent: d.total > 0 ? ((d.total - d.free) / d.total) * 100 : 0,
      }))
        ?? sys?.disk?.map(d => ({
          drive: d.fs,
          label: d.fs,
          total: (d.total ?? 0) * (1024 ** 3),
          free: (d.free ?? 0) * (1024 ** 3),
          used: (d.used ?? 0) * (1024 ** 3),
          percent: d.percent ?? 0,
        }))
        ?? FALLBACK_STATS.disks

      const merged = {
        cpu: {
          model: hw?.cpu?.model ?? sys?.cpu?.model ?? FALLBACK_STATS.cpu.model,
          cores: hw?.cpu?.cores ?? sys?.cpu?.cores ?? FALLBACK_STATS.cpu.cores,
          speed: hw?.cpu?.speed ?? (sys?.cpu?.speed != null ? `${sys.cpu.speed} GHz` : FALLBACK_STATS.cpu.speed),
          architecture: hw?.cpu?.architecture ?? FALLBACK_STATS.cpu.architecture,
          usage: sys?.cpu?.usage,
        },
        gpu: {
          model: hw?.gpu?.model ?? FALLBACK_STATS.gpu.model,
          vram: hw?.gpu?.vram ?? FALLBACK_STATS.gpu.vram,
        },
        ram: {
          total: ramTotal,
          used: ramUsed,
          free: ramFree,
          percent: ramPercent,
        },
        disks,
        os: {
          platform: hw?.os?.platform ?? sys?.os?.platform ?? FALLBACK_STATS.os.platform,
          release: hw?.os?.release ?? sys?.os?.version ?? FALLBACK_STATS.os.release,
          arch: hw?.os?.arch ?? FALLBACK_STATS.os.arch,
          uptime: hw?.os?.uptime ?? (sys?.os?.uptime != null ? sys.os.uptime * 3600 : FALLBACK_STATS.os.uptime),
        },
        hostname: hw?.hostname ?? sys?.os?.hostname ?? FALLBACK_STATS.hostname,
        tweaks: {
          applied: sys?.tweaks?.applied,
          status: sys?.tweaks?.status,
        },
        lastScan: sys?.lastScan,
        motherboard: hw?.motherboard,
        bios: hw?.bios,
      }

      setStats(merged)
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
  const gpu = stats?.gpu ?? FALLBACK_STATS.gpu
  const ram = stats?.ram ?? FALLBACK_STATS.ram
  const disks = stats?.disks ?? FALLBACK_STATS.disks
  const os = stats?.os ?? FALLBACK_STATS.os

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-sparkle-text">
          Hello, there!{' '}
          <span className="text-gradient">{stats?.hostname?.split('-')[0] ?? 'User'}</span>
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
          badgeValue={cpu.usage != null ? `${Math.round(cpu.usage)}%` : 'N/A'}
          rows={[
            { label: 'Cores', value: cpu.cores != null ? `${cpu.cores} cores` : 'N/A' },
            { label: 'Speed', value: cpu.speed ?? 'N/A' },
            { label: 'Architecture', value: cpu.architecture ?? 'N/A' },
          ]}
        />

        {/* GPU */}
        <InfoCard
          icon={Monitor}
          title="Graphics"
          subtitle={gpu.model ?? 'Unknown GPU'}
          iconBg="bg-sparkle-purple/10"
          iconColor="text-sparkle-purple"
          badgeVariant="purple"
          badgeValue="GPU"
          rows={[
            { label: 'VRAM', value: gpu.vram ?? 'N/A' },
          ]}
        />

        {/* RAM */}
        <InfoCard
          icon={MemoryStick}
          title="Memory"
          subtitle={`${formatGB(ram.total)} GB Total`}
          iconBg="bg-sparkle-success/10"
          iconColor="text-sparkle-success"
          badgeVariant="success"
          badgeValue={`${Math.round(ram.percent ?? 0)}%`}
          rows={[
            { label: 'Used', value: `${formatGB(ram.used)} GB` },
            { label: 'Free', value: `${formatGB(ram.free)} GB` },
          ]}
        >
          <ProgressRow
            label="Usage"
            value={`${Math.round(ram.percent ?? 0)}%`}
            percent={ram.percent ?? 0}
          />
        </InfoCard>

        {/* System */}
        <InfoCard
          icon={Monitor}
          title="System"
          subtitle={stats?.hostname ?? 'Unknown'}
          iconBg="bg-sparkle-teal/10"
          iconColor="text-sparkle-teal"
          badgeVariant="teal"
          badgeValue={os.platform ?? 'Windows'}
          rows={[
            { label: 'OS', value: `${os.platform ?? '?'} ${os.release ?? ''}` },
            { label: 'Architecture', value: os.arch ?? 'N/A' },
            { label: 'Uptime', value: formatUptime(os.uptime) },
          ]}
        />

        {/* Storage */}
        {disks.map((disk, i) => (
          <InfoCard
            key={i}
            icon={HardDrive}
            title="Storage"
            subtitle={`${disk.drive} ${disk.label ? `(${disk.label})` : ''}`}
            iconBg="bg-sparkle-warning/10"
            iconColor="text-sparkle-warning"
            badgeVariant="warning"
            badgeValue={`${Math.round(disk.percent ?? 0)}%`}
            rows={[
              { label: 'Total', value: `${formatGB(disk.total)} GB` },
              { label: 'Free', value: `${formatGB(disk.free)} GB` },
            ]}
          >
            <ProgressRow
              label="Used"
              value={`${formatGB(disk.used)} GB`}
              percent={disk.percent ?? 0}
            />
          </InfoCard>
        ))}

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
