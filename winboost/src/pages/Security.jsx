import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock3, Download, ExternalLink,
  FileClock, FolderArchive, Loader, LockKeyhole, RefreshCw, ScanSearch,
  ShieldCheck, ShieldOff, ShieldAlert, Trash2, UserRoundCog, Zap,
  ChevronRight, ArrowUpRight, Check, X, Info, Database, Play, Square,
} from 'lucide-react'
import {
  createRestorePoint, getSafetyStatus, openWindowsSettings, listHistory,
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
          <linearGradient id="secRingGrad" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor={score >= 80 ? '#45e8ff' : score >= 50 ? '#f59e0b' : '#ef4444'} />
            <stop offset="50%" stopColor={score >= 80 ? '#7b7cff' : score >= 50 ? '#f97316' : '#dc2626'} />
            <stop offset="100%" stopColor={score >= 80 ? '#d059ff' : score >= 50 ? '#ef4444' : '#991b1b'} />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#1e293b" strokeWidth="7" />
        <circle
          cx="90" cy="90" r={radius} fill="none" stroke="url(#secRingGrad)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="health-ring-center-lg">
        {scanning ? <ScanSearch size={36} className="scan-pulse" /> : <ShieldCheck size={40} />}
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

  const scanRef = useRef(null)

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

  const stopScan = () => {
    setScanning(false)
    setScanResult({ threats: [], filesScanned: scanFiles, engine: 'cancelled' })
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

  return (
    <div className="anim-fade-up space-y-6 security-page">
      <div className="page-hero compact-hero">
        <div className="page-hero-icon security-hero">
          <ShieldCheck size={23} />
        </div>
        <div>
          <span className="eyebrow"><LockKeyhole size={12} /> Security Center</span>
          <h1>Security &amp; Protection</h1>
          <p>Malware scanning, system restore, and real-time security monitoring</p>
        </div>
        <button className="btn btn-secondary btn-sm hero-action" onClick={refreshAll} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {notice && (
        <div className={`notice-banner ${notice.type}`}>
          <span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <ShieldOff size={17} />}</span>
          {notice.text}
        </div>
      )}

      {loading && !safetyStatus ? (
        <div className="card loading-state"><Loader className="animate-spin" size={22} /><span>Loading security status...</span></div>
      ) : (
        <>
          {/* === Scan Section === */}
          <div className="card security-main-card">
            <div className="scan-layout">
              <HealthRing score={score} scanning={scanning} progress={scanProgress} />
              <div className="scan-controls">
                <h2>System Scan</h2>
                <p className="scan-subtitle">
                  {clamav?.found
                    ? `ClamAV ${clamav.version || 'detected'} — open-source antivirus engine`
                    : 'ClamAV not detected — Defender fallback available'}
                </p>

                <div className="scan-buttons">
                  <button className="btn btn-primary scan-btn-main" onClick={() => startScan('quick')} disabled={scanning}>
                    {scanning ? <Loader size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                    Quick Scan
                  </button>
                  <button className="btn btn-secondary scan-btn-alt" onClick={() => startScan('deep')} disabled={scanning}>
                    <ShieldAlert size={16} /> Deep Scan
                  </button>
                  {scanning && (
                    <button className="btn btn-danger scan-btn-stop" onClick={stopScan}>
                      <Square size={14} /> Stop
                    </button>
                  )}
                </div>

                {scanning && (
                  <div className="scan-progress-bar">
                    <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
                  </div>
                )}
                {scanning && (
                  <p className="scan-status-text">
                    {scanStage || 'Scanning...'} {scanFiles > 0 && `(${scanFiles.toLocaleString()} files)`}
                    {scanThreats > 0 && <span className="threat-count-badge">{scanThreats} threat{scanThreats !== 1 ? 's' : ''}</span>}
                  </p>
                )}

                {scanResult && !scanning && (
                  <div className={`scan-result-summary ${scanThreatsList.length > 0 ? 'has-threats' : 'clean'}`}>
                    {scanThreatsList.length === 0 ? (
                      <><CheckCircle2 size={18} /> No threats found in {scanResult.filesScanned?.toLocaleString() || '0'} files</>
                    ) : (
                      <><AlertTriangle size={18} /> {scanThreatsList.length} threat{scanThreatsList.length !== 1 ? 's' : ''} detected</>
                    )}
                    <small>Engine: {scanResult.engine || 'unknown'}</small>
                  </div>
                )}
                {scanError && !scanning && (
                  <div className="scan-result-summary error"><X size={16} /> {scanError}</div>
                )}
              </div>
            </div>
          </div>

          {/* === Threats List === */}
          {scanThreatsList.length > 0 && (
            <div className="card">
              <h3 className="card-section-title"><ShieldAlert size={17} /> Detected Threats</h3>
              <div className="threats-table">
                <div className="threats-header">
                  <span>Threat</span><span>Severity</span><span>Path</span>
                </div>
                {scanThreatsList.map((t, i) => (
                  <div key={i} className="threat-row">
                    <span className="threat-name">{t.name}</span>
                    <span className={`threat-severity severity-${(t.severity || '').toLowerCase()}`}>{t.severity || 'High'}</span>
                    <span className="threat-path">{t.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === ClamAV Status & Updates === */}
          <div className="card">
            <h3 className="card-section-title"><Database size={17} /> Antivirus Engine</h3>
            <div className="av-status-grid">
              <div className="av-status-item">
                <span className="av-label">ClamAV</span>
                <span className={`av-value ${clamav?.found ? 'text-green' : 'text-muted'}`}>
                  {clamav?.found ? (clamav.version ? `v${clamav.version}` : 'Installed') : 'Not installed'}
                </span>
                {!clamav?.found && (
                  <a href={clamav?.installUrl || 'https://www.clamav.net/downloads'} target="_blank" rel="noreferrer" className="av-action-link">
                    <Download size={12} /> Download ClamAV
                  </a>
                )}
              </div>
              <div className="av-status-item">
                <span className="av-label">Definitions</span>
                <span className={`av-value ${clamav?.definitionsVersion ? 'text-green' : 'text-muted'}`}>
                  {clamav?.definitionsVersion ? `${clamav.definitionsVersion} (${clamav.definitionsDate || 'N/A'})` : 'N/A'}
                </span>
                {clamav?.found && (
                  <button className="av-action-link" onClick={handleUpdateDefs} disabled={updatingDefs}>
                    {updatingDefs ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {updatingDefs ? `Updating... ${defUpdateProgress}%` : 'Update Definitions'}
                  </button>
                )}
              </div>
              <div className="av-status-item">
                <span className="av-label">Windows Defender</span>
                <span className={`av-value ${defender.available ? 'text-green' : 'text-muted'}`}>
                  {defender.available ? 'Active' : 'Unavailable'}
                </span>
                <button className="av-action-link" onClick={() => openWindowsSettings('security')}>
                  <ExternalLink size={12} /> Open Windows Security
                </button>
              </div>
            </div>
            {updatingDefs && defUpdateProgress > 0 && (
              <div className="def-update-progress">
                <div className="scan-progress-bar sm"><div className="scan-progress-fill" style={{ width: `${defUpdateProgress}%` }} /></div>
                <p>{defUpdateOutput || 'Updating definitions...'}</p>
              </div>
            )}
          </div>

          {/* === Safety & Recovery === */}
          <div className="card">
            <h3 className="card-section-title"><FolderArchive size={17} /> Safety &amp; Recovery</h3>
            <div className="safety-grid">
              <div className="safety-item">
                <div className="safety-icon restore-icon"><FolderArchive size={20} /></div>
                <div>
                  <strong>System Restore</strong>
                  <p>{safetyStatus?.restore?.enabled ? `${safetyStatus.restore.count} point${safetyStatus.restore.count !== 1 ? 's' : ''} available` : 'Not configured'}</p>
                  {safetyStatus?.restore?.lastCreated && <small>Last: {timeAgo(safetyStatus.restore.lastCreated)}</small>}
                </div>
                <div className="safety-actions">
                  <button className="btn btn-secondary btn-sm" onClick={createPoint} disabled={creatingRP}>
                    {creatingRP ? <Loader size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
                    {creatingRP ? 'Creating...' : 'Create Point'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openWindowsSettings('restore')}>
                    <ExternalLink size={12} /> Configure
                  </button>
                </div>
              </div>
              <div className="safety-item">
                <div className="safety-icon defender-icon"><ShieldCheck size={20} /></div>
                <div>
                  <strong>Windows Security</strong>
                  <p>{defender.available ? 'Defender is active' : 'Check Windows Security'}</p>
                </div>
                <div className="safety-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openWindowsSettings('security')}>
                    <ExternalLink size={12} /> Open
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* === Activity History === */}
          {history.length > 0 && (
            <div className="card">
              <h3 className="card-section-title"><FileClock size={17} /> Recent Activity</h3>
              <div className="history-list">
                {history.slice(0, 10).map((entry, i) => (
                  <div key={entry.id || i} className="history-row">
                    <span className={`history-dot ${entry.status === 'error' ? 'error' : 'success'}`} />
                    <span className="history-action">{entry.action}</span>
                    <span className="history-detail">{entry.detail}</span>
                    <span className="history-time"><Clock3 size={11} /> {timeAgo(entry.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
