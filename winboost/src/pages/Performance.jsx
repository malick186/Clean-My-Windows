import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Cpu, Gauge, HardDrive, Loader, Monitor, RefreshCw, SlidersHorizontal, Sparkles, Zap } from 'lucide-react'
import { applyAllTweaks, listTweaks, setTweak } from '../lib/api'

const impactClass = { High: 'bg-red-bg text-red', Medium: 'bg-orange-bg text-orange', Low: 'bg-green-bg text-green' }

export default function Performance() {
  const [tweaks, setTweaks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try { setTweaks(await listTweaks()) }
    catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const toggle = async (tweak) => {
    setBusy(tweak.name); setNotice(null)
    try {
      await setTweak(tweak.name, !tweak.applied)
      setTweaks(items => items.map(item => item.name === tweak.name ? { ...item, applied: !item.applied } : item))
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setBusy(null) }
  }

  const optimize = async () => {
    setBusy('all'); setNotice(null)
    try {
      const result = await applyAllTweaks()
      setTweaks(await listTweaks())
      setNotice({ type: result.errors?.length ? 'warning' : 'success', text: `${result.applied || 0} settings optimized${result.errors?.length ? `; ${result.errors.length} could not be changed` : ''}.` })
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setBusy(null) }
  }

  const applied = tweaks.filter(item => item.applied).length
  const score = tweaks.length ? Math.round((applied / tweaks.length) * 100) : 0
  const categories = new Set(tweaks.map(item => item.cat)).size

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-bg text-teal">
            <Gauge size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Zap size={12} /> Reversible Windows tuning
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Performance Studio</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Apply measured, user-level optimizations. Every switch reads and changes the actual Windows setting.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold disabled:opacity-50" onClick={refresh} disabled={loading || Boolean(busy)}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}>{notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}{notice.text}</div>}

      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Sparkles, val: `${score}%`, sub: 'Optimization profile', color: '#ffcc00' },
          { icon: Cpu, val: applied, sub: 'Active settings', color: '#45e8ff' },
          { icon: SlidersHorizontal, val: tweaks.length, sub: 'Reversible controls', color: '#bd6cff' },
          { icon: HardDrive, val: categories, sub: 'Windows areas', color: '#4ce6a5' },
        ].map(item => (
          <div key={item.sub} className="rounded-[14px] bg-surface border border-border p-5 flex flex-col items-center gap-1">
            <item.icon size={18} style={{ color: item.color }} />
            <strong className="text-lg font-bold">{item.val}</strong>
            <span className="text-[11px] text-text-tertiary">{item.sub}</span>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] bg-surface border border-border p-5 flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-bg text-teal">
          <Monitor size={22} />
        </div>
        <div className="flex-1">
          <small className="text-[11px] text-text-tertiary uppercase tracking-wider">Balanced preset</small>
          <strong className="block text-[14px] font-semibold">Responsiveness without disabling core Windows services</strong>
          <p className="text-[11px] text-text-tertiary mt-0.5">Search indexing, SysMain and Prefetch are intentionally left intact.</p>
        </div>
        <button className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-accent text-black font-semibold text-[13px] hover:opacity-90 disabled:opacity-50" onClick={optimize} disabled={loading || Boolean(busy)}>
          {busy === 'all' ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}Optimize Safely
        </button>
      </div>

      <div className="rounded-[14px] bg-surface border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h3 className="text-[14px] font-semibold">Optimization controls</h3>
            <p className="text-[12px] text-text-tertiary">Switches can be restored at any time.</p>
          </div>
          <span className="text-[13px] text-text-secondary">{applied}/{tweaks.length} active</span>
        </div>
        {loading ? (
          <div className="loading-state"><Loader className="animate-spin" size={20} />Reading Windows settings...</div>
        ) : tweaks.map(tweak => (
          <div key={tweak.name} className={`flex items-center gap-3 px-5 py-3 border-b border-border last:border-b-0 ${tweak.applied ? 'bg-green-bg/20' : ''}`}>
            <span className="w-5 flex-shrink-0 flex items-center justify-center">
              {tweak.applied ? <CheckCircle size={18} className="text-green" /> : <span className="w-4 h-4 block rounded-full border-2 border-border" />}
            </span>
            <div className="flex-1 min-w-0">
              <strong className="text-[13px] font-semibold block">{tweak.name}</strong>
              <small className="text-[11px] text-text-tertiary block truncate">{tweak.desc}</small>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${impactClass[tweak.impact] || 'bg-green-bg text-green'}`}>{tweak.impact}</span>
            <span className="text-[11px] text-text-tertiary font-mono px-2 py-1 rounded-md bg-surface-secondary border border-border">{tweak.cat}</span>
            {busy === tweak.name ? <Loader size={16} className="animate-spin flex-shrink-0" /> : <button onClick={() => toggle(tweak)} className="toggle-switch" data-on={tweak.applied} aria-label={`${tweak.applied ? 'Restore' : 'Apply'} ${tweak.name}`} />}
          </div>
        ))}
      </div>
    </div>
  )
}
