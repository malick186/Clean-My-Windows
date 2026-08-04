import { useState, useEffect } from 'react'
import { Trash2, Package, Search, Loader, CheckCircle, Calendar, HardDrive } from 'lucide-react'
import { listApps, uninstallApp } from '../lib/api'

const COLORS = ['#007aff', '#34c759', '#5856d6', '#af52de', '#ff9500', '#ff3b30']

export default function Uninstaller() {
  const [apps, setApps] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [uninstalling, setUninstalling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [removed, setRemoved] = useState(new Set())

  useEffect(() => { listApps().then(setApps) }, [])

  const filtered = apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) && !removed.has(a.name))
  const total = apps.filter(a => !removed.has(a.name)).reduce((s, a) => s + (a.size || 0.4), 0)

  const uninstall = async (app) => {
    setSelected(app); setUninstalling(true); setDone(false); setProgress(0)
    try {
      await uninstallApp(app.name, ({ percent }) => setProgress(percent))
      setRemoved(prev => new Set([...prev, app.name]))
      setDone(true)
    } catch (_) {
      setDone(true)
    }
    setUninstalling(false); setProgress(100)
  }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--orange-bg)' }}>
            <Trash2 size={20} color="#ff9500" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">App Uninstaller</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Completely remove applications and their leftover files</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Package, val: apps.length, sub: 'Apps detected', color: '#ff9500' },
          { icon: HardDrive, val: `${total.toFixed(1)} GB`, sub: 'Total size', color: '#007aff' },
          { icon: Search, val: apps.reduce((s, a) => s + (a.leftovers || 0), 0), sub: 'Leftover files', color: '#af52de' },
        ].map(s => (
          <div key={s.sub} className="card p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      {uninstalling && selected && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: COLORS[Math.floor(Math.random() * COLORS.length)] }}>
              {selected.name[0]}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Uninstalling {selected.name}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Please wait...</div>
            </div>
            <Loader size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {done && selected && (
        <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--green-bg)' }}>
          <CheckCircle size={18} color="var(--green)" />
          <div>
            <div className="font-semibold text-sm">{selected.name} removed</div>
            <div className="text-xs" style={{ color: 'var(--green)' }}>{(selected.size || 0).toFixed(1)} GB freed + {selected.leftovers || 0} leftovers cleaned</div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input type="text" className="input pl-9" placeholder="Search applications..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {filtered.map((app, i) => (
            <div key={app.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                {app.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{app.name}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{app.pub} &middot; {(app.size || 0).toFixed(1)} GB</div>
                {app.date && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1"><Calendar size={10} />{app.date}</span>
                    <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--orange)' }}><Search size={10} />{app.leftovers || 0} leftovers</span>
                  </div>
                )}
              </div>
              <button onClick={() => uninstall(app)} className="btn btn-secondary btn-sm">
                <Trash2 size={13} /> Uninstall
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-[var(--text-tertiary)]">
              {apps.length === 0 ? 'Scanning for installed apps...' : 'No apps match your search'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
