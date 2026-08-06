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
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-bg text-purple">
            <BadgeCheck size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <LockKeyhole size={12} /> Recovery &amp; Verification
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Safety Center</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Protection status, restore points and an honest audit trail for every WinBoost action.</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-[8px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[12px] font-semibold disabled:opacity-50 transition-colors" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <ShieldOff size={17} />}</span>{notice.text}</div>}

      {loading && !status ? (
        <div className="loading-state"><Loader className="animate-spin" size={22} /><span>Verifying Windows safety services...</span></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 rounded-[14px] bg-surface border border-border p-5 flex items-center gap-4">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${defender.realTimeProtection ? 'bg-green-bg text-green' : 'bg-red-bg text-red'}`}>
                {defender.realTimeProtection ? <ShieldCheck size={24} /> : <ShieldOff size={24} />}
              </div>
              <div className="flex-1">
                <div className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider mb-0.5">Microsoft Defender</div>
                <div className="text-sm font-bold">{defender.realTimeProtection ? 'Real-time protection active' : 'Protection needs attention'}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{defender.signatureUpdated ? `Signatures updated ${timeAgo(defender.signatureUpdated)}` : defender.error || 'Status could not be confirmed'}</div>
              </div>
              <button onClick={() => openWindowsSettings('security')} className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-[8px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[12px] font-semibold transition-colors shrink-0">
                <ExternalLink size={14} /> Windows Security
              </button>
            </div>
            <div className="rounded-[14px] bg-surface border border-border p-5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-teal-bg text-teal mb-3">
                <UserRoundCog size={22} />
              </div>
              <div className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider mb-0.5">Execution level</div>
              <div className="text-sm font-bold">{status?.admin ? 'Administrator' : 'Standard user'}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{status?.admin ? 'Elevated tools are available' : 'UAC appears only when a protected task needs it'}</div>
            </div>
            <div className="rounded-[14px] bg-surface border border-border p-5 col-start-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-bg text-purple mb-3">
                <FileClock size={22} />
              </div>
              <div className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider mb-0.5">System Restore</div>
              <div className="text-sm font-bold">{status?.restore?.enabled ? `${status.restore.count} restore point${status.restore.count === 1 ? '' : 's'}` : 'Protection status unavailable'}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{status?.restore?.lastCreated ? `Latest ${timeAgo(status.restore.lastCreated)}` : 'Create one before advanced changes'}</div>
            </div>
          </div>

          <div className="grid grid-cols-[1.05fr_.95fr] gap-5">
            <section className="rounded-[14px] bg-surface border border-border p-5">
              <h3 className="flex items-center justify-between text-[14px] font-semibold mb-3.5 pb-2.5 border-b border-border">
                <div>
                  <span className="block text-[10px] text-text-tertiary font-normal tracking-wider uppercase mb-0.5">Recovery guard</span>
                  Create a safety point
                </div>
                <FolderArchive size={21} className="text-text-tertiary" />
              </h3>
              <p className="text-xs text-text-secondary mb-4">Windows can roll system settings back if an advanced maintenance or registry change causes a problem. Windows normally permits one checkpoint per day.</p>
              <button className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-accent text-black font-semibold text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity" onClick={createPoint} disabled={creating}>
                {creating ? <Loader size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                {creating ? 'Waiting for administrator approval...' : 'Create Restore Point'}
              </button>
            </section>

            <section className="rounded-[14px] bg-surface border border-border p-5">
              <h3 className="flex items-center justify-between text-[14px] font-semibold mb-3.5 pb-2.5 border-b border-border">
                <div>
                  <span className="block text-[10px] text-text-tertiary font-normal tracking-wider uppercase mb-0.5">Local audit trail</span>
                  Recent operations
                </div>
                <Clock3 size={20} className="text-text-tertiary" />
              </h3>
              <div className="space-y-1">
                {history.length === 0 ? <div className="text-center py-6 text-xs text-text-tertiary">No operations recorded yet.</div> : history.slice(0, 6).map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-[8px] hover:bg-surface-secondary transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'success' ? 'bg-green' : item.status === 'error' ? 'bg-red' : item.status === 'info' ? 'bg-accent' : 'bg-text-tertiary'}`} />
                    <div className="flex-1 min-w-0">
                      <strong className="text-[12px] text-text block">{item.action}</strong>
                      <span className="text-[11px] text-text-tertiary">{item.detail}</span>
                    </div>
                    <time className="text-[10px] text-text-tertiary shrink-0">{timeAgo(item.at)}</time>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
