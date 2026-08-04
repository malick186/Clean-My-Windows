import { useState } from 'react'
import { Power, Zap, Timer, Info } from 'lucide-react'

const programs = [
  { name: 'Microsoft OneDrive', pub: 'Microsoft', impact: 'High', on: true, delay: '0s' },
  { name: 'Spotify', pub: 'Spotify AB', impact: 'Medium', on: true, delay: '3s' },
  { name: 'Discord', pub: 'Discord Inc.', impact: 'Medium', on: false, delay: '0s' },
  { name: 'Adobe Creative Cloud', pub: 'Adobe Inc.', impact: 'High', on: true, delay: '8s' },
  { name: 'Steam Client', pub: 'Valve Corp.', impact: 'Low', on: false, delay: '0s' },
  { name: 'Java Update Scheduler', pub: 'Oracle', impact: 'Low', on: true, delay: '0s' },
  { name: 'Microsoft Teams', pub: 'Microsoft', impact: 'High', on: true, delay: '5s' },
  { name: 'Dropbox', pub: 'Dropbox Inc.', impact: 'Medium', on: false, delay: '0s' },
  { name: 'Google Drive', pub: 'Google LLC', impact: 'Medium', on: true, delay: '2s' },
  { name: 'Cortana', pub: 'Microsoft', impact: 'Low', on: false, delay: '0s' },
]

const impactCls = { High: 'badge-red', Medium: 'badge-orange', Low: 'badge-green' }

export default function StartupManager() {
  const [progs, setProgs] = useState(programs)

  const toggle = (i) => {
    const n = [...progs]; n[i] = { ...n[i], on: !n[i].on }; setProgs(n)
  }

  const on = progs.filter(p => p.on)
  const score = on.reduce((a, p) => a + (p.impact === 'High' ? 3 : p.impact === 'Medium' ? 2 : 1), 0)
  const boot = (8 + score * 1.2).toFixed(1)

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--orange-bg)' }}>
            <Power size={20} color="#ff9500" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Startup Manager</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Control which programs launch at startup to reduce boot time</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Timer, val: `${boot}s`, sub: 'Est. boot time', color: '#5ac8fa' },
          { icon: Zap, val: on.length, sub: `of ${progs.length} enabled`, color: '#ff9500' },
          { icon: Power, val: score <= 5 ? 'Low' : score <= 10 ? 'Medium' : 'High', sub: 'Overall impact', color: score <= 5 ? '#34c759' : score <= 10 ? '#ff9500' : '#ff3b30' },
        ].map(s => (
          <div key={s.sub} className="card p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="col-span-5">Program</div>
          <div className="col-span-3">Publisher</div>
          <div className="col-span-2">Impact</div>
          <div className="col-span-2">Status</div>
        </div>
        {progs.map((p, i) => (
          <div key={p.name} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
            <div className={`col-span-5 text-sm font-medium ${p.on ? '' : 'text-[var(--text-tertiary)]'}`}>{p.name}</div>
            <div className="col-span-3 text-xs text-[var(--text-tertiary)]">{p.pub}</div>
            <div className="col-span-2"><span className={`badge ${impactCls[p.impact]}`}>{p.impact}</span></div>
            <div className="col-span-2"><div onClick={() => toggle(i)} className={`toggle ${p.on ? 'on' : ''}`} /></div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--blue-bg)' }}>
        <Info size={17} color="#007aff" className="shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm">Pro Tip</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Disabling unnecessary startup programs can reduce boot time by 30-60%. Low impact items are usually safe to disable.</div>
        </div>
      </div>
    </div>
  )
}
