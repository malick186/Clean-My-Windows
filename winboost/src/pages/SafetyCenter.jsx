import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck, CheckCircle2, Clock3, ExternalLink, FileClock, FolderArchive,
  Loader, LockKeyhole, RefreshCw, ShieldCheck, ShieldOff, UserRoundCog,
} from 'lucide-react'
import { createRestorePoint, getSafetyStatus, openWindowsSettings } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl sparkle-purple/10 sparkle-purple shadow-sm">
            <BadgeCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold sparkle-primary uppercase tracking-[0.15em] mb-2">
              <LockKeyhole size={11} /> Recovery &amp; Verification
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Safety Center</h1>
            <p className="text-[13px] sparkle-text-muted mt-1.5 leading-relaxed">Protection status, restore points and an honest audit trail for every WinBoost action.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <ShieldOff size={17} />}</span>{notice.text}</div>}

      {loading && !status ? (
        <div className="loading-state"><Loader className="animate-spin" size={22} /><span>Verifying Windows safety services...</span></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2 flex flex-row items-center gap-4">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${defender.realTimeProtection ? 'sparkle-success/10 sparkle-success' : 'sparkle-danger/10 sparkle-danger'}`}>
                {defender.realTimeProtection ? <ShieldCheck size={24} /> : <ShieldOff size={24} />}
              </div>
              <div className="flex-1">
                <div className="text-[11px] sparkle-text-muted font-semibold uppercase tracking-wider mb-0.5">Microsoft Defender</div>
                <div className="text-sm font-bold">{defender.realTimeProtection ? 'Real-time protection active' : 'Protection needs attention'}</div>
                <div className="text-xs sparkle-text-muted mt-0.5">{defender.signatureUpdated ? `Signatures updated ${timeAgo(defender.signatureUpdated)}` : defender.error || 'Status could not be confirmed'}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => openWindowsSettings('security')} className="shrink-0">
                <ExternalLink size={14} /> Windows Security
              </Button>
            </Card>
            <Card>
              <CardContent>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl sparkle-teal/10 sparkle-teal mb-3">
                  <UserRoundCog size={22} />
                </div>
                <div className="text-[11px] sparkle-text-muted font-semibold uppercase tracking-wider mb-0.5">Execution level</div>
                <div className="text-sm font-bold">{status?.admin ? 'Administrator' : 'Standard user'}</div>
                <div className="text-xs sparkle-text-muted mt-0.5">{status?.admin ? 'Elevated tools are available' : 'UAC appears only when a protected task needs it'}</div>
              </CardContent>
            </Card>
            <Card className="col-start-3">
              <CardContent>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl sparkle-purple/10 sparkle-purple mb-3">
                  <FileClock size={22} />
                </div>
                <div className="text-[11px] sparkle-text-muted font-semibold uppercase tracking-wider mb-0.5">System Restore</div>
                <div className="text-sm font-bold">{status?.restore?.enabled ? `${status.restore.count} restore point${status.restore.count === 1 ? '' : 's'}` : 'Protection status unavailable'}</div>
                <div className="text-xs sparkle-text-muted mt-0.5">{status?.restore?.lastCreated ? `Latest ${timeAgo(status.restore.lastCreated)}` : 'Create one before advanced changes'}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-[1.05fr_.95fr] gap-5">
            <Card>
              <CardHeader>
                <div>
                  <span className="block text-[10px] sparkle-text-muted font-normal tracking-wider uppercase mb-0.5">Recovery guard</span>
                  <CardTitle>Create a safety point</CardTitle>
                </div>
                <FolderArchive size={21} className="sparkle-text-muted ml-auto" />
              </CardHeader>
              <CardContent>
                <p className="text-xs sparkle-text-secondary mb-4">Windows can roll system settings back if an advanced maintenance or registry change causes a problem. Windows normally permits one checkpoint per day.</p>
                <Button onClick={createPoint} disabled={creating}>
                  {creating ? <Loader size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {creating ? 'Waiting for administrator approval...' : 'Create Restore Point'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <span className="block text-[10px] sparkle-text-muted font-normal tracking-wider uppercase mb-0.5">Local audit trail</span>
                  <CardTitle>Recent operations</CardTitle>
                </div>
                <Clock3 size={20} className="sparkle-text-muted ml-auto" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {history.length === 0 ? <div className="text-center py-6 text-xs sparkle-text-muted">No operations recorded yet.</div> : history.slice(0, 6).map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl sparkle-accent/50 hover:sparkle-accent transition-all duration-200 border border-sparkle-border">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'success' ? 'bg-sparkle-success' : item.status === 'error' ? 'bg-sparkle-danger' : item.status === 'info' ? 'sparkle-primary' : 'bg-sparkle-text-muted'}`} />
                      <div className="flex-1 min-w-0">
                        <strong className="text-[12px] sparkle-text block">{item.action}</strong>
                        <span className="text-[11px] sparkle-text-muted">{item.detail}</span>
                      </div>
                      <time className="text-[10px] sparkle-text-muted shrink-0">{timeAgo(item.at)}</time>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
