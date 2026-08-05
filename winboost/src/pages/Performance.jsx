import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Cpu, Gauge, HardDrive, Loader, Monitor, RefreshCw, SlidersHorizontal, Sparkles, Zap } from 'lucide-react'
import { applyAllTweaks, listTweaks, setTweak } from '../lib/api'

const impactClass = { High: 'badge-red', Medium: 'badge-orange', Low: 'badge-green' }

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
    <div className="anim-fade-up space-y-6">
      <div className="page-hero compact-hero">
        <div className="page-hero-icon green"><Gauge size={23} /></div>
        <div><span className="eyebrow"><Zap size={12} /> Reversible Windows tuning</span><h1>Performance Studio</h1><p>Apply measured, user-level optimizations. Every switch reads and changes the actual Windows setting.</p></div>
        <button className="btn btn-secondary btn-sm hero-action" onClick={refresh} disabled={loading || Boolean(busy)}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}>{notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}{notice.text}</div>}

      <div className="grid grid-cols-4 gap-4 stat-card-grid">
        {[
          { icon: Sparkles, val: `${score}%`, sub: 'Optimization profile', color: '#ffcc00' },
          { icon: Cpu, val: applied, sub: 'Active settings', color: '#45e8ff' },
          { icon: SlidersHorizontal, val: tweaks.length, sub: 'Reversible controls', color: '#bd6cff' },
          { icon: HardDrive, val: categories, sub: 'Windows areas', color: '#4ce6a5' },
        ].map(item => <div key={item.sub} className="card metric-card"><item.icon size={18} style={{ color: item.color }} /><strong>{item.val}</strong><span>{item.sub}</span></div>)}
      </div>

      <div className="optimization-banner">
        <div className="optimization-pulse"><Monitor size={22} /></div>
        <div><small>Balanced preset</small><strong>Responsiveness without disabling core Windows services</strong><p>Search indexing, SysMain and Prefetch are intentionally left intact.</p></div>
        <button className="btn btn-primary" onClick={optimize} disabled={loading || Boolean(busy)}>{busy === 'all' ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}Optimize Safely</button>
      </div>

      <div className="card overflow-hidden settings-list-card">
        <div className="list-heading"><div><h3>Optimization controls</h3><p>Switches can be restored at any time.</p></div><span>{applied}/{tweaks.length} active</span></div>
        {loading ? <div className="loading-state"><Loader className="animate-spin" size={20} />Reading Windows settings...</div> : tweaks.map(tweak => (
          <div key={tweak.name} className={`setting-row ${tweak.applied ? 'active' : ''}`}>
            <span className="setting-state">{tweak.applied ? <CheckCircle size={18} /> : <span />}</span>
            <div className="setting-copy"><strong>{tweak.name}</strong><small>{tweak.desc}</small></div>
            <span className={`badge ${impactClass[tweak.impact] || 'badge-green'}`}>{tweak.impact}</span>
            <span className="setting-category">{tweak.cat}</span>
            {busy === tweak.name ? <Loader size={16} className="animate-spin" /> : <button onClick={() => toggle(tweak)} className={`toggle ${tweak.applied ? 'on' : ''}`} aria-label={`${tweak.applied ? 'Restore' : 'Apply'} ${tweak.name}`} />}
          </div>
        ))}
      </div>
    </div>
  )
}
