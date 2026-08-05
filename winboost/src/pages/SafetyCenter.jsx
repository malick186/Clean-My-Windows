import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck, CheckCircle2, Clock3, ExternalLink, FileClock, FolderArchive,
  Loader, LockKeyhole, RefreshCw, ShieldCheck, ShieldOff, UserRoundCog,
} from 'lucide-react'
import { createRestorePoint, getSafetyStatus, openWindowsSettings } from '../lib/api'

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

export default function SafetyCenter() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setStatus(await getSafetyStatus()) }
    catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createPoint = async () => {
    setCreating(true); setNotice(null)
    try {
      await createRestorePoint()
      setNotice({ type: 'success', text: 'Safety restore point created successfully.' })
      await refresh()
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setCreating(false) }
  }

  const defender = status?.defender || {}
  const history = status?.history || []

  return (
    <div className="anim-fade-up space-y-6 safety-page">
      <div className="page-hero compact-hero">
        <div className="page-hero-icon purple"><BadgeCheck size={23} /></div>
        <div><span className="eyebrow"><LockKeyhole size={12} /> Recovery &amp; verification</span><h1>Safety Center</h1><p>Protection status, restore points and an honest audit trail for every WinBoost action.</p></div>
        <button className="btn btn-secondary btn-sm hero-action" onClick={refresh} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <ShieldOff size={17} />}</span>{notice.text}</div>}

      {loading && !status ? (
        <div className="card loading-state"><Loader className="animate-spin" size={22} /><span>Verifying Windows safety services...</span></div>
      ) : (
        <>
          <div className="safety-score-grid">
            <div className="safety-status-card featured">
              <span className={`safety-icon ${defender.realTimeProtection ? 'ok' : 'warn'}`}>{defender.realTimeProtection ? <ShieldCheck size={24} /> : <ShieldOff size={24} />}</span>
              <div><small>Microsoft Defender</small><strong>{defender.realTimeProtection ? 'Real-time protection active' : 'Protection needs attention'}</strong><p>{defender.signatureUpdated ? `Signatures updated ${timeAgo(defender.signatureUpdated)}` : defender.error || 'Status could not be confirmed'}</p></div>
              <button onClick={() => openWindowsSettings('security')}><ExternalLink size={14} /> Windows Security</button>
            </div>
            <div className="safety-status-card">
              <span className="safety-icon cyan"><UserRoundCog size={22} /></span>
              <div><small>Execution level</small><strong>{status?.admin ? 'Administrator' : 'Standard user'}</strong><p>{status?.admin ? 'Elevated tools are available' : 'UAC appears only when a protected task needs it'}</p></div>
            </div>
            <div className="safety-status-card">
              <span className="safety-icon purple"><FileClock size={22} /></span>
              <div><small>System Restore</small><strong>{status?.restore?.enabled ? `${status.restore.count} restore point${status.restore.count === 1 ? '' : 's'}` : 'Protection status unavailable'}</strong><p>{status?.restore?.lastCreated ? `Latest ${timeAgo(status.restore.lastCreated)}` : 'Create one before advanced changes'}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-[1.05fr_.95fr] gap-5 safety-lower-grid">
            <section className="card safety-action-card">
              <div className="section-title"><div><span>Recovery guard</span><h2>Create a safety point</h2></div><FolderArchive size={21} /></div>
              <p>Windows can roll system settings back if an advanced maintenance or registry change causes a problem. Windows normally permits one checkpoint per day.</p>
              <button className="btn btn-primary" onClick={createPoint} disabled={creating}>{creating ? <Loader size={15} className="animate-spin" /> : <ShieldCheck size={15} />}{creating ? 'Waiting for administrator approval...' : 'Create Restore Point'}</button>
            </section>

            <section className="card operation-history-card">
              <div className="section-title"><div><span>Local audit trail</span><h2>Recent operations</h2></div><Clock3 size={20} /></div>
              <div className="operation-list">
                {history.length === 0 ? <div className="empty-compact">No operations recorded yet.</div> : history.slice(0, 6).map(item => (
                  <div key={item.id}><i className={item.status} /><p><strong>{item.action}</strong><span>{item.detail}</span></p><time>{timeAgo(item.at)}</time></div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
