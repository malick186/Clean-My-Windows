import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock3, Download, ExternalLink,
  FileClock, FolderArchive, Loader, LockKeyhole, RefreshCw, ScanSearch,
  ShieldCheck, ShieldOff, ShieldAlert, Trash2, X, Info, Database, Play, Square,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  createRestorePoint, getSafetyStatus, openWindowsSettings,
  detectClamAV, updateClamAV, scanWithClamAV,
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

function HealthRing({ score, scanning, progress }) {
  const value = scanning ? progress : score
  const radius = 72
  const circumference = 2 * Math.PI * radius

  return (
    <div className="health-ring-lg">
      <svg viewBox="0 0 180 180" role="img">
        <defs>
          <linearGradient id="secRing" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor={score >= 80 ? 'var(--accent-grad-start)' : score >= 50 ? '#f59e0b' : '#ef4444'} />
            <stop offset="50%" stopColor={score >= 80 ? 'var(--accent-grad-mid)' : score >= 50 ? '#f97316' : '#dc2626'} />
            <stop offset="100%" stopColor={score >= 80 ? 'var(--accent-grad-end)' : score >= 50 ? '#ef4444' : '#991b1b'} />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--surface-secondary)" strokeWidth="7" />
        <circle
          cx="90" cy="90" r={radius} fill="none" stroke="url(#secRing)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="health-ring-lg-center">
        {scanning ? <ScanSearch size={36} style={{ animation: 'scanPulse 1.5s ease-in-out infinite', color: 'var(--accent)' }} /> : <ShieldCheck size={40} />}
        <strong>{value}%</strong>
        <span>{scanning ? 'Scanning...' : score >= 80 ? 'Protected' : score >= 50 ? 'At Risk' : 'Vulnerable'}</span>
      </div>
    </div>
  )
}

export default function Security() {
  const [safetyStatus, setSafetyStatus] = useState(null)
  const [clamav, setClamav] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creatingRP, setCreatingRP] = useState(false)
  const [notice, setNotice] = useState(null)

  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStage, setScanStage] = useState('')
  const [scanFiles, setScanFiles] = useState(0)
  const [scanThreats, setScanThreats] = useState(0)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState(null)

  const [updatingDefs, setUpdatingDefs] = useState(false)
  const [defUpdateProgress, setDefUpdateProgress] = useState(0)
  const [defUpdateOutput, setDefUpdateOutput] = useState('')

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      const [safety, av] = await Promise.all([
        getSafetyStatus().catch(() => null),
        detectClamAV().catch(() => null),
      ])
      setSafetyStatus(safety)
      setClamav(av)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  const score = useMemo(() => {
    if (!safetyStatus) return 60
    let s = 70
    if (safetyStatus.defender?.available) s += 10
    if (clamav?.found) s += 10
    if (safetyStatus.restore?.enabled) s += 10
    if (safetyStatus.admin) s -= 5
    return Math.min(98, Math.max(30, s))
  }, [safetyStatus, clamav])

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
    setScanFiles(0); setScanThreats(0); setScanResult(null); setScanError(null)
    try {
      const result = await scanWithClamAV(scanType, (data) => {
        setScanProgress(data.percent || 0)
        setScanStage(data.stage || '')
        setScanFiles(data.filesScanned || 0)
        setScanThreats(data.threatsFound || 0)
      })
      setScanResult(result)
      setScanProgress(100)
    } catch (error) {
      setScanError(error.message)
    } finally {
      setScanning(false)
    }
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

  const defender = safetyStatus?.defender || {}
  const history = safetyStatus?.history || []
  const scanThreatsList = scanResult?.threats || []

  const severityVariant = {
    critical: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'teal',
  }

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-bg text-purple shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <LockKeyhole size={11} /> Security Center
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Security &amp; Protection</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Malware scanning, system restore, and real-time security monitoring</p>
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
          {notice.type === 'success' ? <CheckCircle2 size={17} /> : <ShieldOff size={17} />}
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
                <HealthRing score={score} scanning={scanning} progress={scanProgress} />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg mb-1">System Scan</CardTitle>
                  <CardDescription className="text-[12px] mb-4">
                    {clamav?.found
                      ? `ClamAV ${clamav.version || 'detected'} — open-source antivirus engine`
                      : 'ClamAV not detected — Defender fallback available'}
                  </CardDescription>

                  <div className="flex gap-2 flex-wrap mb-3">
                    <Button
                      variant="gradient"
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
                    {scanning && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setScanning(false)}
                        className="rounded-xl"
                      >
                        <Square size={14} className="mr-1.5" /> Stop
                      </Button>
                    )}
                  </div>

                  {scanning && (
                    <div className="scan-progress mb-2">
                      <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
                    </div>
                  )}
                  {scanning && (
                    <p className="flex items-center gap-2 text-[11px] text-text-secondary">
                      {scanStage || 'Scanning...'}
                      {scanFiles > 0 && <span>({scanFiles.toLocaleString()} files)</span>}
                      {scanThreats > 0 && <Badge variant="danger" className="text-[10px]">{scanThreats} threat{scanThreats !== 1 ? 's' : ''}</Badge>}
                    </p>
                  )}

                  {scanResult && !scanning && (
                    <Badge
                      variant={scanThreatsList.length > 0 ? 'danger' : 'success'}
                      className="flex items-center gap-2 mt-2 py-2 px-3 text-[13px] h-auto rounded-lg"
                    >
                      {scanThreatsList.length === 0
                        ? <><CheckCircle2 size={18} /> No threats found in {scanResult.filesScanned?.toLocaleString() || '0'} files</>
                        : <><AlertTriangle size={18} /> {scanThreatsList.length} threat{scanThreatsList.length !== 1 ? 's' : ''} detected</>
                      }
                      <small className="ml-auto text-[10px] opacity-70">Engine: {scanResult.engine || 'unknown'}</small>
                    </Badge>
                  )}
                  {scanError && !scanning && (
                    <div className="flex items-center gap-2 mt-2 py-2 px-3 rounded-lg bg-orange/8 text-orange text-[13px]">
                      <X size={16} /> {scanError}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Threats table */}
          {scanThreatsList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert size={18} /> Detected Threats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1 text-[12px]" style={{ gridTemplateColumns: '1fr 100px 1fr' }}>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider px-2 pb-2">Threat</div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider px-2 pb-2">Severity</div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider px-2 pb-2">Path</div>
                  {scanThreatsList.map((t, i) => (
                    <div key={i} className="contents">
                      <span className="px-2 py-2 font-semibold text-red-400 rounded-l-lg hover:bg-surface-secondary">{t.name}</span>
                      <span className={`severity-${(t.severity || 'high').toLowerCase()} px-2 py-2 hover:bg-surface-secondary`}>{t.severity || 'High'}</span>
                      <span className="px-2 py-2 text-text-tertiary font-mono text-[11px] truncate rounded-r-lg hover:bg-surface-secondary">{t.path}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AV Engine Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database size={18} /> Antivirus Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.03]">
                  <span className="text-[10px] text-text-tertiary uppercase tracking-wider">ClamAV</span>
                  <span className={`text-[14px] font-semibold ${clamav?.found ? 'text-green' : 'text-text-tertiary'}`}>
                    {clamav?.found ? (clamav.version ? `v${clamav.version}` : 'Installed') : 'Not installed'}
                  </span>
                  {!clamav?.found && (
                    <a href={clamav?.installUrl || 'https://www.clamav.net/downloads'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1">
                      <Download size={12} /> Download ClamAV
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.03]">
                  <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Definitions</span>
                  <span className={`text-[14px] font-semibold ${clamav?.definitionsVersion ? 'text-green' : 'text-text-tertiary'}`}>
                    {clamav?.definitionsVersion ? `${clamav.definitionsVersion} (${clamav.definitionsDate || 'N/A'})` : 'N/A'}
                  </span>
                  {clamav?.found && (
                    <button onClick={handleUpdateDefs} disabled={updatingDefs} className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1 disabled:opacity-50">
                      {updatingDefs ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {updatingDefs ? `Updating... ${defUpdateProgress}%` : 'Update Definitions'}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.03]">
                  <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Windows Defender</span>
                  <span className={`text-[14px] font-semibold ${defender.available ? 'text-green' : 'text-text-tertiary'}`}>
                    {defender.available ? 'Active' : 'Unavailable'}
                  </span>
                  <button onClick={() => openWindowsSettings('security')} className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1">
                    <ExternalLink size={12} /> Open Windows Security
                  </button>
                </div>
              </div>
              {updatingDefs && defUpdateProgress > 0 && (
                <div className="mt-4 p-4 rounded-2xl bg-surface-secondary/50">
                  <Progress value={defUpdateProgress} className="max-w-[300px] h-1.5" />
                  <p className="text-[11px] text-text-tertiary mt-2">{defUpdateOutput || 'Updating definitions...'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Safety & Recovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderArchive size={18} /> Safety &amp; Recovery
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-secondary/50 hover:bg-surface-hover transition-all duration-200 border border-white/[0.03]">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-bg text-purple flex-shrink-0">
                  <FolderArchive size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-[13px] text-text block">System Restore</strong>
                  <p className="text-[11px] text-text-tertiary">
                    {safetyStatus?.restore?.enabled ? `${safetyStatus.restore.count} point${safetyStatus.restore.count !== 1 ? 's' : ''} available` : 'Not configured'}
                  </p>
                  {safetyStatus?.restore?.lastCreated && <small className="text-[10px] text-text-tertiary">Last: {timeAgo(safetyStatus.restore.lastCreated)}</small>}
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
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-secondary/50 hover:bg-surface-hover transition-all duration-200 border border-white/[0.03]">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-bg text-green flex-shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="text-[13px] text-text block">Windows Security</strong>
                  <p className="text-[11px] text-text-tertiary">{defender.available ? 'Defender is active' : 'Check Windows Security'}</p>
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
                    <div key={entry.id || i} className="flex items-center gap-4 px-3 py-2 rounded-xl hover:bg-surface-secondary text-[12px] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.status === 'error' ? 'bg-red' : 'bg-green'}`} />
                      <span className="text-text-secondary font-semibold w-[90px] flex-shrink-0">{entry.action}</span>
                      <span className="text-text-tertiary flex-1 truncate">{entry.detail}</span>
                      <span className="text-text-tertiary text-[11px] flex items-center gap-1 flex-shrink-0">
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
