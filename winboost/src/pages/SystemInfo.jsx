import { useState, useEffect, useCallback } from 'react'
import {
  Cpu, Monitor, MemoryStick, HardDrive, FileText,
  Loader, AlertTriangle, RefreshCw, Info, XCircle,
} from 'lucide-react'
import {
  getHardwareInfo, listProcesses, killProcess, exportSystemReport,
} from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '../utils/toast.jsx'

function InfoCard({ icon: Icon, title, subtitle, iconBg, iconColor, children }) {
  return (
    <Card className="hover:border-sparkle-primary/50 transition-all duration-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-sparkle-text">{title}</h3>
          <p className="text-xs text-sparkle-text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function formatBytes(bytes) {
  if (bytes == null) return 'N/A'
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${bytes} B`
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function SystemInfo() {
  const toast = useToast()
  const [hardware, setHardware] = useState(null)
  const [processes, setProcesses] = useState([])
  const [hwLoading, setHwLoading] = useState(true)
  const [hwError, setHwError] = useState(null)
  const [procLoading, setProcLoading] = useState(true)
  const [procError, setProcError] = useState(null)
  const [killing, setKilling] = useState(null)
  const [exporting, setExporting] = useState(false)

  const fetchHardware = useCallback(async () => {
    setHwLoading(true)
    setHwError(null)
    try {
      const data = await getHardwareInfo()
      setHardware(data)
    } catch (err) {
      setHwError(err.message || 'Failed to load hardware info')
    } finally {
      setHwLoading(false)
    }
  }, [])

  const fetchProcesses = useCallback(async () => {
    setProcLoading(true)
    setProcError(null)
    try {
      const data = await listProcesses()
      setProcesses(data?.processes || [])
    } catch (err) {
      setProcError(err.message || 'Failed to load processes')
    } finally {
      setProcLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHardware()
    fetchProcesses()
  }, [fetchHardware, fetchProcesses])

  const handleKillProcess = async (pid) => {
    setKilling(pid)
    try {
      await killProcess(pid)
      setProcesses((prev) => prev.filter((p) => p.pid !== pid))
      toast.add(`Process ${pid} terminated`, 'success')
    } catch (err) {
      toast.add(err.message || 'Failed to kill process', 'error')
    } finally {
      setKilling(null)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportSystemReport()
      if (result?.success) {
        toast.add(`Report saved to ${result.path || 'disk'}`, 'success')
      } else {
        toast.add(result?.error || 'Export failed', 'error')
      }
    } catch (err) {
      toast.add(err.message || 'Failed to export report', 'error')
    } finally {
      setExporting(false)
    }
  }

  const cpu = hardware?.cpu || {}
  const gpu = hardware?.gpu || {}
  const ram = hardware?.ram || {}
  const disks = hardware?.disks || []
  const os = hardware?.os || {}

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-primary/10 text-sparkle-primary shadow-sm">
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.08em] mb-2">
              <Cpu size={11} /> System Info
            </div>
            <h1 className="text-2xl font-bold text-sparkle-text tracking-tight">System Information</h1>
            <p className="text-sm text-sparkle-text-secondary mt-1.5">Detailed hardware specs, system details, and running processes</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
          <FileText size={14} />
          {exporting ? 'Exporting...' : 'Export System Report'}
        </Button>
      </div>

      {hwError && (
        <div className="notice-banner error">
          <AlertTriangle size={17} />{hwError}
          <Button variant="outline" size="sm" onClick={fetchHardware}>Retry</Button>
        </div>
      )}

      {/* Hardware Overview */}
      {hwLoading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>Gathering hardware info...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CPU */}
            <InfoCard
              icon={Cpu}
              title="Processor"
              subtitle={cpu.model || 'Unknown CPU'}
              iconBg="bg-sparkle-primary/10"
              iconColor="text-sparkle-primary"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-sparkle-text-secondary">Cores</span>
                  <span className="text-sparkle-text font-medium">{cpu.cores || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-sparkle-text-secondary">Speed</span>
                  <span className="text-sparkle-text font-medium">{cpu.speed ? `${cpu.speed}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-sparkle-text-secondary">Architecture</span>
                  <span className="text-sparkle-text font-medium">{cpu.architecture || 'N/A'}</span>
                </div>
              </div>
            </InfoCard>

            {/* GPU */}
            <InfoCard
              icon={Monitor}
              title="Graphics"
              subtitle={gpu.model || 'Unknown GPU'}
              iconBg="bg-sparkle-purple/10"
              iconColor="text-sparkle-purple"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-sparkle-text-secondary">Model</span>
                  <span className="text-sparkle-text font-medium">{gpu.model || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-sparkle-text-secondary">VRAM</span>
                  <span className="text-sparkle-text font-medium">{gpu.vram || 'N/A'}</span>
                </div>
              </div>
            </InfoCard>

            {/* RAM */}
            <InfoCard
              icon={MemoryStick}
              title="Memory"
              subtitle={`${ram.total ? formatBytes(ram.total) : 'Unknown'}`}
              iconBg="bg-sparkle-success/10"
              iconColor="text-sparkle-success"
            >
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-sparkle-text-secondary">Used</span>
                <span className="text-sparkle-text font-medium">{ram.used != null ? formatBytes(ram.used) : 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-sparkle-text-secondary">Free</span>
                <span className="text-sparkle-text font-medium">{ram.free != null ? formatBytes(ram.free) : 'N/A'}</span>
              </div>
              {ram.total > 0 && (
                <div className="mt-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-sparkle-text-secondary">Usage</span>
                    <span className="text-sparkle-text font-medium">
                      {ram.total ? `${Math.round((ram.used / ram.total) * 100)}%` : 'N/A'}
                    </span>
                  </div>
                  <Progress value={ram.total ? Math.round((ram.used / ram.total) * 100) : 0} />
                </div>
              )}
            </InfoCard>

            {/* Storage */}
            <InfoCard
              icon={HardDrive}
              title="Storage"
              subtitle={disks.length > 0 ? `${disks.length} drive(s)` : 'No drives detected'}
              iconBg="bg-sparkle-warning/10"
              iconColor="text-sparkle-warning"
            >
              <div className="space-y-3">
                {disks.length === 0 ? (
                  <p className="text-xs text-sparkle-text-muted">No disk info available</p>
                ) : (
                  disks.map((disk, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-sparkle-text-secondary">
                          {disk.drive} {disk.label && `(${disk.label})`}
                        </span>
                        <span className="text-sparkle-text font-medium">
                          {formatBytes(disk.free)} free / {formatBytes(disk.total)}
                        </span>
                      </div>
                      <Progress value={disk.total ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0} />
                    </div>
                  ))
                )}
              </div>
            </InfoCard>
          </div>

          {/* System Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-primary/10 text-sparkle-primary shrink-0">
                <Info size={18} />
              </div>
              <div className="flex-1">
                <CardTitle>System Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="text-[10px] font-semibold text-sparkle-text-muted uppercase tracking-[0.08em] mb-1">Hostname</div>
                  <div className="text-sm font-semibold text-sparkle-text">{hardware?.hostname || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="text-[10px] font-semibold text-sparkle-text-muted uppercase tracking-[0.08em] mb-1">OS</div>
                  <div className="text-sm font-semibold text-sparkle-text">{os.platform || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="text-[10px] font-semibold text-sparkle-text-muted uppercase tracking-[0.08em] mb-1">Architecture</div>
                  <div className="text-sm font-semibold text-sparkle-text">{os.arch || cpu.architecture || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="text-[10px] font-semibold text-sparkle-text-muted uppercase tracking-[0.08em] mb-1">Uptime</div>
                  <div className="text-sm font-semibold text-sparkle-text">{formatUptime(os.uptime)}</div>
                </div>
                <div className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="text-[10px] font-semibold text-sparkle-text-muted uppercase tracking-[0.08em] mb-1">Motherboard</div>
                  <div className="text-sm font-semibold text-sparkle-text">{hardware?.motherboard || 'N/A'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="text-[10px] font-semibold text-sparkle-text-muted uppercase tracking-[0.08em] mb-1">BIOS</div>
                  <div className="text-sm font-semibold text-sparkle-text">{hardware?.bios || 'N/A'}</div>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                  <FileText size={14} />
                  {exporting ? 'Exporting...' : 'Export System Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Processes */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="mb-0 pb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-primary/10 text-sparkle-primary shrink-0">
            <Cpu size={18} />
          </div>
          <div className="flex-1">
            <CardTitle>Running Processes</CardTitle>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchProcesses} disabled={procLoading}>
            <RefreshCw size={13} className={procLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </CardHeader>
        {procError && (
          <CardContent>
            <div className="notice-banner error">
              <AlertTriangle size={17} />{procError}
              <Button variant="outline" size="sm" onClick={fetchProcesses}>Retry</Button>
            </div>
          </CardContent>
        )}
        {procLoading ? (
          <CardContent>
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Loading processes...</span>
            </div>
          </CardContent>
        ) : processes.length === 0 ? (
          <CardContent>
            <div className="text-center py-10 text-sm text-sparkle-muted">No running processes found</div>
          </CardContent>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-4 px-6 py-2.5 text-[11px] font-semibold text-sparkle-muted uppercase tracking-wider bg-sparkle-accent/50">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">PID</div>
              <div className="col-span-2">CPU</div>
              <div className="col-span-2">Memory</div>
              <div className="col-span-2">Actions</div>
            </div>
            <div className="divide-y divide-sparkle-border max-h-[500px] overflow-auto">
              {processes.slice(0, 30).map((proc) => (
                <div
                  key={proc.pid}
                  className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-sparkle-accent/50 transition-all duration-200"
                >
                  <div className="col-span-4 text-sm font-medium text-sparkle-text truncate">{proc.name}</div>
                  <div className="col-span-2 text-xs text-sparkle-text-secondary font-mono">{proc.pid}</div>
                  <div className="col-span-2 text-xs text-sparkle-text-secondary">{proc.cpu != null ? `${proc.cpu}%` : 'N/A'}</div>
                  <div className="col-span-2 text-xs text-sparkle-text-secondary">{proc.mem != null ? `${proc.mem} MB` : 'N/A'}</div>
                  <div className="col-span-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleKillProcess(proc.pid)}
                      disabled={killing === proc.pid}
                    >
                      {killing === proc.pid ? (
                        <Loader size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={12} />
                      )}
                      End Task
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
