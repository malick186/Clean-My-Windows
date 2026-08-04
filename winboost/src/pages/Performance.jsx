import { useState, useEffect } from 'react'
import { Gauge, Cpu, Monitor, MousePointer, HardDrive, Sparkles, CheckCircle } from 'lucide-react'
import { listTweaks, applyTweak, applyAllTweaks } from '../lib/api'

const impCls = { High: 'badge-red', Medium: 'badge-orange', Low: 'badge-green' }

export default function Performance() {
  const [tweaks, setTweaks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listTweaks().then(data => { setTweaks(data); setLoading(false) })
  }, [])

  const apply = async (name) => {
    const result = await applyTweak(name)
    if (result.success) {
      setTweaks(prev => prev.map(t => t.name === name ? { ...t, applied: true } : t))
    }
  }

  const applyAll = async () => {
    const result = await applyAllTweaks()
    const refreshed = await listTweaks()
    setTweaks(refreshed)
  }

  const appliedCount = tweaks.filter(t => t.applied).length

  const benchmarks = [
    { label: 'Visual Effects', before: 'Full', after: 'Minimal', imp: tweaks.some(t => t.name === 'Disable Visual Effects' && t.applied) ? 'Applied' : '-' },
    { label: 'Game Mode', before: 'Off', after: 'On', imp: tweaks.some(t => t.name === 'Game Mode' && t.applied) ? 'Applied' : '-' },
    { label: 'Background Apps', before: 'Allowed', after: 'Blocked', imp: tweaks.some(t => t.name === 'Disable Background Apps' && t.applied) ? 'Applied' : '-' },
    { label: 'Power Plan', before: 'Balanced', after: 'Ultimate', imp: tweaks.some(t => t.name === 'Ultimate Performance Plan' && t.applied) ? 'Applied' : '-' },
    { label: 'Cortana', before: 'Enabled', after: 'Disabled', imp: tweaks.some(t => t.name === 'Disable Cortana' && t.applied) ? 'Applied' : '-' },
  ]

  if (loading) {
    return (
      <div className="anim-fade-up space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--green-bg)' }}>
              <Gauge size={20} color="#34c759" />
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.02em]">Performance Optimizer</h1>
          </div>
        </div>
        <div className="card p-10 text-center text-sm text-[var(--text-tertiary)]">Loading performance settings...</div>
      </div>
    )
  }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--green-bg)' }}>
            <Gauge size={20} color="#34c759" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Performance Optimizer</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Fine-tune Windows for maximum speed and responsiveness</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Sparkles, val: Math.round((appliedCount / Math.max(tweaks.length, 1)) * 100), sub: 'Score', color: '#ffcc00' },
          { icon: Cpu, val: appliedCount, sub: 'Active Tweaks', color: '#007aff' },
          { icon: Monitor, val: 'On', sub: 'Optimizer', color: '#af52de' },
          { icon: MousePointer, val: tweaks.length, sub: 'Available', color: '#34c759' },
          { icon: HardDrive, val: 'Ready', sub: 'Status', color: '#5ac8fa' },
        ].map(s => (
          <div key={s.sub} className="card p-3 text-center">
            <s.icon size={17} style={{ color: s.color }} className="mx-auto mb-1" />
            <div className="text-lg font-bold">{s.val}</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: '#ffcc00' }} />
          <h3 className="text-sm font-semibold">Settings Overview</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)]">
              <th className="text-left py-2 font-semibold">Setting</th>
              <th className="text-left py-2 font-semibold">Before</th>
              <th className="text-left py-2 font-semibold">After</th>
              <th className="text-right py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map(b => (
              <tr key={b.label} className="border-b border-[var(--border)]/50">
                <td className="py-2.5 font-medium">{b.label}</td>
                <td className="py-2.5 text-[var(--text-secondary)]">{b.before}</td>
                <td className="py-2.5" style={{ color: b.imp === 'Applied' ? 'var(--green)' : 'inherit' }}>{b.after}</td>
                <td className="py-2.5 text-right">
                  <span className={`badge ${b.imp === 'Applied' ? 'badge-green' : 'badge-blue'}`}>{b.imp}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <h3 className="text-sm font-semibold">Performance Tweaks</h3>
          <button onClick={applyAll} className="btn btn-primary btn-sm">Apply All</button>
        </div>
        {tweaks.map(t => (
          <div key={t.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              {t.applied ? <CheckCircle size={18} color="var(--green)" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-[#d2d2d7]" />}
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.desc}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${impCls[t.impact] || 'badge-green'}`}>{t.impact}</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">{t.cat}</span>
              {t.applied ? (
                <span className="badge badge-green">Applied</span>
              ) : (
                <button onClick={() => apply(t.name)} className="text-xs px-2.5 py-1 rounded-lg font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors">
                  Apply
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
