import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock3, Download, ExternalLink,
  FileClock, FolderArchive, Loader, LockKeyhole, RefreshCw, ScanSearch,
  ShieldCheck, ShieldOff, ShieldAlert, X, Database, Square,
  Trash2, RotateCcw, PackageOpen, HardDrive, Cpu, Zap,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  createRestorePoint, getSafetyStatus, openWindowsSettings,
  detectClamAV, updateClamAV, scanWithClamAV, installClamAV,
  stopClamAVScan, quarantineThreats, listQuarantine,
  restoreFromQuarantine, deleteQuarantined, getProtectionStatus,
  getScanHistory,
  detectDefender, scanWithDefender, stopDefenderScan,
  dualScan, stopSecurityScan,
} from '../lib/api'

function timeAgo(value) {
  if (!value) return 'Not available'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return 'Not available'
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}

function HealthRing({ score, scanning, progress, engine }) {
  const value = scanning ? progress : score
  const radius = 72
  const circumference = 2 * Math.PI * radius

  return (
    <div className="health-ring-lg">
      <svg viewBox="0 0 180 180" role="img">
        <defs>
          <linearGradient id="secRing" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor={score >= 80 ? '#6366f1' : score >= 50 ? '#f59e0b' : 'var(--sp-danger)'} />
            <stop offset="50%" stopColor={score >= 80 ? '#7c3aed' : score >= 50 ? '#f97316' : '#dc2626'} />
            <stop offset="100%" stopColor={score >= 80 ? 'var(--sp-purple)' : score >= 50 ? '#ef4444' : '#991b1b'} />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--sp-accent)" strokeWidth="7" />
        <circle
          cx="90" cy="90" r={radius} fill="none" stroke="url(#secRing)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="health-ring-lg-center">
        {scanning ? <ScanSearch size={36} style={{ animation: 'scanPulse 1.5s ease-in-out infinite', color: 'var(--sp-primary)' }} /> : <ShieldCheck size={40} />}
        <strong>{value}%</strong>
        <span>{scanning ? `${engine} scanning...` : score >= 80 ? 'Protected' : score >= 50 ? 'At Risk' : 'Vulnerable'}</span>
      </div>
    </div>
  )
}

export default function Security() {
  const [safetyStatus, setSafetyStatus] = useState(null)
  const [clamav, setClamav] = useState(null)
  const [defender, setDefender] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creatingRP, setCreatingRP] = useState(false)
  const [notice, setNotice] = useState(null)

  const [scanMode, setScanMode] = useState('dual')
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStage, setScanStage] = useState('')
  const [scanEngine, setScanEngine] = useState('')
  const [scanFiles, setScanFiles] = useState(0)
  const [scanThreats, setScanThreats] = useState(0)
  const [scanResult, setScanResult] = useState(null)

  const [updatingDefs, setUpdatingDefs] = useState(false)
  const [defUpdateProgress, setDefUpdateProgress] = useState(0)
  const [defUpdateOutput, setDefUpdateOutput] = useState('')

  const [installingAv, setInstallingAv] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [installOutput, setInstallOutput] = useState('')

  const [quarantineItems, setQuarantineItems] = useState([])
  const [quarantineLoading, setQuarantineLoading] = useState(false)
  const [quarantining, setQuarantining] = useState(false)
  const [scanHistory, setScanHistory] = useState([])
  const [protectionStatus, setProtectionStatus] = useState(null)

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      const [safety, av, df, quarantine, history, pStatus] = await Promise.all([
        getSafetyStatus().catch(() => null),
        detectClamAV().catch(() => null),
        detectDefender().catch(() => ({ available: false })),
        listQuarantine().catch(() => ({ items: [] })),
        getScanHistory().catch(() => ({ history: [] })),
        getProtectionStatus().catch(() => null),
      ])
      setSafetyStatus(safety)
      setClamav(av)
      setDefender(df)
      setQuarantineItems(quarantine?.items || [])
      setScanHistory(history?.history || [])
      setProtectionStatus(pStatus)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  const score = useMemo(() => {
    if (!safetyStatus) return 60
    let s = 65
    if (defender?.available) s += 12
    if (clamav?.found) s += 10
    if (safetyStatus.restore?.enabled) s += 8
    if (safetyStatus.admin) s -= 5
    return Math.min(98, Math.max(25, s))
  }, [safetyStatus, defender, clamav])

  const createPoint = async () => {
    setCreatingRP(true); setNotice(null)
    try {
      await createRestorePoint()
      setNotice({ type: 'success', text: 'Restore point created.' })
      await refreshAll()
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setCreatingRP(false) }
  }

  const startScan = async (scanType) => {
    setScanning(true); setScanProgress(0); setScanStage('Initializing...')
    setScanFiles(0); setScanThreats(0); setScanResult(null)
    try {
      let result
      if (scanMode === 'dual') {
        result = await dualScan(scanType, (data) => {
          setScanProgress(data.percent || 0)
          setScanStage(data.stage || '')
          setScanEngine(data.engine || '')
          setScanThreats(data.threatsFound || 0)
          if (data.filesScanned > 0) setScanFiles(data.filesScanned)
        })
      } else if (scanMode === 'defender') {
        result = await scanWithDefender(scanType, (data) => {
          setScanProgress(data.percent || 0)
          setScanStage(data.stage || '')
          setScanEngine('defender')
          setScanThreats(data.threatsFound || 0)
        })
      } else {
        result = await scanWithClamAV(scanType, (data) => {
          setScanProgress(data.percent || 0)
          setScanStage(data.stage || '')
          setScanEngine('clamav')
          setScanFiles(data.filesScanned || 0)
          setScanThreats(data.threatsFound || 0)
        })
      }
      setScanResult(result)
      setScanProgress(100)
      const tCount = result?.threats?.length || 0
      if (tCount === 0 && !result?.errors?.length) {
        const engines = result?.engines?.join(' + ') || scanMode
        setNotice({ type: 'success', text: `${engines} scan complete. No threats found.` })
      } else if (result?.errors?.length) {
        setNotice({ type: 'error', text: result.errors.map(e => `${e.engine}: ${e.error}`).join('. ') })
      }
      await refreshAll()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setScanning(false)
    }
  }

  const stopScan = async () => {
    try {
      if (scanMode === 'defender') await stopDefenderScan()
      else if (scanMode === 'clamav') await stopClamAVScan()
      else await stopSecurityScan()
      setScanning(false)
      setScanStage('Scan stopped')
    } catch {}
  }

  const handleUpdateDefs = async () => {
    setUpdatingDefs(true); setDefUpdateProgress(0); setDefUpdateOutput('')
    try {
      const result = await updateClamAV((data) => {
        setDefUpdateProgress(data.percent || 0)
        setDefUpdateOutput(data.output || '')
      })
      if (result.success) {
        setNotice({ type: 'success', text: result.message || 'Definitions updated.' })
        await refreshAll()
      } else {
        setNotice({ type: 'error', text: result.error || 'Update failed.' })
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setUpdatingDefs(false)
    }
  }

  const handleInstallClamAV = async () => {
    setInstallingAv(true); setInstallProgress(0); setInstallOutput('Preparing...')
    try {
      const result = await installClamAV((data) => {
        setInstallProgress(data.percent || 0)
        setInstallOutput(data.output || '')
      })
      if (result.success) {
        setNotice({ type: 'success', text: result.message || 'ClamAV installed successfully.' })
        await refreshAll()
      } else {
        setNotice({ type: 'error', text: result.error || 'Installation failed.' })
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setInstallingAv(false)
    }
  }

  const handleQuarantine = async () => {
    if (!scanResult?.threats?.length) return
    setQuarantining(true)
    try {
      const result = await quarantineThreats(scanResult.threats)
      if (result.success) {
        setNotice({ type: 'success', text: `${result.quarantined} threat${result.quarantined !== 1 ? 's' : ''} quarantined.` })
        setScanResult(null)
        await refreshAll()
      } else {
        setNotice({ type: 'error', text: result.error || 'Quarantine failed.' })
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setQuarantining(false)
    }
  }

  const handleRestore = async (quarantineFile) => {
    try {
      const result = await restoreFromQuarantine(quarantineFile)
      if (result.success) {
        setNotice({ type: 'success', text: `File restored to ${result.restoredTo}` })
        await refreshAll()
      } else {
        setNotice({ type: 'error', text: result.error || 'Restore failed.' })
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const handleDeleteQuarantined = async (quarantineFile) => {
    try {
      const result = await deleteQuarantined(quarantineFile)
      if (result.success) {
        setNotice({ type: 'success', text: 'File permanently deleted.' })
        await refreshAll()
      } else {
        setNotice({ type: 'error', text: result.error || 'Delete failed.' })
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const loadQuarantine = async () => {
    setQuarantineLoading(true)
    try {
      const result = await listQuarantine()
      setQuarantineItems(result?.items || [])
    } finally {
      setQuarantineLoading(false)
    }
  }

  function severityBadge(severity) {
    const s = (severity || 'high').toLowerCase()
    if (s === 'critical') return <Badge variant="danger">Critical</Badge>
    if (s === 'high') return <Badge variant="danger">High</Badge>
    if (s === 'medium') return <Badge variant="warning">Medium</Badge>
    return <Badge variant="teal">Low</Badge>
  }

  function engineBadge(engine) {
    if (engine === 'defender') return <Badge variant="teal" className="text-[10px]"><ShieldCheck size={10} className="mr-1" />Defender</Badge>
    if (engine === 'clamav') return <Badge variant="purple" className="text-[10px]"><Database size={10} className="mr-1" />ClamAV</Badge>
    return null
  }

  const defenderStatus = safetyStatus?.defender || {}
  const history = safetyStatus?.history || []
  const scanThreatsList = scanResult?.threats || []
  const scanErrors = scanResult?.errors || []

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-purple/10 text-sparkle-purple">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <LockKeyhole size={11} /> Security Center
            </div>
            <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight">Security &amp; Protection</h1>
            <p className="text-[13px] text-sparkle-text-muted mt-1.5 leading-relaxed">Dual-engine malware scanning with Windows Defender + ClamAV</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refreshAll}
          disabled={loading}
          className="rounded-xl"
        >
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''} mr-1.5`} /> Refresh
        </Button>
      </div>

      {notice && (
        <div className={`notice-banner ${notice.type}`}>
          {notice.type === 'success' ? <CheckCircle2 size={17} /> : notice.type === 'error' ? <ShieldOff size={17} /> : <AlertTriangle size={17} />}
          {notice.text}
        </div>
      )}

      {loading && !safetyStatus ? (
        <div className="loading-state"><Loader className="animate-spin" size={22} /><span>Loading security status...</span></div>
      ) : (
        <>
          {/* Scan card */}
          <Card>
            <CardContent className="!p-7">
              <div className="flex items-center gap-10">
                <HealthRing score={score} scanning={scanning} progress={scanProgress} engine={scanEngine} />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg mb-1">System Scan</CardTitle>
                  <CardDescription className="text-[12px] mb-1">
                    {defender?.available ? 'Defender detected' : 'Defender unavailable'} &middot; {clamav?.found ? `ClamAV ${clamav.version || 'detected'}` : 'ClamAV not installed'}
                  </CardDescription>

                  {/* Engine selector */}
                  <div className="flex items-center gap-1.5 mb-4 p-1 rounded-xl bg-sparkle-accent/50 w-fit">
                    {[
                      { key: 'dual', label: 'Dual Engine', icon: Zap },
                      { key: 'defender', label: 'Defender', icon: ShieldCheck },
                      { key: 'clamav', label: 'ClamAV', icon: Database },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        disabled={scanning || (key === 'clamav' && !clamav?.found)}
                        onClick={() => setScanMode(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          scanMode === key
                            ? 'bg-sparkle-primary text-white shadow-sm'
                            : 'text-sparkle-text-muted hover:text-sparkle-text hover:bg-sparkle-accent'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 flex-wrap mb-3">
                    {scanMode !== 'clamav' || clamav?.found ? (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => startScan('quick')}
                          disabled={scanning}
                          className="rounded-xl"
                        >
                          {scanning ? <Loader size={16} className="animate-spin mr-1.5" /> : <ScanSearch size={16} className="mr-1.5" />}
                          Quick Scan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startScan('deep')}
                          disabled={scanning}
                          className="rounded-xl"
                        >
                          <ShieldAlert size={16} className="mr-1.5" /> Deep Scan
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleInstallClamAV}
                        disabled={installingAv}
                        className="rounded-xl"
                      >
                        {installingAv ? <Loader size={16} className="animate-spin mr-1.5" /> : <Download size={16} className="mr-1.5" />}
                        {installingAv ? `Installing... ${installProgress}%` : 'Install ClamAV'}
                      </Button>
                    )}
                    {scanning && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={stopScan}
                        className="rounded-xl"
                      >
                        <Square size={14} className="mr-1.5" /> Stop
                      </Button>
                    )}
                  </div>

                  {(scanning || installingAv) && (
                    <div className="scan-progress mb-2">
                      <div className="scan-progress-fill" style={{ width: `${installingAv ? installProgress : scanProgress}%` }} />
                    </div>
                  )}
                  {installingAv && (
                    <p className="flex items-center gap-2 text-[11px] text-sparkle-text-secondary">
                      <Loader size={12} className="animate-spin" /> {installOutput || 'Installing ClamAV...'}
                    </p>
                  )}
                  {scanning && (
                    <div className="flex items-center gap-2 text-[11px] text-sparkle-text-secondary">
                      {scanEngine && engineBadge(scanEngine)}
                      <span>{scanStage || 'Scanning...'}</span>
                      {scanFiles > 0 && <span>({scanFiles.toLocaleString()} files)</span>}
                      {scanThreats > 0 && <Badge variant="danger" className="text-[10px]">{scanThreats} threat{scanThreats !== 1 ? 's' : ''}</Badge>}
                    </div>
                  )}

                  {scanResult && !scanning && (
                    <div className="mt-2 space-y-2">
                      {scanErrors.length > 0 && (
                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-sparkle-warning/10 text-sparkle-warning text-[12px]">
                          <AlertTriangle size={14} /> {scanErrors.map(e => `${e.engine}: ${e.error}`).join('. ')}
                        </div>
                      )}
                      {scanThreatsList.length > 0 && (
                        <Badge
                          variant="danger"
                          className="flex items-center gap-2 py-2 px-3 text-[13px] h-auto rounded-lg"
                        >
                          <AlertTriangle size={18} /> {scanThreatsList.length} threat{scanThreatsList.length !== 1 ? 's' : ''} detected by {scanResult.engines?.join(' + ') || scanMode}
                        </Badge>
                      )}
                      {scanThreatsList.length === 0 && scanErrors.length === 0 && (
                        <Badge
                          variant="success"
                          className="flex items-center gap-2 py-2 px-3 text-[13px] h-auto rounded-lg"
                        >
                          <CheckCircle2 size={18} /> No threats found
                          <small className="ml-auto text-[10px] opacity-70">{scanResult.engines?.join(' + ') || scanMode}</small>
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engine Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap size={18} /> Antivirus Engines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Defender */}
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${defender?.available ? 'bg-sparkle-success/10 text-sparkle-success' : 'bg-sparkle-text-muted/10 text-sparkle-text-muted'}`}>
                      <ShieldCheck size={15} />
                    </div>
                    <span className="text-[10px] text-sparkle-text-muted uppercase tracking-wider">Windows Defender</span>
                  </div>
                  <span className={`text-[14px] font-semibold ${defender?.available ? 'text-sparkle-success' : 'text-sparkle-text-muted'}`}>
                    {defender?.available ? 'Active' : 'Unavailable'}
                  </span>
                  <button onClick={() => openWindowsSettings('security')} className="inline-flex items-center gap-1 text-[11px] text-sparkle-primary hover:underline mt-1">
                    <ExternalLink size={12} /> Open Windows Security
                  </button>
                </div>

                {/* ClamAV */}
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${clamav?.found ? 'bg-sparkle-purple/10 text-sparkle-purple' : 'bg-sparkle-text-muted/10 text-sparkle-text-muted'}`}>
                      <Database size={15} />
                    </div>
                    <span className="text-[10px] text-sparkle-text-muted uppercase tracking-wider">ClamAV</span>
                  </div>
                  <span className={`text-[14px] font-semibold ${clamav?.found ? 'text-sparkle-purple' : 'text-sparkle-text-muted'}`}>
                    {clamav?.found ? (clamav.version ? `v${clamav.version}` : 'Installed') : 'Not installed'}
                  </span>
                  {clamav?.found ? (
                    <button onClick={handleUpdateDefs} disabled={updatingDefs} className="inline-flex items-center gap-1 text-[11px] text-sparkle-primary hover:underline mt-1 disabled:opacity-50">
                      {updatingDefs ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {updatingDefs ? `Updating... ${defUpdateProgress}%` : 'Update Definitions'}
                    </button>
                  ) : !installingAv && (
                    <button onClick={handleInstallClamAV} className="inline-flex items-center gap-1 text-[11px] text-sparkle-primary hover:underline mt-1">
                      <Download size={12} /> Install Automatically
                    </button>
                  )}
                  {updatingDefs && defUpdateProgress > 0 && (
                    <div className="mt-2">
                      <Progress value={defUpdateProgress} className="max-w-[200px] h-1" />
                      <p className="text-[10px] text-sparkle-text-muted mt-1">{defUpdateOutput || 'Updating...'}</p>
                    </div>
                  )}
                </div>

                {/* Definitions */}
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sparkle-primary/10 text-sparkle-primary">
                      <HardDrive size={15} />
                    </div>
                    <span className="text-[10px] text-sparkle-text-muted uppercase tracking-wider">Status</span>
                  </div>
                  <span className={`text-[14px] font-semibold ${protectionStatus?.defenderRealtime ? 'text-sparkle-success' : 'text-sparkle-warning'}`}>
                    {protectionStatus?.defenderRealtime ? 'Protected' : 'Check'}
                  </span>
                  {protectionStatus?.lastScan && (
                    <span className="text-[10px] text-sparkle-text-muted">
                      Last scan: {timeAgo(protectionStatus.lastScan.date)}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Threats table */}
          {scanThreatsList.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert size={18} /> Detected Threats
                  </CardTitle>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleQuarantine}
                    disabled={quarantining}
                    className="rounded-xl"
                  >
                    {quarantining ? <Loader size={14} className="animate-spin mr-1.5" /> : <PackageOpen size={14} className="mr-1.5" />}
                    Quarantine All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1 text-[12px]" style={{ gridTemplateColumns: '1fr auto auto 1fr' }}>
                  <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Threat</div>
                  <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Engine</div>
                  <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Severity</div>
                  <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Location</div>
                  {scanThreatsList.map((t, i) => (
                    <div key={i} className="contents">
                      <span className="px-2 py-2 font-semibold text-sparkle-danger rounded-l-lg hover:bg-sparkle-accent">{t.name}</span>
                      <span className="px-2 py-2 hover:bg-sparkle-accent">{engineBadge(t.engine)}</span>
                      <span className="px-2 py-2 hover:bg-sparkle-accent">{severityBadge(t.severity)}</span>
                      <span className="px-2 py-2 text-sparkle-text-muted font-mono text-[11px] truncate rounded-r-lg hover:bg-sparkle-accent" title={t.path}>{t.pathShort || t.path}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Protection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive size={18} /> Real-time Protection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${protectionStatus?.defenderRealtime ? 'bg-sparkle-success/10 text-sparkle-success' : 'bg-sparkle-warning/10 text-sparkle-warning'}`}>
                    {protectionStatus?.defenderRealtime ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                  </div>
                  <div>
                    <strong className="text-[13px] text-sparkle-text block">Realtime Protection</strong>
                    <span className={`text-[11px] ${protectionStatus?.defenderRealtime ? 'text-sparkle-success' : 'text-sparkle-warning'}`}>
                      {protectionStatus?.defenderRealtime ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${protectionStatus?.defenderAntivirus ? 'bg-sparkle-success/10 text-sparkle-success' : 'bg-sparkle-warning/10 text-sparkle-warning'}`}>
                    {protectionStatus?.defenderAntivirus ? <BadgeCheck size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div>
                    <strong className="text-[13px] text-sparkle-text block">Antivirus Engine</strong>
                    <span className={`text-[11px] ${protectionStatus?.defenderAntivirus ? 'text-sparkle-success' : 'text-sparkle-warning'}`}>
                      {protectionStatus?.defenderAntivirus ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${protectionStatus?.firewall ? 'bg-sparkle-success/10 text-sparkle-success' : 'bg-sparkle-warning/10 text-sparkle-warning'}`}>
                    {protectionStatus?.firewall ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                  </div>
                  <div>
                    <strong className="text-[13px] text-sparkle-text block">Firewall</strong>
                    <span className={`text-[11px] ${protectionStatus?.firewall ? 'text-sparkle-success' : 'text-sparkle-warning'}`}>
                      {protectionStatus?.firewall ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quarantine */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageOpen size={18} /> Quarantine
                </CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadQuarantine}
                  disabled={quarantineLoading}
                  className="rounded-xl"
                >
                  <RefreshCw size={14} className={`${quarantineLoading ? 'animate-spin' : ''} mr-1.5`} /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {quarantineItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-sparkle-text-muted">
                  <PackageOpen size={36} className="mb-2 opacity-40" />
                  <p className="text-[13px]">No quarantined items</p>
                  <p className="text-[11px]">Detected threats can be quarantined here for safe review</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="grid gap-1 text-[12px]" style={{ gridTemplateColumns: '1fr auto 1fr auto' }}>
                    <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Threat</div>
                    <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Severity</div>
                    <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Date</div>
                    <div className="text-[10px] text-sparkle-text-muted uppercase tracking-wider px-2 pb-2">Actions</div>
                    {quarantineItems.slice(0, 20).map((item, i) => (
                      <div key={i} className="contents">
                        <span className="px-2 py-2.5 text-sparkle-text-secondary text-[12px] font-medium rounded-l-lg hover:bg-sparkle-accent truncate" title={item.originalPath}>
                          {item.threatName || item.quarantineFile}
                        </span>
                        <span className="px-2 py-2.5 hover:bg-sparkle-accent">{severityBadge(item.severity || 'Medium')}</span>
                        <span className="px-2 py-2.5 text-[11px] text-sparkle-text-muted hover:bg-sparkle-accent">{timeAgo(item.quarantinedAt)}</span>
                        <span className="px-2 py-2.5 flex items-center gap-1 rounded-r-lg hover:bg-sparkle-accent">
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(item.quarantineFile)} className="h-7 px-2 text-[11px] rounded-lg">
                            <RotateCcw size={12} className="mr-1" /> Restore
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteQuarantined(item.quarantineFile)} className="h-7 px-2 text-[11px] rounded-lg text-sparkle-danger hover:text-sparkle-danger">
                            <Trash2 size={12} className="mr-1" /> Delete
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileClock size={18} /> Scan History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
                  {scanHistory.map((entry, i) => (
                    <div key={entry.id || i} className="flex items-center gap-4 px-3 py-2 rounded-xl hover:bg-sparkle-accent text-[12px] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.status === 'success' ? 'bg-sparkle-success' : 'bg-sparkle-danger'}`} />
                      <span className="text-sparkle-text-secondary font-semibold flex-1">{entry.detail}</span>
                      <span className="text-sparkle-text-muted text-[11px] flex items-center gap-1 flex-shrink-0">
                        <Clock3 size={11} /> {timeAgo(entry.at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Safety & Recovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderArchive size={18} /> Safety &amp; Recovery
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border border-sparkle-border">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-purple/10 text-sparkle-purple flex-shrink-0">
                  <FolderArchive size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-[13px] text-sparkle-text block">System Restore</strong>
                  <p className="text-[11px] text-sparkle-text-muted">
                    {safetyStatus?.restore?.enabled ? `${safetyStatus.restore.count} point${safetyStatus.restore.count !== 1 ? 's' : ''} available` : 'Not configured'}
                  </p>
                  {safetyStatus?.restore?.lastCreated && <small className="text-[10px] text-sparkle-text-muted">Last: {timeAgo(safetyStatus.restore.lastCreated)}</small>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={createPoint}
                    disabled={creatingRP}
                    className="rounded-lg"
                  >
                    {creatingRP ? <Loader size={14} className="animate-spin mr-1.5" /> : <BadgeCheck size={14} className="mr-1.5" />}
                    {creatingRP ? 'Creating...' : 'Create Point'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openWindowsSettings('restore')}
                    className="rounded-lg"
                  >
                    <ExternalLink size={13} className="mr-1" /> Configure
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border border-sparkle-border">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-success/10 text-sparkle-success flex-shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-[13px] text-sparkle-text block">Windows Security</strong>
                  <p className="text-[11px] text-sparkle-text-muted">{defenderStatus.available ? 'Defender is active' : 'Check Windows Security'}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openWindowsSettings('security')}
                  className="rounded-lg flex-shrink-0"
                >
                  <ExternalLink size={13} className="mr-1" /> Open
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileClock size={18} /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
                  {history.slice(0, 10).map((entry, i) => (
                    <div key={entry.id || i} className="flex items-center gap-4 px-3 py-2 rounded-xl hover:bg-sparkle-accent text-[12px] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.status === 'error' ? 'bg-sparkle-danger' : 'bg-sparkle-success'}`} />
                      <span className="text-sparkle-text-secondary font-semibold w-[90px] flex-shrink-0">{entry.action}</span>
                      <span className="text-sparkle-text-muted flex-1 truncate">{entry.detail}</span>
                      <span className="text-sparkle-text-muted text-[11px] flex items-center gap-1 flex-shrink-0">
                        <Clock3 size={11} /> {timeAgo(entry.at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
