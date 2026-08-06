import { useState, useEffect } from 'react'
import { Power, Zap, Timer, Info, AlertTriangle, Loader, LockKeyhole } from 'lucide-react'
import { listStartup, toggleStartup } from '../lib/api'

const impactCls = {
  High: 'bg-red-bg text-red',
  Medium: 'bg-orange-bg text-orange',
  Low: 'bg-green-bg text-green'
}

export default function StartupManager() {
  const [progs, setProgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listStartup().then(data => setProgs(data)).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const toggle = async (i) => {
    const p = progs[i]
    setBusy(p.id); setError('')
    try {
      await toggleStartup(p.id, !p.enabled)
      const n = [...progs]; n[i] = { ...n[i], enabled: !n[i].enabled }; setProgs(n)
    } catch (err) { setError(err.message) }
    finally { setBusy(null) }
  }

  const on = progs.filter(p => p.enabled)
  const score = on.reduce((a, p) => a + (p.impact === 'High' ? 3 : p.impact === 'Medium' ? 2 : 1), 0)
  const boot = (8 + score * 1.2).toFixed(1)

  if (loading) {
    return (
      <div className="space-y-5 anim-fade-up">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-bg text-green">
            <Power size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Timer size={12} /> Boot Optimization
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Startup Manager</h1>
          </div>
        </div>
        <div className="loading-state">Scanning startup entries...</div>
      </div>
    )
  }

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-bg text-green">
            <Power size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Timer size={12} /> Boot Optimization
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Startup Manager</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Control which programs launch at startup to reduce boot time</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Timer, val: `${boot}s`, sub: 'Est. boot time', color: '#5ac8fa' },
          { icon: Zap, val: on.length, sub: `of ${progs.length} enabled`, color: '#ff9500' },
          { icon: Power, val: score <= 5 ? 'Low' : score <= 10 ? 'Medium' : 'High', sub: 'Overall impact', color: score <= 5 ? '#34c759' : score <= 10 ? '#ff9500' : '#ff3b30' },
        ].map(s => (
          <div key={s.sub} className="rounded-[14px] bg-surface border border-border p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold text-text">{s.val}</div>
            <div className="text-xs text-text-tertiary">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] bg-surface border border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider border-b border-border bg-surface-secondary/50">
          <div className="col-span-5">Program</div>
          <div className="col-span-3">Publisher</div>
          <div className="col-span-2">Impact</div>
          <div className="col-span-2">Status</div>
        </div>
        {progs.length === 0 ? (
          <div className="text-center py-10 text-sm text-text-tertiary">No startup entries found</div>
        ) : (
          progs.map((p, i) => (
            <div key={p.name} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-surface-secondary transition-colors border-b border-border">
              <div className={`col-span-5 text-sm font-medium ${p.enabled ? 'text-text' : 'text-text-tertiary'}`}>
                <div className="truncate max-w-[200px] flex items-center gap-1.5">{p.name}{p.requiresAdmin && <LockKeyhole size={11} title="Machine-wide entry" />}</div>
                {p.path && <div className="text-[11px] text-text-tertiary truncate max-w-[200px]">{p.path}</div>}
              </div>
              <div className="col-span-3 text-xs text-text-tertiary">{p.pub}</div>
              <div className="col-span-2"><span className={`text-[10px] px-2 py-0.5 rounded-[10px] font-bold ${impactCls[p.impact] || 'bg-teal-bg text-teal'}`}>{p.impact}</span></div>
              <div className="col-span-2">{busy === p.id ? <Loader size={15} className="animate-spin text-accent" /> : <div className={`toggle-switch ${p.enabled ? 'on' : ''}`} onClick={() => toggle(i)} data-on={p.enabled} />}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-[12px] bg-teal-bg">
        <Info size={17} className="text-teal shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm text-text">Pro Tip</div>
          <div className="text-xs text-text-secondary mt-0.5">Disabling unnecessary startup programs can reduce boot time by 30-60%. Low impact items are usually safe to disable.</div>
        </div>
      </div>
    </div>
  )
}
